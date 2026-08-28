"use client";

import Link from "next/link";

import { PrintButton } from "@/components/print/PrintButton";
import { OriginLink } from "@/components/ui/OriginLink";
import { DashboardPrint } from "@/components/dashboard/DashboardPrint";
import { formatCurrency } from "@/lib/formatting/money";
import type { DashboardResult } from "@/lib/dashboard/service";
import { partyLedgerHref, voucherHref } from "@/lib/links";

type DashboardViewProps = {
  data: DashboardResult | null;
  loadError?: string | null;
};

const TONE_CLASS: Record<DashboardResult["kpis"][number]["tone"], string> = {
  neutral: "border-[var(--border)] text-[var(--foreground)]",
  success: "border-emerald-200 text-[var(--success)]",
  danger: "border-red-200 text-[var(--danger)]",
  info: "border-[var(--border-strong)] text-[var(--foreground)]",
  warning: "border-amber-200 text-[var(--warning)]",
};

export function DashboardView({ data, loadError = null }: DashboardViewProps) {
  if (loadError) {
    return (
        <p className="no-print border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
        {loadError}
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--muted)]">No dashboard data available.</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-display text-lg font-bold text-[var(--foreground)]">
            {data.companyName}
          </div>
          <div className="text-xs text-[var(--muted)]">
            Accounting dashboard
            {data.fiscalYearName ? ` — ${data.fiscalYearName}` : ""} · As of {data.asOf}
          </div>
        </div>
        <div>
          <PrintButton orientation="portrait" />
        </div>
      </div>

      <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`border bg-[var(--panel)] px-3 py-3 sm:px-4 ${TONE_CLASS[kpi.tone]}`}
          >
            <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--muted)]">
              {kpi.label}
            </div>
            <div className="mt-1 font-mono text-sm font-semibold sm:text-base">
              {formatCurrency(kpi.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="no-print border border-[var(--border)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
          <span className="text-sm font-semibold text-[var(--accent)]">
            Recent vouchers
          </span>
          <Link
            href="/journal"
            className="no-print text-[11px] text-[var(--accent)] hover:underline"
          >
            View journal →
          </Link>
        </div>
        <div className="overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Type</th>
                <th>Party</th>
                <th>Narration</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--muted)]">
                    No vouchers yet.
                  </td>
                </tr>
              ) : (
                data.recent.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">{v.date}</td>
                    <td className="font-mono text-[11px]">
                      <OriginLink href={voucherHref(v.id)}>{v.voucherNo}</OriginLink>
                    </td>
                    <td>{v.voucherType}</td>
                    <td>
                      {v.partyId && v.partyName ? (
                        <OriginLink
                          href={partyLedgerHref(
                            v.partyId,
                            v.voucherType === "BPV" || v.voucherType === "CPV"
                              ? "creditor"
                              : "debtor",
                          )}
                        >
                          {v.partyName}
                        </OriginLink>
                      ) : (
                        (v.partyName ?? "—")
                      )}
                    </td>
                    <td className="max-w-[240px] truncate text-[var(--muted)]">
                      {v.narration ?? ""}
                    </td>
                    <td className="text-right font-mono">{formatCurrency(v.amount)}</td>
                    <td>
                      <span className="rounded bg-[var(--nav-active)] px-2 py-0.5 text-[10px]">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="print-only">
        <DashboardPrint data={data} />
      </div>
    </div>
  );
}
