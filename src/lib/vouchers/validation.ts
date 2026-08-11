import { centsToDecimalString, isBalanced, sumCents, toCents } from "@/lib/accounting/money";

import { VOUCHER_TYPES, type VoucherInput, type VoucherLineInput } from "./types";

export type NormalizedLine = {
  accountId: bigint;
  debit: string;
  credit: string;
  debitCents: number;
  creditCents: number;
  lineNarration: string | null;
};

export type ValidationResult = {
  errors: string[];
  lines: NormalizedLine[];
  totalDebitCents: number;
  totalCreditCents: number;
  balanced: boolean;
};

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseVoucherDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateVoucherInput(
  input: VoucherInput,
  options: { requireBalanced: boolean; requireLines: boolean },
): ValidationResult {
  const errors: string[] = [];

  if (!VOUCHER_TYPES.includes(input.voucherType)) {
    errors.push("Voucher type is invalid.");
  }

  if (!input.voucherDate || !parseVoucherDate(input.voucherDate)) {
    errors.push("Voucher date must be a valid YYYY-MM-DD date.");
  }

  const lines = (input.lines ?? [])
    .map((line) => normalizeLine(line))
    .filter((line): line is NormalizedLine => line !== null);

  if (options.requireLines && lines.length < 2) {
    errors.push("At least two voucher lines with amounts are required.");
  }

  for (const [index, line] of (input.lines ?? []).entries()) {
    if (!line.accountId?.trim()) {
      const debitCents = toCents(line.debit) ?? 0;
      const creditCents = toCents(line.credit) ?? 0;
      if (debitCents === 0 && creditCents === 0 && !line.lineNarration?.trim()) {
        continue;
      }
      errors.push(`Line ${index + 1}: account is required.`);
      continue;
    }

    const debitCents = toCents(line.debit);
    const creditCents = toCents(line.credit);
    if (debitCents === null || creditCents === null) {
      errors.push(`Line ${index + 1}: debit/credit must be valid amounts.`);
      continue;
    }
    if (debitCents < 0 || creditCents < 0) {
      errors.push(`Line ${index + 1}: amounts cannot be negative.`);
    }
    if (debitCents > 0 && creditCents > 0) {
      errors.push(`Line ${index + 1}: enter either debit or credit, not both.`);
    }
    if (debitCents === 0 && creditCents === 0) {
      errors.push(`Line ${index + 1}: enter a debit or credit amount.`);
    }
  }

  const totalDebitCents = sumCents(lines.map((l) => l.debit));
  const totalCreditCents = sumCents(lines.map((l) => l.credit));
  const balanced = isBalanced(totalDebitCents, totalCreditCents);

  if (options.requireBalanced) {
    if (totalDebitCents === 0 && totalCreditCents === 0) {
      errors.push("Cannot post a zero-value voucher.");
    }
    if (!balanced) {
      const diff = Math.abs(totalDebitCents - totalCreditCents);
      errors.push(
        `Voucher is not balanced. Difference: ${centsToDecimalString(diff)}.`,
      );
    }
  }

  return {
    errors,
    lines,
    totalDebitCents,
    totalCreditCents,
    balanced,
  };
}

function normalizeLine(line: VoucherLineInput): NormalizedLine | null {
  if (!line.accountId?.trim()) return null;
  const debitCents = toCents(line.debit) ?? 0;
  const creditCents = toCents(line.credit) ?? 0;
  if (debitCents === 0 && creditCents === 0) return null;
  if (debitCents < 0 || creditCents < 0) return null;
  if (debitCents > 0 && creditCents > 0) return null;

  return {
    accountId: BigInt(line.accountId),
    debit: centsToDecimalString(debitCents),
    credit: centsToDecimalString(creditCents),
    debitCents,
    creditCents,
    lineNarration: normalizeOptional(line.lineNarration),
  };
}
