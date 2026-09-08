import type { Item, Prisma, StockAdjustment, StockAdjustmentLine } from "@/generated/prisma/client";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { qtyUnitsToDecimalString, toQtyUnits } from "@/lib/accounting/quantity";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import { requireItem } from "@/lib/items/service";
import { resolveStockPostingAccounts } from "@/lib/stock/accounts";
import {
  deleteMovementsForDocument,
  insertMovements,
  prepareMovements,
  type PreparedStockMove,
} from "@/lib/stock/service";
import { nextVoucherNo } from "@/lib/vouchers/service";

import type {
  StockAdjustmentDTO,
  StockAdjustmentInput,
  StockAdjustmentListQuery,
  StockAdjustmentReasonValue,
} from "./types";
import {
  parseAdjustmentDate,
  validateStockAdjustmentInput,
  type NormalizedAdjustmentLine,
} from "./validation";

type AdjustmentWithRelations = StockAdjustment & {
  lines: Array<StockAdjustmentLine & { stockItem?: Pick<Item, "sku"> | null }>;
  voucher: { id: bigint; voucherNo: string; status: string; lines?: Array<{ debit: unknown; credit: unknown }> } | null;
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

function decimalQty(value: { toString(): string }): string {
  return qtyUnitsToDecimalString(toQtyUnits(value.toString()) ?? 0);
}

function toDTO(row: AdjustmentWithRelations): StockAdjustmentDTO {
  const voucherLines = row.voucher && "lines" in row.voucher && Array.isArray(row.voucher.lines)
    ? row.voucher.lines
    : [];
  const totalDebit = voucherLines.reduce(
    (sum, line) => sum + (toCents(String(line.debit ?? "0")) ?? 0),
    0,
  );
  const totalCredit = voucherLines.reduce(
    (sum, line) => sum + (toCents(String(line.credit ?? "0")) ?? 0),
    0,
  );
  const lineTotal = row.lines.reduce((sum, line) => sum + (toCents(line.amount.toString()) ?? 0), 0);

  return serialize({
    id: row.id.toString(),
    companyId: row.companyId.toString(),
    voucherId: row.voucherId?.toString() ?? null,
    voucherNo: row.voucher?.voucherNo ?? null,
    adjustmentNo: row.adjustmentNo,
    adjustmentDate: row.adjustmentDate.toISOString().slice(0, 10),
    reason: row.reason as StockAdjustmentReasonValue,
    narration: row.narration,
    status: row.status,
    createdBy: row.createdBy,
    postedBy: row.postedBy,
    cancelledBy: row.cancelledBy,
    createdAt: row.createdAt.toISOString(),
    postedAt: row.postedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    totalDebit: centsToDecimalString(voucherLines.length ? totalDebit : lineTotal),
    totalCredit: centsToDecimalString(voucherLines.length ? totalCredit : lineTotal),
    lines: row.lines
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((line) => ({
        id: line.id.toString(),
        lineNo: line.lineNo,
        itemId: line.itemId.toString(),
        itemName: line.itemName,
        sku: line.stockItem?.sku ?? null,
        direction: line.direction,
        quantity: decimalQty(line.quantity),
        unitCost: decimalQty(line.unitCost),
        amount: centsToDecimalString(toCents(line.amount.toString()) ?? 0),
      })),
  });
}

const adjustmentInclude = {
  lines: { orderBy: { lineNo: "asc" as const }, include: { stockItem: { select: { sku: true } } } },
  voucher: {
    select: {
      id: true,
      voucherNo: true,
      status: true,
      lines: { select: { debit: true, credit: true } },
    },
  },
};

async function nextAdjustmentNo(companyId: bigint): Promise<string> {
  const prisma = getPrisma();
  const latest = await prisma.stockAdjustment.findMany({
    where: { companyId },
    select: { adjustmentNo: true },
    orderBy: { id: "desc" },
    take: 200,
  });
  let max = 0;
  for (const row of latest) {
    if (!row.adjustmentNo.startsWith("STJ-")) continue;
    const numeric = Number(row.adjustmentNo.slice(4));
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return `STJ-${String(max + 1).padStart(3, "0")}`;
}

async function resolveLineItems(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  lines: NormalizedAdjustmentLine[],
  requireActive: boolean,
) {
  const map = new Map<string, { id: bigint; name: string }>();
  for (const line of lines) {
    const item = await requireItem(tx, companyId, BigInt(line.itemId), {
      requireActive,
      requireTrackStock: true,
    });
    map.set(line.itemId, { id: item.id, name: item.name });
  }
  return map;
}

function contraAccountId(
  reason: StockAdjustmentReasonValue,
  accounts: Awaited<ReturnType<typeof resolveStockPostingAccounts>>,
): bigint {
  if (reason === "OPENING") return accounts.capital.id;
  if (reason === "GAIN") return accounts.otherIncome.id;
  return accounts.adminExpense.id;
}

async function syncAdjustmentVoucher(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    voucherId: bigint | null;
    adjustmentNo: string;
    adjustmentDate: Date;
    reason: StockAdjustmentReasonValue;
    narration: string | null;
    prepared: PreparedStockMove[];
    stockId: bigint;
    contraId: bigint;
  },
): Promise<bigint> {
  const glLines: Array<{ accountId: bigint; debit: string; credit: string; lineNarration: string }> = [];
  for (const row of args.prepared) {
    const amount = centsToDecimalString(row.valueCents);
    const narr = row.narration || args.adjustmentNo;
    if (row.direction === "IN") {
      glLines.push(
        { accountId: args.stockId, debit: amount, credit: "0.00", lineNarration: narr },
        { accountId: args.contraId, debit: "0.00", credit: amount, lineNarration: narr },
      );
    } else {
      glLines.push(
        { accountId: args.contraId, debit: amount, credit: "0.00", lineNarration: narr },
        { accountId: args.stockId, debit: "0.00", credit: amount, lineNarration: narr },
      );
    }
  }

  const narration = args.narration?.trim() || `${args.reason} ${args.adjustmentNo}`;
  const voucherData = {
    voucherDate: args.adjustmentDate,
    narration,
    lines: { create: glLines },
  };

  if (args.voucherId) {
    await tx.voucherLine.deleteMany({ where: { voucherId: args.voucherId } });
    await tx.voucher.update({
      where: { id: args.voucherId },
      data: voucherData,
    });
    return args.voucherId;
  }

  const voucherNo = await nextVoucherNo("STJ", args.companyId);
  const voucher = await tx.voucher.create({
    data: {
      companyId: args.companyId,
      voucherNo,
      voucherType: "STJ",
      status: "DRAFT",
      createdBy: "system",
      ...voucherData,
    },
  });
  return voucher.id;
}

async function persistLines(
  tx: Prisma.TransactionClient,
  adjustmentId: bigint,
  lines: NormalizedAdjustmentLine[],
  names: Map<string, { name: string }>,
) {
  await tx.stockAdjustmentLine.deleteMany({ where: { stockAdjustmentId: adjustmentId } });
  if (!lines.length) return;
  await tx.stockAdjustmentLine.createMany({
    data: lines.map((line, index) => ({
      stockAdjustmentId: adjustmentId,
      lineNo: index + 1,
      itemId: BigInt(line.itemId),
      itemName: names.get(line.itemId)?.name ?? line.itemId,
      direction: line.direction,
      quantity: line.quantity,
      unitCost: line.unitCost,
      amount: line.amount,
    })),
  });
}

function draftsFromLines(lines: NormalizedAdjustmentLine[], reason: StockAdjustmentReasonValue) {
  const moveType = reason === "OPENING" ? ("OPENING" as const) : ("ADJUSTMENT" as const);
  return lines.map((line, index) => ({
    itemId: BigInt(line.itemId),
    direction: line.direction,
    moveType,
    qtyUnits: line.qtyUnits,
    valueCents: line.direction === "IN" ? line.amountCents : undefined,
    sourceLineNo: index + 1,
    narration: namesOrId(line),
  }));
}

function namesOrId(line: NormalizedAdjustmentLine): string {
  return line.itemId;
}

export async function listStockAdjustments(
  query: StockAdjustmentListQuery = {},
): Promise<{ adjustments: StockAdjustmentDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const where: Prisma.StockAdjustmentWhereInput = { companyId };
  if (query.status && query.status !== "All") {
    where.status = query.status as Prisma.EnumVoucherStatusFilter["equals"];
  }
  if (query.reason && query.reason !== "All") {
    where.reason = query.reason as StockAdjustmentReasonValue;
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { adjustmentNo: { contains: search, mode: "insensitive" } },
      { narration: { contains: search, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.stockAdjustment.findMany({
    where,
    include: adjustmentInclude,
    orderBy: [{ adjustmentDate: "desc" }, { id: "desc" }],
  });
  return { adjustments: rows.map(toDTO) };
}

export async function getStockAdjustment(id: string): Promise<StockAdjustmentDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const row = await prisma.stockAdjustment.findFirst({
    where: { id: BigInt(id), companyId },
    include: adjustmentInclude,
  });
  return row ? toDTO(row) : null;
}

export async function nextStockAdjustmentNo(): Promise<string> {
  return nextAdjustmentNo(await requireCompanyId());
}

export async function createDraftStockAdjustment(
  input: StockAdjustmentInput,
  actor = "system",
): Promise<StockAdjustmentDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const validation = validateStockAdjustmentInput(input, { requireLines: false });
  if (validation.errors.length) throw new Error(validation.errors.join(" "));
  const reason = validation.reason!;
  const adjustmentDate = parseAdjustmentDate(input.adjustmentDate)!;

  const created = await prisma.$transaction(async (tx) => {
    const itemMap = await resolveLineItems(tx, companyId, validation.lines, false);
    const adjustmentNo = await nextAdjustmentNo(companyId);
    const row = await tx.stockAdjustment.create({
      data: {
        companyId,
        adjustmentNo,
        adjustmentDate,
        reason,
        narration: input.narration?.trim() || null,
        status: "DRAFT",
        createdBy: actor,
      },
    });
    await persistLines(tx, row.id, validation.lines, itemMap);
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CREATE",
        entity: "StockAdjustment",
        recordId: row.id.toString(),
        newValue: { adjustmentNo, reason },
      },
    });
    return tx.stockAdjustment.findFirstOrThrow({ where: { id: row.id }, include: adjustmentInclude });
  });
  return toDTO(created);
}

export async function updateDraftStockAdjustment(
  id: string,
  input: StockAdjustmentInput,
  actor = "system",
): Promise<StockAdjustmentDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const adjustmentId = BigInt(id);
  const validation = validateStockAdjustmentInput(input, { requireLines: false });
  if (validation.errors.length) throw new Error(validation.errors.join(" "));
  const reason = validation.reason!;
  const adjustmentDate = parseAdjustmentDate(input.adjustmentDate)!;

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.stockAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
    });
    if (!before) throw new Error("Stock adjustment not found.");
    if (before.status !== "DRAFT") {
      throw new Error("Only draft stock adjustments can be edited. Unpost first if this document is posted.");
    }
    const itemMap = await resolveLineItems(tx, companyId, validation.lines, false);
    await tx.stockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        adjustmentDate,
        reason,
        narration: input.narration?.trim() || null,
      },
    });
    await persistLines(tx, adjustmentId, validation.lines, itemMap);
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UPDATE",
        entity: "StockAdjustment",
        recordId: adjustmentId.toString(),
        newValue: { reason },
      },
    });
    return tx.stockAdjustment.findFirstOrThrow({
      where: { id: adjustmentId },
      include: adjustmentInclude,
    });
  });
  return toDTO(updated);
}

export async function postStockAdjustment(id: string, actor = "system"): Promise<StockAdjustmentDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const adjustmentId = BigInt(id);

  const posted = await prisma.$transaction(async (tx) => {
    const row = await tx.stockAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
      include: adjustmentInclude,
    });
    if (!row) throw new Error("Stock adjustment not found.");
    if (row.status !== "DRAFT") throw new Error("Only draft stock adjustments can be posted.");

    const input: StockAdjustmentInput = {
      adjustmentDate: row.adjustmentDate.toISOString().slice(0, 10),
      reason: row.reason as StockAdjustmentReasonValue,
      narration: row.narration,
      lines: row.lines.map((line) => ({
        itemId: line.itemId.toString(),
        direction: line.direction,
        quantity: line.quantity.toString(),
        unitCost: line.unitCost.toString(),
      })),
    };
    const validation = validateStockAdjustmentInput(input, { requireLines: true });
    if (validation.errors.length) throw new Error(validation.errors.join(" "));
    const reason = validation.reason!;

    const accounts = await resolveStockPostingAccounts(tx, companyId);
    const itemMap = await resolveLineItems(tx, companyId, validation.lines, true);
    const prepared = await prepareMovements(tx, {
      companyId,
      moveDate: row.adjustmentDate,
      drafts: draftsFromLines(validation.lines, reason).map((draft, index) => ({
        ...draft,
        narration: itemMap.get(validation.lines[index]!.itemId)?.name ?? draft.narration,
      })),
    });

    const voucherId = await syncAdjustmentVoucher(tx, {
      companyId,
      voucherId: row.voucherId,
      adjustmentNo: row.adjustmentNo,
      adjustmentDate: row.adjustmentDate,
      reason,
      narration: row.narration,
      prepared,
      stockId: accounts.stock.id,
      contraId: contraAccountId(reason, accounts),
    });
    await insertMovements(tx, {
      companyId,
      voucherId,
      moveDate: row.adjustmentDate,
      sourceDocument: "StockAdjustment",
      sourceDocumentId: adjustmentId,
      prepared,
    });
    await persistLines(tx, adjustmentId, validation.lines, itemMap);
    await tx.voucher.update({
      where: { id: voucherId },
      data: { status: "POSTED", postedAt: new Date(), postedBy: actor },
    });
    await tx.stockAdjustment.update({
      where: { id: adjustmentId },
      data: { voucherId, status: "POSTED", postedAt: new Date(), postedBy: actor },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "POST",
        entity: "StockAdjustment",
        recordId: adjustmentId.toString(),
        oldValue: { status: "DRAFT" },
        newValue: { status: "POSTED", voucherId: voucherId.toString() },
      },
    });
    return tx.stockAdjustment.findFirstOrThrow({
      where: { id: adjustmentId },
      include: adjustmentInclude,
    });
  });
  return toDTO(posted);
}

export async function unpostStockAdjustment(id: string, actor = "system"): Promise<StockAdjustmentDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const adjustmentId = BigInt(id);

  const unposted = await prisma.$transaction(async (tx) => {
    const row = await tx.stockAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
      include: adjustmentInclude,
    });
    if (!row) throw new Error("Stock adjustment not found.");
    if (row.status !== "POSTED") throw new Error("Only posted stock adjustments can be unposted.");
    await deleteMovementsForDocument(tx, "StockAdjustment", adjustmentId);
    if (row.voucherId) {
      await tx.voucher.update({
        where: { id: row.voucherId },
        data: { status: "DRAFT", postedAt: null, postedBy: null },
      });
    }
    const updated = await tx.stockAdjustment.update({
      where: { id: adjustmentId },
      data: { status: "DRAFT", postedAt: null, postedBy: null },
      include: adjustmentInclude,
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UNPOST",
        entity: "StockAdjustment",
        recordId: adjustmentId.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "DRAFT" },
      },
    });
    return updated;
  });
  return toDTO(unposted);
}

export async function cancelStockAdjustment(id: string, actor = "system"): Promise<StockAdjustmentDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const adjustmentId = BigInt(id);

  const cancelled = await prisma.$transaction(async (tx) => {
    const row = await tx.stockAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
      include: adjustmentInclude,
    });
    if (!row) throw new Error("Stock adjustment not found.");
    if (row.status !== "POSTED") throw new Error("Only posted stock adjustments can be cancelled.");
    if (row.voucherId) {
      await tx.voucher.update({
        where: { id: row.voucherId },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor },
      });
    }
    const updated = await tx.stockAdjustment.update({
      where: { id: adjustmentId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor },
      include: adjustmentInclude,
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CANCEL",
        entity: "StockAdjustment",
        recordId: adjustmentId.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "CANCELLED" },
      },
    });
    return updated;
  });
  return toDTO(cancelled);
}

export async function deleteDraftStockAdjustment(id: string, actor = "system"): Promise<void> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const adjustmentId = BigInt(id);
  await prisma.$transaction(async (tx) => {
    const row = await tx.stockAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
    });
    if (!row) throw new Error("Stock adjustment not found.");
    if (row.status !== "DRAFT") {
      throw new Error("Only draft stock adjustments can be deleted. Unpost first if this document is posted.");
    }
    const voucherId = row.voucherId;
    await tx.stockAdjustment.delete({ where: { id: adjustmentId } });
    if (voucherId) await tx.voucher.delete({ where: { id: voucherId } });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "DELETE",
        entity: "StockAdjustment",
        recordId: adjustmentId.toString(),
        oldValue: { adjustmentNo: row.adjustmentNo },
      },
    });
  });
}

export async function createAndPostStockAdjustment(
  input: StockAdjustmentInput,
  actor = "system",
): Promise<StockAdjustmentDTO> {
  const draft = await createDraftStockAdjustment(input, actor);
  return postStockAdjustment(draft.id, actor);
}
