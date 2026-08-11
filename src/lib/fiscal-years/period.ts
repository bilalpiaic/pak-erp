import { parseIsoDate, todayIso, toIsoDate } from "@/lib/accounting/dates";

/** Calendar year in which a fiscal period starting on `startMonth` begins, for `asOf`. */
export function fiscalStartCalendarYear(
  startMonth: number,
  asOf: Date = new Date(),
): number {
  const month = asOf.getUTCMonth() + 1;
  const year = asOf.getUTCFullYear();
  return month >= startMonth ? year : year - 1;
}

/** End date of a fiscal year that starts on `startDate` (exclusive end → last day inclusive). */
export function fiscalEndDate(startDate: Date): Date {
  const end = new Date(
    Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate()),
  );
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
}

export function fiscalYearName(startDate: Date, endDate: Date): string {
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  if (startYear === endYear) {
    return `FY ${startYear}`;
  }
  const endShort = String(endYear).slice(-2);
  return `FY ${startYear}-${endShort}`;
}

export function buildFiscalPeriod(
  startMonth: number,
  startCalendarYear: number,
): { name: string; startDate: Date; endDate: Date } {
  const startDate = new Date(Date.UTC(startCalendarYear, startMonth - 1, 1));
  const endDate = fiscalEndDate(startDate);
  return {
    name: fiscalYearName(startDate, endDate),
    startDate,
    endDate,
  };
}

export function dateRangeForFiscalYear(fy: {
  startDate: string;
  endDate: string;
  isOpen: boolean;
}): { from: string; to: string } {
  const today = todayIso();
  const from = parseIsoDate(fy.startDate) ? fy.startDate : fy.startDate;
  if (!fy.isOpen) {
    return { from: fy.startDate, to: fy.endDate };
  }
  // Open year: start → today (capped at FY end if today is past end)
  const to = today <= fy.endDate ? today : fy.endDate;
  return { from, to };
}

export function isoFromDate(date: Date): string {
  return toIsoDate(date);
}
