import type { Prisma, StockMoveDirection, StockMoveType, StockSourceDocument } from "@/generated/prisma/client";
import { parseIsoDate } from "@/lib/accounting/dates";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { qtyUnitsToDecimalString, toQtyUnits } from "@/lib/accounting/quantity";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import { getActiveDateRange } from "@/lib/fiscal-years/service";
import { applyIn, applyOut, EMPTY_ON_HAND, wacCents, type OnHand } from "@/lib/stock/wac";

export type StockMoveDraft = {
  itemId: bigint;
  direction: StockMoveDirection;
  moveType: StockMoveType;
  qtyUnits: number;
  /** Required for IN. Ignored for OUT (WAC is used). */
  valueCents?: number;
  sourceLineNo: number;
  narration?: string | null;
  partyId?: bigint | null;
};

export type PreparedStockMove = {
  itemId: bigint;
  direction: StockMoveDirection;
  moveType: StockMoveType;
  quantity: string;
  unitCostCents: number;
  valueCents: number;
  sourceLineNo: number;
  narration: string | null;
  partyId: bigint | null;
};

const postedVoucher = { status: "POSTED" as const };

export async function loadOnHand(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  itemId: bigint,
  asOf?: Date | null,
): Promise<OnHand> {
  const rows = await tx.stockMovement.findMany({
    where: {
      companyId,
      itemId,
      voucher: postedVoucher,
      ...(asOf ? { moveDate: { lte: asOf } } : {}),
    },
    select: { direction: true, quantity: true, valueCents: true },
    orderBy: [{ moveDate: "asc" }, { id: "asc" }],
  });

  let onHand = { ...EMPTY_ON_HAND };
  for (const row of rows) {
    const qty = toQtyUnits(row.quantity.toString()) ?? 0;
    if (row.direction === "IN") {
      onHand = applyIn(onHand, qty, row.valueCents);
    } else {
      onHand = {
        qtyUnits: onHand.qtyUnits - qty,
        valueCents: onHand.valueCents - row.valueCents,
      };
    }
  }
  return onHand;
}

export async function assertNoLaterMovements(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  itemIds: bigint[],
  moveDate: Date,
): Promise<void> {
  if (!itemIds.length) return;
  const later = await tx.stockMovement.findFirst({
    where: {
      companyId,
      itemId: { in: itemIds },
      moveDate: { gt: moveDate },
      voucher: postedVoucher,
    },
    include: { item: { select: { sku: true } } },
  });
  if (later) {
    throw new Error(
      `Cannot post on ${moveDate.toISOString().slice(0, 10)}: item ${later.item.sku} already has a later posted stock movement. Unpost later documents first.`,
    );
  }
}

/**
 * Replay on-hand in memory, compute IN/OUT values, and reject negative stock.
 * Does not write rows.
 */
export async function prepareMovements(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    moveDate: Date;
    drafts: StockMoveDraft[];
  },
): Promise<PreparedStockMove[]> {
  const itemIds = Array.from(new Set(args.drafts.map((d) => d.itemId)));
  await assertNoLaterMovements(tx, args.companyId, itemIds, args.moveDate);

  const onHandByItem = new Map<string, OnHand>();
  for (const itemId of itemIds) {
    onHandByItem.set(itemId.toString(), await loadOnHand(tx, args.companyId, itemId, args.moveDate));
  }

  const prepared: PreparedStockMove[] = [];
  for (const draft of args.drafts) {
    const key = draft.itemId.toString();
    const onHand = onHandByItem.get(key) ?? { ...EMPTY_ON_HAND };

    if (draft.direction === "IN") {
      const valueCents = draft.valueCents ?? 0;
      if (valueCents < 0) throw new Error("Inbound stock value cannot be negative.");
      const next = applyIn(onHand, draft.qtyUnits, valueCents);
      const unitCostCents = draft.qtyUnits > 0 ? Math.round((valueCents * 10_000) / draft.qtyUnits) : 0;
      onHandByItem.set(key, next);
      prepared.push({
        itemId: draft.itemId,
        direction: "IN",
        moveType: draft.moveType,
        quantity: qtyUnitsToDecimalString(draft.qtyUnits),
        unitCostCents,
        valueCents,
        sourceLineNo: draft.sourceLineNo,
        narration: draft.narration ?? null,
        partyId: draft.partyId ?? null,
      });
      continue;
    }

    const issued = applyOut(onHand, draft.qtyUnits);
    onHandByItem.set(key, issued.onHand);
    prepared.push({
      itemId: draft.itemId,
      direction: "OUT",
      moveType: draft.moveType,
      quantity: qtyUnitsToDecimalString(draft.qtyUnits),
      unitCostCents: issued.unitCostCents,
      valueCents: issued.valueCents,
      sourceLineNo: draft.sourceLineNo,
      narration: draft.narration ?? null,
      partyId: draft.partyId ?? null,
    });
  }

  return prepared;
}

export async function insertMovements(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    voucherId: bigint;
    moveDate: Date;
    sourceDocument: StockSourceDocument;
    sourceDocumentId: bigint;
    prepared: PreparedStockMove[];
  },
): Promise<void> {
  if (!args.prepared.length) return;
  await tx.stockMovement.createMany({
    data: args.prepared.map((row) => ({
      companyId: args.companyId,
      itemId: row.itemId,
      moveDate: args.moveDate,
      direction: row.direction,
      moveType: row.moveType,
      quantity: row.quantity,
      unitCostCents: row.unitCostCents,
      valueCents: row.valueCents,
      voucherId: args.voucherId,
      sourceDocument: args.sourceDocument,
      sourceDocumentId: args.sourceDocumentId,
      sourceLineNo: row.sourceLineNo,
      partyId: row.partyId,
      narration: row.narration,
    })),
  });
}

export async function deleteMovementsForDocument(
  tx: Prisma.TransactionClient,
  sourceDocument: StockSourceDocument,
  sourceDocumentId: bigint,
): Promise<void> {
  await tx.stockMovement.deleteMany({
    where: { sourceDocument, sourceDocumentId },
  });
}

export type StockLedgerTxn = {
  date: string;
  voucherId: string;
  voucherNo: string;
  voucherType: string;
  direction: StockMoveDirection;
  moveType: StockMoveType;
  quantityIn: string;
  quantityOut: string;
  unitCost: string;
  value: string;
  runningQty: string;
  runningValue: string;
  partyName: string | null;
  narration: string | null;
  sourceDocument: string;
  sourceDocumentId: string;
};

export type StockLedgerResult = {
  from: string;
  to: string;
  item: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    category: string;
  };
  opening: { qty: string; value: string };
  transactions: StockLedgerTxn[];
  closing: { qty: string; value: string; wac: string };
};

export async function getStockLedger(query: {
  itemId?: string;
  from?: string;
  to?: string;
}): Promise<StockLedgerResult> {
  const prisma = getPrisma();
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  const companyId = BigInt(company.id);

  const items = await prisma.item.findMany({
    where: { companyId },
    orderBy: { sku: "asc" },
  });
  if (!items.length) throw new Error("No items found. Create an item first.");

  const item =
    (query.itemId ? items.find((row) => row.id.toString() === query.itemId) : null) ?? items[0]!;

  const activeRange = await getActiveDateRange();
  const fromStr = query.from?.trim() || activeRange.from;
  const toStr = query.to?.trim() || activeRange.to;
  const from = parseIsoDate(fromStr);
  const to = parseIsoDate(toStr);
  if (!from || !to) throw new Error("Invalid date range. Use YYYY-MM-DD.");
  if (from > to) throw new Error("From date must be on or before To date.");

  const openingRows = await prisma.stockMovement.findMany({
    where: {
      companyId,
      itemId: item.id,
      voucher: postedVoucher,
      moveDate: { lt: from },
    },
    select: { direction: true, quantity: true, valueCents: true },
    orderBy: [{ moveDate: "asc" }, { id: "asc" }],
  });

  let onHand = { ...EMPTY_ON_HAND };
  for (const row of openingRows) {
    const qty = toQtyUnits(row.quantity.toString()) ?? 0;
    if (row.direction === "IN") onHand = applyIn(onHand, qty, row.valueCents);
    else onHand = { qtyUnits: onHand.qtyUnits - qty, valueCents: onHand.valueCents - row.valueCents };
  }

  const opening = { qty: qtyUnitsToDecimalString(onHand.qtyUnits), value: centsToDecimalString(onHand.valueCents) };

  const periodRows = await prisma.stockMovement.findMany({
    where: {
      companyId,
      itemId: item.id,
      voucher: postedVoucher,
      moveDate: { gte: from, lte: to },
    },
    include: {
      voucher: { select: { id: true, voucherNo: true, voucherType: true } },
      party: { select: { name: true } },
    },
    orderBy: [{ moveDate: "asc" }, { id: "asc" }],
  });

  const transactions: StockLedgerTxn[] = [];
  for (const row of periodRows) {
    const qty = toQtyUnits(row.quantity.toString()) ?? 0;
    if (row.direction === "IN") onHand = applyIn(onHand, qty, row.valueCents);
    else onHand = { qtyUnits: onHand.qtyUnits - qty, valueCents: onHand.valueCents - row.valueCents };

    transactions.push({
      date: row.moveDate.toISOString().slice(0, 10),
      voucherId: row.voucher.id.toString(),
      voucherNo: row.voucher.voucherNo,
      voucherType: row.voucher.voucherType,
      direction: row.direction,
      moveType: row.moveType,
      quantityIn: row.direction === "IN" ? qtyUnitsToDecimalString(qty) : "0",
      quantityOut: row.direction === "OUT" ? qtyUnitsToDecimalString(qty) : "0",
      unitCost: centsToDecimalString(row.unitCostCents),
      value: centsToDecimalString(row.valueCents),
      runningQty: qtyUnitsToDecimalString(onHand.qtyUnits),
      runningValue: centsToDecimalString(onHand.valueCents),
      partyName: row.party?.name ?? null,
      narration: row.narration,
      sourceDocument: row.sourceDocument,
      sourceDocumentId: row.sourceDocumentId.toString(),
    });
  }

  return serialize({
    from: fromStr,
    to: toStr,
    item: {
      id: item.id.toString(),
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      category: item.category,
    },
    opening,
    transactions,
    closing: {
      qty: qtyUnitsToDecimalString(onHand.qtyUnits),
      value: centsToDecimalString(onHand.valueCents),
      wac: centsToDecimalString(wacCents(onHand)),
    },
  });
}

export type StockValuationRow = {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty: string;
  wac: string;
  value: string;
  valueCents: number;
};

export type StockValuationResult = {
  asOf: string;
  rows: StockValuationRow[];
  stockValueCents: number;
  stockValue: string;
  glStockCents: number;
  glStock: string;
  differenceCents: number;
  difference: string;
  tied: boolean;
};

export async function getStockValuation(asOf?: string): Promise<StockValuationResult> {
  const prisma = getPrisma();
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  const companyId = BigInt(company.id);

  const activeRange = await getActiveDateRange();
  const asOfStr = asOf?.trim() || activeRange.to;
  const asOfDate = parseIsoDate(asOfStr);
  if (!asOfDate) throw new Error("Invalid as-of date. Use YYYY-MM-DD.");

  const items = await prisma.item.findMany({
    where: { companyId },
    orderBy: { sku: "asc" },
  });

  const rows: StockValuationRow[] = [];
  let stockValueCents = 0;
  for (const item of items) {
    const onHand = await loadOnHand(prisma, companyId, item.id, asOfDate);
    if (onHand.qtyUnits === 0 && onHand.valueCents === 0 && !item.isActive) continue;
    stockValueCents += onHand.valueCents;
    rows.push({
      itemId: item.id.toString(),
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      qty: qtyUnitsToDecimalString(onHand.qtyUnits),
      wac: centsToDecimalString(wacCents(onHand)),
      value: centsToDecimalString(onHand.valueCents),
      valueCents: onHand.valueCents,
    });
  }

  const stockAccount = await prisma.account.findFirst({
    where: { companyId, code: "1020" },
    select: { id: true },
  });
  let glStockCents = 0;
  if (stockAccount) {
    const lines = await prisma.voucherLine.findMany({
      where: {
        accountId: stockAccount.id,
        voucher: { companyId, status: "POSTED", voucherDate: { lte: asOfDate } },
      },
      select: { debit: true, credit: true },
    });
    for (const line of lines) {
      glStockCents += (toCents(line.debit.toString()) ?? 0) - (toCents(line.credit.toString()) ?? 0);
    }
  }

  const differenceCents = stockValueCents - glStockCents;
  return serialize({
    asOf: asOfStr,
    rows,
    stockValueCents,
    stockValue: centsToDecimalString(stockValueCents),
    glStockCents,
    glStock: centsToDecimalString(glStockCents),
    differenceCents,
    difference: centsToDecimalString(differenceCents),
    tied: differenceCents === 0,
  });
}

export async function countPostedStockMovements(): Promise<number> {
  const prisma = getPrisma();
  const company = await getPrimaryCompany();
  if (!company) return 0;
  return prisma.stockMovement.count({
    where: { companyId: BigInt(company.id), voucher: postedVoucher },
  });
}
