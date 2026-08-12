/**
 * Application-wide monetary formatting for GarmentLoop ERP.
 * Always: full thousands separators + exactly two decimal places.
 * Never abbreviate (no M / L / Cr).
 */

const CURRENCY_SYMBOL = "₨";

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Format as 1,250,000.00 (Western thousands grouping). */
export function formatAmount(value: number | string | null | undefined): string {
  const n = toFiniteNumber(value);
  if (n === null) return "0.00";

  const negative = n < 0;
  const abs = Math.abs(n);
  const [integerPart, decimalPart = "00"] = abs.toFixed(2).split(".");
  const withSeparators = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${negative ? "-" : ""}${withSeparators}.${decimalPart}`;
}

/** Format as ₨ 1,250,000.00 (space after currency symbol). */
export function formatCurrency(
  value: number | string | null | undefined,
  symbol: string = CURRENCY_SYMBOL,
): string {
  const amount = formatAmount(value);
  if (amount.startsWith("-")) {
    return `-${symbol} ${amount.slice(1)}`;
  }
  return `${symbol} ${amount}`;
}

export function formatCurrencyWithDrCr(
  value: number | string | null | undefined,
  normalIsDebit = true,
): string {
  const n = toFiniteNumber(value) ?? 0;
  const abs = Math.abs(n);
  const isDebit = normalIsDebit ? n >= 0 : n <= 0;
  const side = isDebit ? "Dr" : "Cr";
  return `${formatCurrency(abs)} ${side}`;
}
