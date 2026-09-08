import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import {
  amountCentsFromQtyAndRate,
  qtyUnitsToDecimalString,
  toQtyUnits,
} from "@/lib/accounting/quantity";

import type { PurchaseInvoiceInput, PurchaseInvoiceLineInput } from "./types";

export type NormalizedPurchaseLine = {
  itemId: string;
  detail: string | null;
  quantity: string;
  rate: string;
  amount: string;
  amountCents: number;
  qtyUnits: number;
};

export type PurchaseValidationResult = {
  errors: string[];
  lines: NormalizedPurchaseLine[];
  totalAmountCents: number;
};

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseInvoiceDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLine(
  line: PurchaseInvoiceLineInput,
  index: number,
  errors: string[],
): NormalizedPurchaseLine | null {
  const empty =
    !line.itemId?.trim() &&
    (line.detail == null || !String(line.detail).trim()) &&
    (line.quantity === "" || line.quantity == null) &&
    (line.rate === "" || line.rate == null) &&
    (line.amount === "" || line.amount == null);
  if (empty) return null;

  if (!line.itemId?.trim()) {
    errors.push(`Line ${index + 1}: item is required.`);
    return null;
  }

  const qtyUnits = toQtyUnits(line.quantity);
  const rateUnits = toQtyUnits(line.rate);
  if (qtyUnits === null || qtyUnits <= 0) {
    errors.push(`Line ${index + 1}: quantity must be a positive number.`);
    return null;
  }
  if (rateUnits === null) {
    errors.push(`Line ${index + 1}: rate must be a valid non-negative number.`);
    return null;
  }

  const computedCents = amountCentsFromQtyAndRate(qtyUnits, rateUnits);
  let amountCents = computedCents;
  if (line.amount !== undefined && line.amount !== null && line.amount !== "") {
    const parsed = toCents(line.amount);
    if (parsed === null || parsed < 0) {
      errors.push(`Line ${index + 1}: amount must be a valid money value.`);
      return null;
    }
    if (Math.abs(parsed - computedCents) > 1) {
      errors.push(
        `Line ${index + 1}: amount must equal quantity × rate (${centsToDecimalString(computedCents)}).`,
      );
      return null;
    }
    amountCents = parsed;
  }
  if (amountCents <= 0) {
    errors.push(`Line ${index + 1}: amount must be greater than zero.`);
    return null;
  }

  return {
    itemId: line.itemId.trim(),
    detail: normalizeOptional(line.detail ?? null),
    quantity: qtyUnitsToDecimalString(qtyUnits),
    rate: qtyUnitsToDecimalString(rateUnits),
    amount: centsToDecimalString(amountCents),
    amountCents,
    qtyUnits,
  };
}

export function validatePurchaseInvoiceInput(
  input: PurchaseInvoiceInput,
  options: { requireLines: boolean },
): PurchaseValidationResult {
  const errors: string[] = [];
  if (!input.invoiceDate || !parseInvoiceDate(input.invoiceDate)) {
    errors.push("Invoice date must be a valid YYYY-MM-DD date.");
  }
  if (!input.partyId?.trim()) {
    errors.push("Party (supplier / creditor) is required.");
  }

  const lines: NormalizedPurchaseLine[] = [];
  for (const [index, line] of (input.lines ?? []).entries()) {
    const normalized = normalizeLine(line, index, errors);
    if (normalized) lines.push(normalized);
  }
  if (options.requireLines && lines.length < 1) {
    errors.push("At least one invoice line is required.");
  }
  const totalAmountCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (options.requireLines && totalAmountCents <= 0) {
    errors.push("Invoice total must be greater than zero.");
  }
  return { errors, lines, totalAmountCents };
}
