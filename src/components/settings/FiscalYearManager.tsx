"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useFiscalYear } from "@/components/fiscal-year/FiscalYearProvider";
import type { FiscalYearDTO } from "@/lib/company/types";

type FiscalYearManagerProps = {
  initialYears: FiscalYearDTO[];
};

export function FiscalYearManager({ initialYears }: FiscalYearManagerProps) {
  const router = useRouter();
  const { activeFiscalYear, selectFiscalYear, refreshFiscalYears } = useFiscalYear();
  const [years, setYears] = useState(initialYears);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reload(list: FiscalYearDTO[]) {
    setYears(list);
  }

  function createNext() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/fiscal-years", { method: "POST" });
        const data = (await response.json()) as {
          fiscalYear?: FiscalYearDTO;
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Unable to create fiscal year.");
          return;
        }
        const listRes = await fetch("/api/fiscal-years");
        if (listRes.ok) {
          const listData = (await listRes.json()) as { fiscalYears: FiscalYearDTO[] };
          reload(listData.fiscalYears);
        } else if (data.fiscalYear) {
          reload([data.fiscalYear, ...years]);
        }
        await refreshFiscalYears();
        setMessage(`Created ${data.fiscalYear?.name ?? "fiscal year"}.`);
        router.refresh();
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  function toggleOpen(fy: FiscalYearDTO) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/fiscal-years/${fy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOpen: !fy.isOpen }),
        });
        const data = (await response.json()) as {
          fiscalYear?: FiscalYearDTO;
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Unable to update fiscal year.");
          return;
        }
        reload(
          years.map((y) => (y.id === fy.id && data.fiscalYear ? data.fiscalYear : y)),
        );
        await refreshFiscalYears();
        setMessage(
          data.fiscalYear
            ? `${data.fiscalYear.name} marked ${data.fiscalYear.isOpen ? "open" : "closed"}.`
            : "Fiscal year updated.",
        );
        router.refresh();
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--accent)]">Fiscal Years</h2>
        <button
          type="button"
          disabled={pending}
          onClick={createNext}
          className="no-print bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-ink)] disabled:opacity-60"
        >
          {pending ? "Working…" : "Create next FY"}
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Select the active year in the sidebar. Journal, ledgers, and reports default to that
        year&apos;s date range.
      </p>

      {years.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No fiscal years yet. Create a company or use &quot;Create next FY&quot;.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--table-head)] text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                <th className="px-2 py-2 font-semibold">Name</th>
                <th className="px-2 py-2 font-semibold">Period</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {years.map((fy) => {
                const isActive = activeFiscalYear?.id === fy.id;
                return (
                  <tr
                    key={fy.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--table-row-hover)]"
                  >
                    <td className="px-2 py-2 font-medium">
                      {fy.name}
                      {isActive ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-[var(--accent)]">
                          Active
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-[var(--muted)]">
                      {fy.startDate} → {fy.endDate}
                    </td>
                    <td className="px-2 py-2">
                      {fy.isOpen ? (
                        <span className="text-[var(--success)]">Open</span>
                      ) : (
                        <span className="text-[var(--muted)]">Closed</span>
                      )}
                    </td>
                    <td className="no-print px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {!isActive ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => selectFiscalYear(fy.id)}
                            className="border border-[var(--border-strong)] px-2 py-1 text-[11px] hover:bg-[var(--nav-hover)] disabled:opacity-60"
                          >
                            Use
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleOpen(fy)}
                          className="border border-[var(--border-strong)] px-2 py-1 text-[11px] hover:bg-[var(--nav-hover)] disabled:opacity-60"
                        >
                          {fy.isOpen ? "Close" : "Reopen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
