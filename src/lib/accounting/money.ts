/**
 * Integer-cent helpers for authoritative accounting math.
 * Avoids JavaScript floating-point drift for debit/credit checks.
 */

export type MoneyInput = string | number | null | undefined;

/** Parse a money value into integer cents (paisa). Invalid → null. */
export function toCents(value: MoneyInput): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }

  const cleaned = value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function sumCents(values: MoneyInput[]): number {
  return values.reduce<number>((total, value) => {
    const cents = toCents(value) ?? 0;
    return total + cents;
  }, 0);
}

export function isBalanced(debitTotalCents: number, creditTotalCents: number): boolean {
  return debitTotalCents === creditTotalCents;
}
