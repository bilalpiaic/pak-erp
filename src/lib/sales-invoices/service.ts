import type { Prisma, SalesInvoice, SalesInvoiceLine, Item } from "@/generated/prisma/client";
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
  SalesInvoiceDTO,
  SalesInvoiceInput,
  SalesInvoiceListQuery,
} from "./types";
import {
  parseInvoiceDate,
  validateSalesInvoiceInput,
  type NormalizedInvoiceLine,
} from "./validation";

type InvoiceWithRelations = SalesInvoice & {
  lines: Array<SalesInvoiceLine & { stockItem?: Pick<Item, "sku"> | null }>;
  voucher: { id: bigint; voucherNo: string; status: string } | null;
  party?: { accountId: bigint | null } | null;
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) {
    throw new Error("No company found. Create a company in Settings first.");
  }
  return BigInt(company.id);
}

function decimalString(value: { toString(): string }, scale = 2): string {
  if (scale === 2) {
    const cents = toCents(value.toString());
    return centsToDecimalString(cents ?? 0);
  }
  const n = toQtyUnits(value.toString());
  return qtyUnitsToDecimalString(n ?? 0);
}

function toInvoiceDTO(row: InvoiceWithRelations): SalesInvoiceDTO {
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
    poNumber: row.poNumber,
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
        itemId: line.itemId?.toString() ?? null,
        item: line.item,
        sku: line.stockItem?.sku ?? null,
        detail: line.detail,
        quantity: decimalString(line.quantity, 4),
        rate: decimalString(line.rate, 4),
        amount: decimalString(line.amount),
      })),
  });
}

const invoiceInclude = {
  lines: {
    orderBy: { lineNo: "asc" as const },
    include: { stockItem: { select: { sku: true } } },
  },
  voucher: { select: { id: true, voucherNo: true, status: true } },
  party: { select: { accountId: true } },
};

async function nextInvoiceNo(companyId: bigint): Promise<string> {
  const prisma = getPrisma();
  const latest = await prisma.salesInvoice.findMany({
    where: { companyId },
    select: { invoiceNo: true },
    orderBy: { id: "desc" },
    take: 200,
  });

  let max = 0;
  const prefix = "SI-";
  for (const row of latest) {
    if (!row.invoiceNo.startsWith(prefix)) continue;
    const numeric = Number(row.invoiceNo.slice(prefix.length));
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function resolvePostingAccounts(
  companyId: bigint,
  partyAccountId?: bigint | null,
) {
  const prisma = getPrisma();
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      code: { in: [ACCOUNT_CODES.TRADE_DEBTORS, ACCOUNT_CODES.SALES_TAXABLE] },
    },
    select: { id: true, code: true, name: true, isActive: true },
  });

  const controlDebtors = accounts.find((a) => a.code === ACCOUNT_CODES.TRADE_DEBTORS);
  const sales = accounts.find((a) => a.code === ACCOUNT_CODES.SALES_TAXABLE);

  if (!controlDebtors || !sales) {
    throw new Error(
      `Required accounts missing: need ${ACCOUNT_CODES.TRADE_DEBTORS} Trade Debtors and ${ACCOUNT_CODES.SALES_TAXABLE} Sales.`,
    );
  }
  if (!controlDebtors.isActive || !sales.isActive) {
    throw new Error(
      `Inactive posting account(s): ${[!controlDebtors.isActive && controlDebtors.code, !sales.isActive && sales.code]
        .filter(Boolean)
        .join(", ")}.`,
    );
  }

  let debtors = controlDebtors;
  if (partyAccountId) {
    const named = await prisma.account.findFirst({
      where: { id: partyAccountId, companyId },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (named?.isActive) debtors = named;
  }

  return { debtors, sales };
}

async function loadParty(companyId: bigint, partyId: string) {
  const prisma = getPrisma();
  const party = await prisma.party.findFirst({
    where: { id: BigInt(partyId), companyId },
  });
  if (!party) throw new Error("Party not found.");
  if (!party.isActive) throw new Error("Party is inactive.");
  if (party.partyType === "Creditor") {
    throw new Error("Sales invoices require a Debtor or Both party.");
  }
  return party;
}

function invoiceLineCreate(line: NormalizedInvoiceLine, index: number) {
  return {
    lineNo: index + 1,
    itemId: line.itemId ? BigInt(line.itemId) : null,
    item: line.item,
    detail: line.detail,
    quantity: line.quantity,
    rate: line.rate,
    amount: line.amount,
  };
}

async function hydrateItemNames(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  lines: NormalizedInvoiceLine[],
  requireActive: boolean,
): Promise<NormalizedInvoiceLine[]> {
  const result: NormalizedInvoiceLine[] = [];
  for (const line of lines) {
    if (!line.itemId) {
      result.push(line);
      continue;
    }
    const item = await requireItem(tx, companyId, BigInt(line.itemId), {
      requireActive,
      requireCategory: "Saleable",
    });
    result.push({ ...line, item: item.name || line.item });
  }
  return result;
}

async function applySalesStockOut(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    voucherId: bigint;
    invoiceId: bigint;
    invoiceDate: Date;
    partyId: bigint;
    lines: NormalizedInvoiceLine[];
  },
): Promise<number> {
  const drafts = [];
  for (const [index, line] of args.lines.entries()) {
    if (!line.itemId) continue;
    const item = await requireItem(tx, args.companyId, BigInt(line.itemId), {
      requireActive: true,
      requireCategory: "Saleable",
    });
    if (!item.trackStock) continue;
    drafts.push({
      itemId: item.id,
      direction: "OUT" as const,
      moveType: "SALE" as const,
      qtyUnits: line.qtyUnits,
      sourceLineNo: index + 1,
      narration: item.name,
      partyId: args.partyId,
    });
  }
  if (!drafts.length) return 0;

  const accounts = await resolveStockPostingAccounts(tx, args.companyId);
  const prepared = await prepareMovements(tx, {
    companyId: args.companyId,
    moveDate: args.invoiceDate,
    drafts,
  });
  await tx.voucherLine.createMany({
    data: prepared.flatMap((row) => [
      {
        voucherId: args.voucherId,
        accountId: accounts.cogs.id,
        debit: centsToDecimalString(row.valueCents),
        credit: "0.00",
        lineNarration: row.narration,
      },
      {
        voucherId: args.voucherId,
        accountId: accounts.stock.id,
        debit: "0.00",
        credit: centsToDecimalString(row.valueCents),
        lineNarration: row.narration,
      },
    ]),
  });
  await insertMovements(tx, {
    companyId: args.companyId,
    voucherId: args.voucherId,
    moveDate: args.invoiceDate,
    sourceDocument: "SalesInvoice",
    sourceDocumentId: args.invoiceId,
    prepared,
  });
  return prepared.reduce((sum, row) => sum + row.valueCents, 0);
}

/** Restore Dr COGS / Cr Stock lines from existing movements after a GL rewrite. */
export async function reapplyCogsLinesFromMovements(
  tx: Prisma.TransactionClient,
  args: { companyId: bigint; voucherId: bigint; invoiceId: bigint },
): Promise<void> {
  const movements = await tx.stockMovement.findMany({
    where: { sourceDocument: "SalesInvoice", sourceDocumentId: args.invoiceId },
    orderBy: { sourceLineNo: "asc" },
  });
  if (!movements.length) return;
  const accounts = await resolveStockPostingAccounts(tx, args.companyId);
  await tx.voucherLine.createMany({
    data: movements.flatMap((row) => [
      {
        voucherId: args.voucherId,
        accountId: accounts.cogs.id,
        debit: centsToDecimalString(row.valueCents),
        credit: "0.00",
        lineNarration: row.narration,
      },
      {
        voucherId: args.voucherId,
        accountId: accounts.stock.id,
        debit: "0.00",
        credit: centsToDecimalString(row.valueCents),
        lineNarration: row.narration,
      },
    ]),
  });
}

function lineNarration(lines: NormalizedInvoiceLine[]): string {
  if (lines.length === 1) {
    const only = lines[0];
    return only.detail ? `${only.item} — ${only.detail}` : only.item;
  }
  return `Sales invoice (${lines.length} lines)`;
}

export async function syncVoucherGl(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    voucherId: bigint | null;
    invoiceNo: string;
    invoiceDate: Date;
    partyId: bigint;
    partyName: string;
    partyNtn: string | null;
    poNumber: string | null;
    narration: string | null;
    lines: NormalizedInvoiceLine[];
    totalAmount: string;
    debtorsId: bigint;
    salesId: bigint;
  },
): Promise<bigint> {
  const narration =
    args.narration?.trim() ||
    `Sales invoice ${args.invoiceNo} — ${args.partyName}`;
  const detail = lineNarration(args.lines);

  const voucherData = {
    voucherDate: args.invoiceDate,
    referenceNo: args.poNumber,
    partyId: args.partyId,
    partyName: args.partyName,
    partyNtn: args.partyNtn,
    narration,
    lines: {
      create: [
        {
          accountId: args.debtorsId,
          debit: args.totalAmount,
          credit: "0.00",
          lineNarration: detail,
        },
        {
          accountId: args.salesId,
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

  const voucherNo = await nextVoucherNo("SI", args.companyId);
  const voucher = await tx.voucher.create({
    data: {
      companyId: args.companyId,
      voucherNo,
      voucherType: "SI",
      status: "DRAFT",
      createdBy: "system",
      ...voucherData,
      voucherDate: voucherData.voucherDate,
      referenceNo: voucherData.referenceNo,
      partyId: voucherData.partyId,
      partyName: voucherData.partyName,
      partyNtn: voucherData.partyNtn,
      narration: voucherData.narration,
      lines: voucherData.lines,
    },
  });
  return voucher.id;
}

export async function listSalesInvoices(
  query: SalesInvoiceListQuery = {},
): Promise<{ invoices: SalesInvoiceDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const where: Prisma.SalesInvoiceWhereInput = { companyId };

  if (query.status && query.status !== "All") {
    where.status = query.status as Prisma.EnumVoucherStatusFilter["equals"];
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { invoiceNo: { contains: search, mode: "insensitive" } },
      { partyName: { contains: search, mode: "insensitive" } },
      { poNumber: { contains: search, mode: "insensitive" } },
      { narration: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.salesInvoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
  });

  return { invoices: rows.map(toInvoiceDTO) };
}

export async function getSalesInvoice(id: string): Promise<SalesInvoiceDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const row = await prisma.salesInvoice.findFirst({
    where: { id: BigInt(id), companyId },
    include: invoiceInclude,
  });
  return row ? toInvoiceDTO(row) : null;
}

export async function nextSalesInvoiceNo(): Promise<string> {
  return nextInvoiceNo(await requireCompanyId());
}

export async function createDraftSalesInvoice(
  input: SalesInvoiceInput,
  actor = "system",
): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const validation = validateSalesInvoiceInput(input, { requireLines: false });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }

  const party = await loadParty(companyId, input.partyId);
  const invoiceDate = parseInvoiceDate(input.invoiceDate)!;
  const invoiceNo = await nextInvoiceNo(companyId);
  const totalAmount = centsToDecimalString(validation.totalAmountCents);
  const { debtors, sales } = await resolvePostingAccounts(companyId, party.accountId);

  const created = await prisma.$transaction(async (tx) => {
    const lines = await hydrateItemNames(tx, companyId, validation.lines, false);
    const voucherId =
      lines.length > 0
        ? await syncVoucherGl(tx, {
            companyId,
            voucherId: null,
            invoiceNo,
            invoiceDate,
            partyId: party.id,
            partyName: party.name,
            partyNtn: party.ntn,
            poNumber: input.poNumber?.trim() || null,
            narration: input.narration?.trim() || null,
            lines,
            totalAmount,
            debtorsId: debtors.id,
            salesId: sales.id,
          })
        : null;

    const invoice = await tx.salesInvoice.create({
      data: {
        companyId,
        voucherId,
        invoiceNo,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        poNumber: input.poNumber?.trim() || null,
        narration: input.narration?.trim() || null,
        status: "DRAFT",
        totalAmount,
        createdBy: actor,
        lines: {
          create: lines.map((line, index) => invoiceLineCreate(line, index)),
        },
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CREATE",
        entity: "SalesInvoice",
        recordId: invoice.id.toString(),
        newValue: {
          invoiceNo: invoice.invoiceNo,
          status: invoice.status,
          totalAmount,
          partyName: party.name,
        },
      },
    });

    return invoice;
  });

  return toInvoiceDTO(created);
}

export async function updateDraftSalesInvoice(
  id: string,
  input: SalesInvoiceInput,
  actor = "system",
): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const validation = validateSalesInvoiceInput(input, { requireLines: false });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }

  const party = await loadParty(companyId, input.partyId);
  const invoiceDate = parseInvoiceDate(input.invoiceDate)!;
  const totalAmount = centsToDecimalString(validation.totalAmountCents);
  const { debtors, sales } = await resolvePostingAccounts(companyId, party.accountId);

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!before) throw new Error("Sales invoice not found.");
    if (before.status !== "DRAFT") {
      throw new Error(
        "Only draft sales invoices can be edited. Unpost first if this invoice is posted.",
      );
    }

    const lines = await hydrateItemNames(tx, companyId, validation.lines, false);
    await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: invoiceId } });

    let voucherId = before.voucherId;
    if (lines.length > 0) {
      voucherId = await syncVoucherGl(tx, {
        companyId,
        voucherId,
        invoiceNo: before.invoiceNo,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        poNumber: input.poNumber?.trim() || null,
        narration: input.narration?.trim() || null,
        lines,
        totalAmount,
        debtorsId: debtors.id,
        salesId: sales.id,
      });
    } else if (voucherId) {
      await tx.voucherLine.deleteMany({ where: { voucherId } });
      await tx.voucher.update({
        where: { id: voucherId },
        data: {
          partyId: party.id,
          partyName: party.name,
          partyNtn: party.ntn,
          referenceNo: input.poNumber?.trim() || null,
          narration: input.narration?.trim() || null,
          voucherDate: invoiceDate,
        },
      });
    }

    const invoice = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        voucherId,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        poNumber: input.poNumber?.trim() || null,
        narration: input.narration?.trim() || null,
        totalAmount,
        lines: {
          create: lines.map((line, index) => invoiceLineCreate(line, index)),
        },
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UPDATE",
        entity: "SalesInvoice",
        recordId: invoice.id.toString(),
        oldValue: { status: before.status, totalAmount: before.totalAmount.toString() },
        newValue: { status: invoice.status, totalAmount },
      },
    });

    return invoice;
  });

  return toInvoiceDTO(updated);
}

export async function postSalesInvoice(id: string, actor = "system"): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const posted = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new Error("Only draft sales invoices can be posted.");
    }

    const input: SalesInvoiceInput = {
      invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
      partyId: invoice.partyId.toString(),
      poNumber: invoice.poNumber,
      narration: invoice.narration,
      lines: invoice.lines.map((line) => ({
        itemId: line.itemId?.toString() ?? null,
        item: line.item,
        detail: line.detail,
        quantity: line.quantity.toString(),
        rate: line.rate.toString(),
        amount: line.amount.toString(),
      })),
    };

    const validation = validateSalesInvoiceInput(input, { requireLines: true });
    if (validation.errors.length) {
      throw new Error(validation.errors.join(" "));
    }

    const lines = await hydrateItemNames(tx, companyId, validation.lines, true);
    const { debtors, sales } = await resolvePostingAccounts(
      companyId,
      invoice.party?.accountId ?? null,
    );
    const totalAmount = centsToDecimalString(validation.totalAmountCents);

    const voucherId = await syncVoucherGl(tx, {
      companyId,
      voucherId: invoice.voucherId,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      partyId: invoice.partyId,
      partyName: invoice.partyName,
      partyNtn: invoice.partyNtn,
      poNumber: invoice.poNumber,
      narration: invoice.narration,
      lines,
      totalAmount,
      debtorsId: debtors.id,
      salesId: sales.id,
    });

    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: { lines: true },
    });
    if (!voucher || voucher.status !== "DRAFT") {
      throw new Error("Linked voucher is not available for posting.");
    }

    const cogsCents = await applySalesStockOut(tx, {
      companyId,
      voucherId,
      invoiceId,
      invoiceDate: invoice.invoiceDate,
      partyId: invoice.partyId,
      lines,
    });

    await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedBy: actor,
      },
    });

    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: validation.totalAmountCents,
    });

    await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        voucherId,
        status: "POSTED",
        totalAmount,
        postedAt: new Date(),
        postedBy: actor,
        lines: undefined,
      },
    });

    await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: invoiceId } });
    await tx.salesInvoiceLine.createMany({
      data: lines.map((line, index) => ({
        salesInvoiceId: invoiceId,
        ...invoiceLineCreate(line, index),
      })),
    });

    const finalRow = await tx.salesInvoice.findFirst({
      where: { id: invoiceId },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "POST",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "DRAFT" },
        newValue: {
          status: "POSTED",
          totalAmount,
          voucherNo: voucher.voucherNo,
          posting: cogsCents
            ? `Dr ${ACCOUNT_CODES.TRADE_DEBTORS} / Cr ${ACCOUNT_CODES.SALES_TAXABLE}; Dr ${ACCOUNT_CODES.COGS} / Cr ${ACCOUNT_CODES.STOCK_IN_TRADE}`
            : `Dr ${ACCOUNT_CODES.TRADE_DEBTORS} / Cr ${ACCOUNT_CODES.SALES_TAXABLE}`,
        },
      },
    });

    return finalRow!;
  });

  return toInvoiceDTO(posted);
}

export async function cancelSalesInvoice(id: string, actor = "system"): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const cancelled = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "POSTED") {
      throw new Error("Only posted sales invoices can be cancelled.");
    }

    if (invoice.voucherId) {
      const voucher = await tx.voucher.findFirst({
        where: { id: invoice.voucherId, companyId },
      });
      if (voucher && voucher.status === "POSTED") {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledBy: actor,
          },
        });
      }
    }

    const amountCents = toCents(invoice.totalAmount.toString()) ?? 0;
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: -amountCents,
    });

    const updated = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: actor,
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CANCEL",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "CANCELLED" },
      },
    });

    return updated;
  });

  return toInvoiceDTO(cancelled);
}

/** Return a posted sales invoice (and its SI voucher) to DRAFT so it can be edited. */
export async function unpostSalesInvoice(id: string, actor = "system"): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const unposted = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "POSTED") {
      throw new Error("Only posted sales invoices can be unposted.");
    }

    await deleteMovementsForDocument(tx, "SalesInvoice", invoiceId);

    if (invoice.voucherId) {
      const voucher = await tx.voucher.findFirst({
        where: { id: invoice.voucherId, companyId },
      });
      if (voucher && voucher.status === "POSTED") {
        const { debtors, sales } = await resolvePostingAccounts(
          companyId,
          invoice.party?.accountId ?? null,
        );
        const lines = invoice.lines.map((line) => ({
          itemId: line.itemId?.toString() ?? null,
          item: line.item,
          detail: line.detail,
          quantity: decimalString(line.quantity, 4),
          rate: decimalString(line.rate, 4),
          amount: decimalString(line.amount),
          amountCents: toCents(line.amount.toString()) ?? 0,
          qtyUnits: toQtyUnits(line.quantity.toString()) ?? 0,
        }));
        await syncVoucherGl(tx, {
          companyId,
          voucherId: invoice.voucherId,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.invoiceDate,
          partyId: invoice.partyId,
          partyName: invoice.partyName,
          partyNtn: invoice.partyNtn,
          poNumber: invoice.poNumber,
          narration: invoice.narration,
          lines,
          totalAmount: decimalString(invoice.totalAmount),
          debtorsId: debtors.id,
          salesId: sales.id,
        });
        await tx.voucher.update({
          where: { id: voucher.id },
          data: {
            status: "DRAFT",
            postedAt: null,
            postedBy: null,
          },
        });
      } else if (voucher && voucher.status !== "DRAFT") {
        throw new Error("Linked voucher cannot be returned to draft.");
      }
    }

    const amountCents = toCents(invoice.totalAmount.toString()) ?? 0;
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: -amountCents,
    });

    const updated = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "DRAFT",
        postedAt: null,
        postedBy: null,
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UNPOST",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: {
          status: "POSTED",
          invoiceNo: invoice.invoiceNo,
          totalAmount: invoice.totalAmount.toString(),
        },
        newValue: { status: "DRAFT", invoiceNo: updated.invoiceNo },
      },
    });

    return updated;
  });

  return toInvoiceDTO(unposted);
}

/** Permanently delete a draft sales invoice and its linked SI voucher. */
export async function deleteDraftSalesInvoice(id: string, actor = "system"): Promise<void> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const { storageKeys } = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new Error(
        "Only draft sales invoices can be deleted. Unpost first if this invoice is posted.",
      );
    }

    const voucherId = invoice.voucherId;
    const attachments = voucherId
      ? await tx.voucherAttachment.findMany({
          where: { voucherId },
          select: { storageKey: true },
        })
      : [];
    const storageKeys = attachments.map((row) => row.storageKey);

    await tx.salesInvoice.delete({ where: { id: invoiceId } });
    if (voucherId) {
      await tx.voucher.delete({ where: { id: voucherId } });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "DELETE",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: {
          invoiceNo: invoice.invoiceNo,
          status: invoice.status,
          voucherNo: invoice.voucher?.voucherNo ?? null,
        },
      },
    });

    return { storageKeys };
  });

  const { deleteStoredAttachment } = await import("@/lib/attachments/storage");
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await deleteStoredAttachment(key);
      } catch {
        // DB row is already gone; leftover files are non-fatal.
      }
    }),
  );
}

export async function createAndPostSalesInvoice(
  input: SalesInvoiceInput,
  actor = "system",
): Promise<SalesInvoiceDTO> {
  const draft = await createDraftSalesInvoice(input, actor);
  return postSalesInvoice(draft.id, actor);
}
