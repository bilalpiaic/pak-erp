import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import {
  amountCentsFromQtyAndRate,
  qtyUnitsToDecimalString,
  toQtyUnits,
} from "@/lib/accounting/quantity";

import {
  STOCK_ADJUSTMENT_REASONS,
  type StockAdjustmentInput,
  type StockAdjustmentLineInput,
  type StockAdjustmentReasonValue,
} from "./types";

export type NormalizedAdjustmentLine = {
  itemId: string;
  direction: "IN" | "OUT";
  quantity: string;
  unitCost: string;
  amount: string;
  amountCents: number;
  qtyUnits: number;
};

export function parseAdjustmentDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLine(
  line: StockAdjustmentLineInput,
  index: number,
  errors: string[],
): NormalizedAdjustmentLine | null {
  const empty =
    !line.itemId?.trim() &&
    (line.quantity === "" || line.quantity == null) &&
    (line.unitCost === "" || line.unitCost == null);
  if (empty) return null;

  if (!line.itemId?.trim()) {
    errors.push(`Line ${index + 1}: item is required.`);
    return null;
  }
  if (line.direction !== "IN" && line.direction !== "OUT") {
    errors.push(`Line ${index + 1}: direction must be IN or OUT.`);
    return null;
  }
  const qtyUnits = toQtyUnits(line.quantity);
  if (qtyUnits === null || qtyUnits <= 0) {
    errors.push(`Line ${index + 1}: quantity must be a positive number.`);
    return null;
  }

  const costUnits = toQtyUnits(line.unitCost ?? "");
  if (line.direction === "IN" && (costUnits === null || costUnits < 0)) {
    errors.push(`Line ${index + 1}: unit cost is required for inbound stock.`);
    return null;
  }

  const amountCents =
    costUnits != null ? amountCentsFromQtyAndRate(qtyUnits, costUnits) : 0;

  return {
    itemId: line.itemId.trim(),
    direction: line.direction,
    quantity: qtyUnitsToDecimalString(qtyUnits),
    unitCost: costUnits != null ? qtyUnitsToDecimalString(costUnits) : "0.0",
    amount: centsToDecimalString(amountCents),
    amountCents,
    qtyUnits,
  };
}

export function validateStockAdjustmentInput(
  input: StockAdjustmentInput,
  options: { requireLines: boolean },
): { errors: string[]; lines: NormalizedAdjustmentLine[]; reason: StockAdjustmentReasonValue | null } {
  const errors: string[] = [];
  if (!input.adjustmentDate || !parseAdjustmentDate(input.adjustmentDate)) {
    errors.push("Adjustment date must be a valid YYYY-MM-DD date.");
  }
  const reason = STOCK_ADJUSTMENT_REASONS.includes(input.reason) ? input.reason : null;
  if (!reason) errors.push("Adjustment reason is required.");

  const lines: NormalizedAdjustmentLine[] = [];
  for (const [index, line] of (input.lines ?? []).entries()) {
    const normalized = normalizeLine(line, index, errors);
    if (normalized) lines.push(normalized);
  }
  if (options.requireLines && lines.length < 1) {
    errors.push("At least one adjustment line is required.");
  }
  if (reason === "OPENING" && lines.some((line) => line.direction !== "IN")) {
    errors.push("Opening stock lines must be inbound.");
  }
  if (reason === "GAIN" && lines.some((line) => line.direction !== "IN")) {
    errors.push("Stock gain lines must be inbound.");
  }
  if (reason === "LOSS" && lines.some((line) => line.direction !== "OUT")) {
    errors.push("Stock loss lines must be outbound.");
  }
  return { errors, lines, reason };
}

export { toCents };
