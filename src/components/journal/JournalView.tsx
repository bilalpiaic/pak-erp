"use client";

import { useMemo, useState, useTransition } from "react";

import { PrintButton } from "@/components/print/PrintButton";
import { useFiscalYear } from "@/components/fiscal-year/FiscalYearProvider";
import { JournalPrint } from "@/components/journal/JournalPrint";
import { OriginLink } from "@/components/ui/OriginLink";
import { formatCurrency } from "@/lib/formatting/money";
import type { JournalLineDTO, JournalResult } from "@/lib/journal/service";
import { accountLedgerHref, partyLedgerHref, voucherHref } from "@/lib/links";
import { VOUCHER_TYPES } from "@/lib/vouchers/types";
import { downloadCsv } from "@/lib/export/csv";

type JournalViewProps = {
  initial: JournalResult | null;
  loadError?: string | null;
};

export function JournalView({ initial, loadError = null }: JournalViewProps) {
  const { activeRange } = useFiscalYear();
  const [from, setFrom] = useState(initial?.from ?? activeRange.from);
  const [to, setTo] = useState(initial?.to ?? activeRange.to);
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<JournalResult | null>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();

  function load(next?: { from?: string; to?: string; type?: string; search?: string }) {
    const f = next?.from ?? from;
    const t = next?.to ?? to;
    const ty = next?.type ?? type;
    const q = next?.search ?? search;
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ from: f, to: t });
        if (ty !== "All") params.set("type", ty);
        if (q.trim()) params.set("search", q.trim());
        const response = await fetch(`/api/journal?${params}`);
        const json = (await response.json()) as JournalResult & { error?: string };
        if (!response.ok) {
          setError(json.error ?? "Failed to load journal.");
          return;
        }
        setData(json);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  const lines = useMemo(() => data?.lines ?? [], [data]);
  const totals = data?.totals;

  const csvRows = useMemo(
    () =>
      lines.map((line) => [
        line.date,
        line.voucherNo,
        line.voucherType,
        line.accountCode,
        line.accountName,
        line.partyName ?? "",
        line.referenceNo ?? "",
        line.debit,
        line.credit,
        line.narration ?? "",
      ]),
    [lines],
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <Field label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="field-input w-[150px]"
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="field-input w-[150px]"
          />
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field-input w-[110px]"
          >
            <option value="All">All</option>
            {VOUCHER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search" className="min-w-[180px] flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Voucher / account / party…"
            className="field-input w-full"
          />
        </Field>
        <button
          type="button"
          disabled={pending}
          onClick={() => load()}
          className="btn-primary"
        >
          {pending ? "Loading…" : "Apply"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            downloadCsv(
              `journal_${from}_${to}.csv`,
              [
                "Date",
                "Voucher",
                "Type",
                "Acc Code",
                "Account",
                "Party",
                "Ref",
                "Debit",
                "Credit",
                "Narration",
              ],
              csvRows,
            )
          }
        >
          Export CSV
        </button>
        <PrintButton orientation="landscape" />
      </div>

      {error ? (
        <p className="no-print border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="no-print overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Voucher</th>
              <th>Type</th>
              <th>Acc</th>
              <th>Account</th>
              <th>Party</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              <th>Narration</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--muted)]">
                  No posted journal lines in this range.
                </td>
              </tr>
            ) : (
              lines.map((line: JournalLineDTO, idx) => (
                <tr key={`${line.voucherId}-${line.accountCode}-${idx}`}>
                  <td className="whitespace-nowrap">{line.date}</td>
                  <td className="font-mono text-[11px]">
                    <OriginLink href={voucherHref(line.voucherId)}>{line.voucherNo}</OriginLink>
                  </td>
                  <td>{line.voucherType}</td>
                  <td className="font-mono">
                    <OriginLink href={accountLedgerHref(line.accountCode)}>
                      {line.accountCode}
                    </OriginLink>
                  </td>
                  <td>
                    <OriginLink href={accountLedgerHref(line.accountCode)}>
                      {line.accountName}
                    </OriginLink>
                  </td>
                  <td>
                    {line.partyId && line.partyName ? (
                      <OriginLink
                        href={partyLedgerHref(
                          line.partyId,
                          line.voucherType === "BPV" || line.voucherType === "CPV"
                            ? "creditor"
                            : "debtor",
                        )}
                      >
                        {line.partyName}
                      </OriginLink>
                    ) : (
                      (line.partyName ?? "—")
                    )}
                  </td>
                  <td className="text-right font-mono text-[var(--success)]">
                    {Number(line.debit) > 0 ? formatCurrency(line.debit) : ""}
                  </td>
                  <td className="text-right font-mono text-[var(--danger)]">
                    {Number(line.credit) > 0 ? formatCurrency(line.credit) : ""}
                  </td>
                  <td className="max-w-[220px] truncate text-[var(--muted)]">
                    {line.narration ?? ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {totals ? (
            <tfoot>
              <tr className="border-t-2 border-[var(--accent)] font-semibold">
                <td colSpan={6}>
                  Totals ({totals.count} lines)
                  {totals.balanced ? (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--success)]">
                      Balanced
                    </span>
                  ) : (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--danger)]">
                      Out of balance
                    </span>
                  )}
                </td>
                <td className="text-right font-mono text-[var(--success)]">
                  {formatCurrency(totals.debit)}
                </td>
                <td className="text-right font-mono text-[var(--danger)]">
                  {formatCurrency(totals.credit)}
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {data ? (
        <div className="print-only">
          <JournalPrint data={data} voucherType={type} search={search} />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
