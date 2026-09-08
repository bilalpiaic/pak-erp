import type { Prisma, PurchaseInvoice, PurchaseInvoiceLine, Item } from "@/generated/prisma/client";
import { ACCOUNT_CODES } from "@/lib/accounts/codes";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { qtyUnitsToDecimalString, toQtyUnits } from "@/lib/accounting/quantity";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import { requireItem } from "@/lib/items/service";
import { adjustPartyOutstanding } from "@/lib/parties/outstanding";
import { resolveStockPostingAccounts } from "@/lib/stock/accounts";
import {
  deleteMovementsForDocument,
  insertMovements,
  prepareMovements,
} from "@/lib/stock/service";
import { nextVoucherNo } from "@/lib/vouchers/service";

import type {
  PurchaseInvoiceDTO,
  PurchaseInvoiceInput,
  PurchaseInvoiceListQuery,
} from "./types";
import {
  parseInvoiceDate,
  validatePurchaseInvoiceInput,
  type NormalizedPurchaseLine,
} from "./validation";

type InvoiceWithRelations = PurchaseInvoice & {
  lines: Array<PurchaseInvoiceLine & { stockItem?: Pick<Item, "sku"> | null }>;
  voucher: { id: bigint; voucherNo: string; status: string } | null;
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

function decimalString(value: { toString(): string }, scale = 2): string {
  if (scale === 2) {
    const cents = toCents(value.toString());
    return centsToDecimalString(cents ?? 0);
  }
  const units = toQtyUnits(value.toString());
  return qtyUnitsToDecimalString(units ?? 0);
}

function toInvoiceDTO(row: InvoiceWithRelations): PurchaseInvoiceDTO {
  return serialize({
    id: row.id.toString(),
    companyId: row.companyId.toString(),
    voucherId: row.voucherId?.toString() ?? null,
    voucherNo: row.voucher?.voucherNo ?? null,
    invoiceNo: row.invoiceNo,
    invoiceDate: row.invoiceDate.toISOString().slice(0, 10),
    partyId: row.partyId.toString(),
    partyName: row.partyName,
    partyNtn: row.partyNtn,
    billNo: row.billNo,
    narration: row.narration,
    status: row.status,
    totalAmount: decimalString(row.totalAmount),
    createdBy: row.createdBy,
    postedBy: row.postedBy,
    cancelledBy: row.cancelledBy,
    createdAt: row.createdAt.toISOString(),
    postedAt: row.postedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((line) => ({
        id: line.id.toString(),
        lineNo: line.lineNo,
        itemId: line.itemId.toString(),
        itemName: line.itemName,
        sku: line.stockItem?.sku ?? null,
        detail: line.detail,
        quantity: decimalString(line.quantity, 4),
        rate: decimalString(line.rate, 4),
        amount: decimalString(line.amount),
      })),
  });
}

const invoiceInclude = {
  lines: { orderBy: { lineNo: "asc" as const }, include: { stockItem: { select: { sku: true } } } },
  voucher: { select: { id: true, voucherNo: true, status: true } },
};

async function nextInvoiceNo(companyId: bigint): Promise<string> {
  const prisma = getPrisma();
  const latest = await prisma.purchaseInvoice.findMany({
    where: { companyId },
    select: { invoiceNo: true },
    orderBy: { id: "desc" },
    take: 200,
  });
  let max = 0;
  const prefix = "PI-";
  for (const row of latest) {
    if (!row.invoiceNo.startsWith(prefix)) continue;
    const numeric = Number(row.invoiceNo.slice(prefix.length));
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function loadCreditor(companyId: bigint, partyId: string) {
  const prisma = getPrisma();
  const party = await prisma.party.findFirst({
    where: { id: BigInt(partyId), companyId },
  });
  if (!party) throw new Error("Party not found.");
  if (!party.isActive) throw new Error("Party is inactive.");
  if (party.partyType === "Debtor") {
    throw new Error("Purchase invoices require a Creditor or Both party.");
  }
  return party;
}

function lineNarration(lines: NormalizedPurchaseLine[], names: Map<string, string>): string {
  if (lines.length === 1) {
    const only = lines[0]!;
    const name = names.get(only.itemId) ?? only.itemId;
    return only.detail ? `${name} — ${only.detail}` : name;
  }
  return `Purchase invoice (${lines.length} lines)`;
}

async function resolveLineItems(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  lines: NormalizedPurchaseLine[],
  requireActive: boolean,
): Promise<Map<string, { id: bigint; name: string; sku: string }>> {
  const map = new Map<string, { id: bigint; name: string; sku: string }>();
  for (const line of lines) {
    const item = await requireItem(tx, companyId, BigInt(line.itemId), {
      requireActive,
      requireTrackStock: true,
    });
    map.set(line.itemId, { id: item.id, name: item.name, sku: item.sku });
  }
  return map;
}

export async function syncPurchaseVoucherGl(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    voucherId: bigint | null;
    invoiceNo: string;
    invoiceDate: Date;
    partyId: bigint;
    partyName: string;
    partyNtn: string | null;
    billNo: string | null;
    narration: string | null;
    lines: NormalizedPurchaseLine[];
    totalAmount: string;
    stockId: bigint;
    creditorsId: bigint;
    itemNames: Map<string, string>;
  },
): Promise<bigint> {
  const narration =
    args.narration?.trim() || `Purchase invoice ${args.invoiceNo} — ${args.partyName}`;
  const detail = lineNarration(args.lines, args.itemNames);

  const voucherData = {
    voucherDate: args.invoiceDate,
    referenceNo: args.billNo,
    partyId: args.partyId,
    partyName: args.partyName,
    partyNtn: args.partyNtn,
    narration,
    lines: {
      create: [
        {
          accountId: args.stockId,
          debit: args.totalAmount,
          credit: "0.00",
          lineNarration: detail,
        },
        {
          accountId: args.creditorsId,
          debit: "0.00",
          credit: args.totalAmount,
          lineNarration: detail,
        },
      ],
    },
  };

  if (args.voucherId) {
    await tx.voucherLine.deleteMany({ where: { voucherId: args.voucherId } });
    await tx.voucher.update({
      where: { id: args.voucherId },
      data: {
        voucherDate: voucherData.voucherDate,
        referenceNo: voucherData.referenceNo,
        partyId: voucherData.partyId,
        partyName: voucherData.partyName,
        partyNtn: voucherData.partyNtn,
        narration: voucherData.narration,
        lines: voucherData.lines,
      },
    });
    return args.voucherId;
  }

  const voucherNo = await nextVoucherNo("PI", args.companyId);
  const voucher = await tx.voucher.create({
    data: {
      companyId: args.companyId,
      voucherNo,
      voucherType: "PI",
      status: "DRAFT",
      createdBy: "system",
      ...voucherData,
    },
  });
  return voucher.id;
}

export async function listPurchaseInvoices(
  query: PurchaseInvoiceListQuery = {},
): Promise<{ invoices: PurchaseInvoiceDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const where: Prisma.PurchaseInvoiceWhereInput = { companyId };
  if (query.status && query.status !== "All") {
    where.status = query.status as Prisma.EnumVoucherStatusFilter["equals"];
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { invoiceNo: { contains: search, mode: "insensitive" } },
      { partyName: { contains: search, mode: "insensitive" } },
      { billNo: { contains: search, mode: "insensitive" } },
      { narration: { contains: search, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.purchaseInvoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
  });
  return { invoices: rows.map(toInvoiceDTO) };
}

export async function getPurchaseInvoice(id: string): Promise<PurchaseInvoiceDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const row = await prisma.purchaseInvoice.findFirst({
    where: { id: BigInt(id), companyId },
    include: invoiceInclude,
  });
  return row ? toInvoiceDTO(row) : null;
}

export async function nextPurchaseInvoiceNo(): Promise<string> {
  return nextInvoiceNo(await requireCompanyId());
}

async function persistLines(
  tx: Prisma.TransactionClient,
  invoiceId: bigint,
  lines: NormalizedPurchaseLine[],
  names: Map<string, { name: string }>,
) {
  await tx.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: invoiceId } });
  if (!lines.length) return;
  await tx.purchaseInvoiceLine.createMany({
    data: lines.map((line, index) => ({
      purchaseInvoiceId: invoiceId,
      lineNo: index + 1,
      itemId: BigInt(line.itemId),
      itemName: names.get(line.itemId)?.name ?? line.itemId,
      detail: line.detail,
      quantity: line.quantity,
      rate: line.rate,
      amount: line.amount,
    })),
  });
}

export async function createDraftPurchaseInvoice(
  input: PurchaseInvoiceInput,
  actor = "system",
): Promise<PurchaseInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const validation = validatePurchaseInvoiceInput(input, { requireLines: false });
  if (validation.errors.length) throw new Error(validation.errors.join(" "));

  const party = await loadCreditor(companyId, input.partyId);
  const invoiceDate = parseInvoiceDate(input.invoiceDate)!;
  const invoiceNo = await nextInvoiceNo(companyId);
  const totalAmount = centsToDecimalString(validation.totalAmountCents);

  const created = await prisma.$transaction(async (tx) => {
    const accounts = await resolveStockPostingAccounts(tx, companyId);
    const itemMap = await resolveLineItems(tx, companyId, validation.lines, false);
    const names = new Map(Array.from(itemMap.entries()).map(([id, item]) => [id, item.name]));

    const voucherId =
      validation.lines.length > 0
        ? await syncPurchaseVoucherGl(tx, {
            companyId,
            voucherId: null,
            invoiceNo,
            invoiceDate,
            partyId: party.id,
            partyName: party.name,
            partyNtn: party.ntn,
            billNo: input.billNo?.trim() || null,
            narration: input.narration?.trim() || null,
            lines: validation.lines,
            totalAmount,
            stockId: accounts.stock.id,
            creditorsId: accounts.creditors.id,
            itemNames: names,
          })
        : null;

    const invoice = await tx.purchaseInvoice.create({
      data: {
        companyId,
        voucherId,
        invoiceNo,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        billNo: input.billNo?.trim() || null,
        narration: input.narration?.trim() || null,
        status: "DRAFT",
        totalAmount,
        createdBy: actor,
      },
    });
    await persistLines(tx, invoice.id, validation.lines, itemMap);
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CREATE",
        entity: "PurchaseInvoice",
        recordId: invoice.id.toString(),
        newValue: { invoiceNo, status: "DRAFT", totalAmount, partyName: party.name },
      },
    });
    return tx.purchaseInvoice.findFirstOrThrow({
      where: { id: invoice.id },
      include: invoiceInclude,
    });
  });

  return toInvoiceDTO(created);
}

export async function updateDraftPurchaseInvoice(
  id: string,
  input: PurchaseInvoiceInput,
  actor = "system",
): Promise<PurchaseInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);
  const validation = validatePurchaseInvoiceInput(input, { requireLines: false });
  if (validation.errors.length) throw new Error(validation.errors.join(" "));

  const party = await loadCreditor(companyId, input.partyId);
  const invoiceDate = parseInvoiceDate(input.invoiceDate)!;
  const totalAmount = centsToDecimalString(validation.totalAmountCents);

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!before) throw new Error("Purchase invoice not found.");
    if (before.status !== "DRAFT") {
      throw new Error("Only draft purchase invoices can be edited. Unpost first if this invoice is posted.");
    }

    const accounts = await resolveStockPostingAccounts(tx, companyId);
    const itemMap = await resolveLineItems(tx, companyId, validation.lines, false);
    const names = new Map(Array.from(itemMap.entries()).map(([id, item]) => [id, item.name]));

    let voucherId = before.voucherId;
    if (validation.lines.length > 0) {
      voucherId = await syncPurchaseVoucherGl(tx, {
        companyId,
        voucherId,
        invoiceNo: before.invoiceNo,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        billNo: input.billNo?.trim() || null,
        narration: input.narration?.trim() || null,
        lines: validation.lines,
        totalAmount,
        stockId: accounts.stock.id,
        creditorsId: accounts.creditors.id,
        itemNames: names,
      });
    }

    await tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        voucherId,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        billNo: input.billNo?.trim() || null,
        narration: input.narration?.trim() || null,
        totalAmount,
      },
    });
    await persistLines(tx, invoiceId, validation.lines, itemMap);
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UPDATE",
        entity: "PurchaseInvoice",
        recordId: invoiceId.toString(),
        oldValue: { totalAmount: before.totalAmount.toString() },
        newValue: { totalAmount },
      },
    });
    return tx.purchaseInvoice.findFirstOrThrow({
      where: { id: invoiceId },
      include: invoiceInclude,
    });
  });

  return toInvoiceDTO(updated);
}

export async function postPurchaseInvoice(id: string, actor = "system"): Promise<PurchaseInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const posted = await prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Purchase invoice not found.");
    if (invoice.status !== "DRAFT") throw new Error("Only draft purchase invoices can be posted.");

    const input: PurchaseInvoiceInput = {
      invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
      partyId: invoice.partyId.toString(),
      billNo: invoice.billNo,
      narration: invoice.narration,
      lines: invoice.lines.map((line) => ({
        itemId: line.itemId.toString(),
        detail: line.detail,
        quantity: line.quantity.toString(),
        rate: line.rate.toString(),
        amount: line.amount.toString(),
      })),
    };
    const validation = validatePurchaseInvoiceInput(input, { requireLines: true });
    if (validation.errors.length) throw new Error(validation.errors.join(" "));

    const accounts = await resolveStockPostingAccounts(tx, companyId);
    const itemMap = await resolveLineItems(tx, companyId, validation.lines, true);
    const names = new Map(Array.from(itemMap.entries()).map(([id, item]) => [id, item.name]));
    const totalAmount = centsToDecimalString(validation.totalAmountCents);

    const voucherId = await syncPurchaseVoucherGl(tx, {
      companyId,
      voucherId: invoice.voucherId,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      partyId: invoice.partyId,
      partyName: invoice.partyName,
      partyNtn: invoice.partyNtn,
      billNo: invoice.billNo,
      narration: invoice.narration,
      lines: validation.lines,
      totalAmount,
      stockId: accounts.stock.id,
      creditorsId: accounts.creditors.id,
      itemNames: names,
    });

    const prepared = await prepareMovements(tx, {
      companyId,
      moveDate: invoice.invoiceDate,
      drafts: validation.lines.map((line, index) => ({
        itemId: BigInt(line.itemId),
        direction: "IN" as const,
        moveType: "PURCHASE" as const,
        qtyUnits: line.qtyUnits,
        valueCents: line.amountCents,
        sourceLineNo: index + 1,
        narration: names.get(line.itemId) ?? line.itemId,
        partyId: invoice.partyId,
      })),
    });
    await insertMovements(tx, {
      companyId,
      voucherId,
      moveDate: invoice.invoiceDate,
      sourceDocument: "PurchaseInvoice",
      sourceDocumentId: invoiceId,
      prepared,
    });

    await tx.voucher.update({
      where: { id: voucherId },
      data: { status: "POSTED", postedAt: new Date(), postedBy: actor },
    });
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: validation.totalAmountCents,
    });
    await persistLines(tx, invoiceId, validation.lines, itemMap);
    await tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: {
        voucherId,
        status: "POSTED",
        totalAmount,
        postedAt: new Date(),
        postedBy: actor,
      },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "POST",
        entity: "PurchaseInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "DRAFT" },
        newValue: {
          status: "POSTED",
          totalAmount,
          posting: `Dr ${ACCOUNT_CODES.STOCK_IN_TRADE} / Cr ${ACCOUNT_CODES.TRADE_CREDITORS}`,
        },
      },
    });
    return tx.purchaseInvoice.findFirstOrThrow({
      where: { id: invoiceId },
      include: invoiceInclude,
    });
  });

  return toInvoiceDTO(posted);
}

export async function cancelPurchaseInvoice(id: string, actor = "system"): Promise<PurchaseInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const cancelled = await prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Purchase invoice not found.");
    if (invoice.status !== "POSTED") throw new Error("Only posted purchase invoices can be cancelled.");

    if (invoice.voucherId) {
      await tx.voucher.update({
        where: { id: invoice.voucherId },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor },
      });
    }
    const amountCents = toCents(invoice.totalAmount.toString()) ?? 0;
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: -amountCents,
    });
    const updated = await tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor },
      include: invoiceInclude,
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CANCEL",
        entity: "PurchaseInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "CANCELLED" },
      },
    });
    return updated;
  });
  return toInvoiceDTO(cancelled);
}

export async function unpostPurchaseInvoice(id: string, actor = "system"): Promise<PurchaseInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const unposted = await prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Purchase invoice not found.");
    if (invoice.status !== "POSTED") throw new Error("Only posted purchase invoices can be unposted.");

    await deleteMovementsForDocument(tx, "PurchaseInvoice", invoiceId);
    if (invoice.voucherId) {
      await tx.voucher.update({
        where: { id: invoice.voucherId },
        data: { status: "DRAFT", postedAt: null, postedBy: null },
      });
    }
    const amountCents = toCents(invoice.totalAmount.toString()) ?? 0;
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: -amountCents,
    });
    const updated = await tx.purchaseInvoice.update({
      where: { id: invoiceId },
      data: { status: "DRAFT", postedAt: null, postedBy: null },
      include: invoiceInclude,
    });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UNPOST",
        entity: "PurchaseInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "DRAFT" },
      },
    });
    return updated;
  });
  return toInvoiceDTO(unposted);
}

export async function deleteDraftPurchaseInvoice(id: string, actor = "system"): Promise<void> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Purchase invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new Error("Only draft purchase invoices can be deleted. Unpost first if this invoice is posted.");
    }
    const voucherId = invoice.voucherId;
    await tx.purchaseInvoice.delete({ where: { id: invoiceId } });
    if (voucherId) await tx.voucher.delete({ where: { id: voucherId } });
    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "DELETE",
        entity: "PurchaseInvoice",
        recordId: invoiceId.toString(),
        oldValue: { invoiceNo: invoice.invoiceNo },
      },
    });
  });
}

export async function createAndPostPurchaseInvoice(
  input: PurchaseInvoiceInput,
  actor = "system",
): Promise<PurchaseInvoiceDTO> {
  const draft = await createDraftPurchaseInvoice(input, actor);
  return postPurchaseInvoice(draft.id, actor);
}
