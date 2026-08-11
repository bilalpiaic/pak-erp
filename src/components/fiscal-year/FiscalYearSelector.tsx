"use client";

import { useFiscalYear } from "@/components/fiscal-year/FiscalYearProvider";

type FiscalYearSelectorProps = {
  compact?: boolean;
};

export function FiscalYearSelector({ compact = false }: FiscalYearSelectorProps) {
  const { fiscalYears, activeFiscalYear, pending, selectFiscalYear } = useFiscalYear();

  if (!fiscalYears.length) {
    return (
      <div className="text-[10px] text-[var(--muted-strong)]">
        {compact ? "No FY" : "No fiscal years yet"}
      </div>
    );
  }

  return (
    <label className="block">
      {!compact ? (
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
          Fiscal year
        </span>
      ) : null}
      <select
        value={activeFiscalYear?.id ?? ""}
        disabled={pending}
        onChange={(e) => {
          if (e.target.value) selectFiscalYear(e.target.value);
        }}
        className="w-full border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1.5 text-[11px] text-[var(--foreground)] disabled:opacity-60"
        aria-label="Select fiscal year"
      >
        {fiscalYears.map((fy) => (
          <option key={fy.id} value={fy.id}>
            {fy.name}
            {fy.isOpen ? "" : " (closed)"}
          </option>
        ))}
      </select>
      {!compact && activeFiscalYear ? (
        <div className="mt-1 text-[10px] text-[var(--muted)]">
          {activeFiscalYear.startDate} → {activeFiscalYear.endDate}
        </div>
      ) : null}
    </label>
  );
}
