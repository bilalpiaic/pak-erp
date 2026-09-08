/**
 * Integer 4-decimal quantity helpers.
 * Avoids JavaScript floating-point drift for stock qty and WAC math.
 */

export const QTY_SCALE = 10_000;

export type QtyInput = string | number | null | undefined;

/** Parse a quantity/rate (up to 4 decimal places) into integer units. Invalid → null. */
export function toQtyUnits(value: QtyInput): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * QTY_SCALE);
  }

  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;

  const [whole, frac = ""] = cleaned.split(".");
  const units = Number(whole) * QTY_SCALE + Number((frac + "0000").slice(0, 4));
  if (!Number.isFinite(units) || units < 0) return null;
  return units;
}

/** Format integer qty units as a decimal string with up to 4 places (no thousands separators). */
export function qtyUnitsToDecimalString(units: number): string {
  const negative = units < 0;
  const abs = Math.abs(Math.round(units));
  const whole = Math.floor(abs / QTY_SCALE);
  const frac = String(abs % QTY_SCALE).padStart(4, "0").replace(/0+$/, "");
  const body = frac.length ? `${whole}.${frac}` : `${whole}.0`;
  return negative ? `-${body}` : body;
}

/** Display quantity with thousands separators; trailing zeros after the first decimal stripped. */
export function formatQuantity(value: QtyInput): string {
  const units = toQtyUnits(value);
  if (units === null) return "0";
  const negative = units < 0;
  const abs = Math.abs(units);
  const whole = Math.floor(abs / QTY_SCALE);
  const frac = String(abs % QTY_SCALE).padStart(4, "0").replace(/0+$/, "");
  const withSep = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac.length ? `${withSep}.${frac}` : withSep;
  return negative ? `-${body}` : body;
}

/**
 * amountCents = round(qty × rate × 100) using 4-dp integer units.
 * qtyUnits * rateUnits / 1_000_000
 */
export function amountCentsFromQtyAndRate(qtyUnits: number, rateUnits: number): number {
  if (qtyUnits < 0 || rateUnits < 0) return 0;
  return Math.round((qtyUnits * rateUnits) / 1_000_000);
}

/** Unit cost in cents for an inbound line: round(valueCents * QTY_SCALE / qtyUnits). */
export function unitCostCentsFromValue(valueCents: number, qtyUnits: number): number {
  if (qtyUnits <= 0) return 0;
  return Math.round((valueCents * QTY_SCALE) / qtyUnits);
}

/**
 * Compatibility wrapper used by existing sales-invoice UI.
 * Returns a JS number (4 dp) or null — prefer toQtyUnits in new code.
 */
export function toQuantityOrRate(value: QtyInput): number | null {
  const units = toQtyUnits(value);
  if (units === null) return null;
  return units / QTY_SCALE;
}
