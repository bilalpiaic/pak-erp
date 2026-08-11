/** ISO date helpers (YYYY-MM-DD) for ledger / journal / reports. */

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Default Gill Embroidery FY start used by seed data. */
export const DEFAULT_FY_START = "2024-07-01";

export function defaultDateRange(fiscalStart?: string | null): {
  from: string;
  to: string;
} {
  return {
    from: fiscalStart && parseIsoDate(fiscalStart) ? fiscalStart : DEFAULT_FY_START,
    to: todayIso(),
  };
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return 0;
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
