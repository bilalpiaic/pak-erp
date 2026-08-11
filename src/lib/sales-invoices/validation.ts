import { centsToDecimalString, toCents } from "@/lib/accounting/money";

import type { SalesInvoiceInput, SalesInvoiceLineInput } from "./types";

export type NormalizedInvoiceLine = {
  item: string;
  detail: string | null;
  quantity: string;
  rate: string;
  amount: string;
  amountCents: number;
};

export type InvoiceValidationResult = {
  errors: string[];
  lines: NormalizedInvoiceLine[];
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

/** Parse quantity/rate allowing up to 4 decimal places. */
export function toQuantityOrRate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatQtyRate(value: number): string {
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed.includes(".") ? fixed : `${fixed}.0`;
}

function normalizeLine(
  line: SalesInvoiceLineInput,
  index: number,
  errors: string[],
): NormalizedInvoiceLine | null {
  const item = line.item?.trim() ?? "";
  const quantity = toQuantityOrRate(line.quantity);
  const rate = toQuantityOrRate(line.rate);

  const empty =
    !item &&
    (line.detail == null || !String(line.detail).trim()) &&
    (line.quantity === "" || line.quantity == null) &&
    (line.rate === "" || line.rate == null) &&
    (line.amount === "" || line.amount == null);

  if (empty) return null;

  if (!item) {
    errors.push(`Line ${index + 1}: item is required.`);
    return null;
  }
  if (quantity === null || quantity <= 0) {
    errors.push(`Line ${index + 1}: quantity must be a positive number.`);
    return null;
  }
  if (rate === null) {
    errors.push(`Line ${index + 1}: rate must be a valid non-negative number.`);
    return null;
  }

  const computedCents = Math.round(quantity * rate * 100);
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
    item,
    detail: normalizeOptional(line.detail ?? null),
    quantity: formatQtyRate(quantity),
    rate: formatQtyRate(rate),
    amount: centsToDecimalString(amountCents),
    amountCents,
  };
}

export function validateSalesInvoiceInput(
  input: SalesInvoiceInput,
  options: { requireLines: boolean },
): InvoiceValidationResult {
  const errors: string[] = [];

  if (!input.invoiceDate || !parseInvoiceDate(input.invoiceDate)) {
    errors.push("Invoice date must be a valid YYYY-MM-DD date.");
  }

  if (!input.partyId?.trim()) {
    errors.push("Party (customer / debtor) is required.");
  }

  const lines: NormalizedInvoiceLine[] = [];
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
