"use client";

import { useState, useTransition } from "react";

import { DEFAULT_FY_START, todayIso } from "@/lib/accounting/dates";
import { formatCurrency } from "@/lib/formatting/money";
import type { ReportType } from "@/lib/reports/service";

type ReportViewProps = {
  type: ReportType;
  title: string;
  initial: Record<string, unknown> | null;
  loadError?: string | null;
};

export function ReportView({ type, title, initial, loadError = null }: ReportViewProps) {
  const [from, setFrom] = useState(String(initial?.from ?? DEFAULT_FY_START));
  const [to, setTo] = useState(String(initial?.to ?? todayIso()));
  const [data, setData] = useState<Record<string, unknown> | null>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ from, to });
        const response = await fetch(`/api/reports/${type}?${params}`);
        const json = (await response.json()) as Record<string, unknown> & {
          error?: string;
        };
        if (!response.ok) {
          setError(json.error ?? "Failed to load report.");
          return;
        }
        setData(json);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="field-input w-[150px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">To / As at</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="field-input w-[150px]"
          />
        </label>
        <button type="button" disabled={pending} onClick={load} className="btn-primary">
          {pending ? "Loading…" : "Apply"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      {error ? (
        <p className="border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5">
          <div className="mb-4 border-b border-[var(--border)] pb-3 text-center">
            <div className="text-sm font-semibold text-[var(--accent)]">
              {String(data.companyName ?? "")}
            </div>
            <div className="text-base font-semibold text-[var(--foreground)]">{title}</div>
            <div className="text-[11px] text-[var(--muted)]">
              {data.fiscalYearName ? `${String(data.fiscalYearName)} · ` : ""}
              {String(data.from)} → {String(data.to)}
            </div>
          </div>
          <ReportBody type={type} data={data} />
        </div>
      ) : null}
    </div>
  );
}

function ReportBody({ type, data }: { type: ReportType; data: Record<string, unknown> }) {
  switch (type) {
    case "trial-balance":
      return <TrialBalanceBody data={data} />;
    case "balance-sheet":
      return <BalanceSheetBody data={data} />;
    case "profit-loss":
    case "cash-flow":
      return <StatementLinesBody data={data} />;
    case "debtors-aging":
    case "creditors-aging":
      return <AgingBody data={data} showWht={type === "creditors-aging"} />;
    default:
      return null;
  }
}

function TrialBalanceBody({ data }: { data: Record<string, unknown> }) {
  const sections = (data.sections as Array<{
    group: string;
    items: Array<{ code: string; name: string; debit: string; credit: string }>;
    subtotalDebit: string;
    subtotalCredit: string;
  }>) ?? [];
  const totals = data.totals as {
    debit: string;
    credit: string;
    balanced: boolean;
    difference: string;
  };

  return (
    <div className="overflow-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {sections.flatMap((section) => [
            <tr key={`${section.group}-h`} className="bg-[var(--sidebar)]/50">
              <td colSpan={3} className="font-semibold text-[var(--accent)]">
                {section.group}
              </td>
            </tr>,
            ...section.items.map((item) => (
              <tr key={item.code}>
                <td className="pl-5">
                  {item.code} — {item.name}
                </td>
                <td className="text-right font-mono text-[var(--success)]">
                  {Number(item.debit) > 0 ? formatCurrency(item.debit) : ""}
                </td>
                <td className="text-right font-mono text-red-300">
                  {Number(item.credit) > 0 ? formatCurrency(item.credit) : ""}
                </td>
              </tr>
            )),
            <tr key={`${section.group}-t`} className="border-t border-[var(--border-strong)]">
              <td className="pl-5 text-[11px] italic text-[var(--muted)]">
                Subtotal — {section.group}
              </td>
              <td className="text-right font-mono font-semibold text-[var(--success)]">
                {Number(section.subtotalDebit) > 0
                  ? formatCurrency(section.subtotalDebit)
                  : ""}
              </td>
              <td className="text-right font-mono font-semibold text-red-300">
                {Number(section.subtotalCredit) > 0
                  ? formatCurrency(section.subtotalCredit)
                  : ""}
              </td>
            </tr>,
          ])}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--accent)] font-bold">
            <td>GRAND TOTAL</td>
            <td className="text-right font-mono text-[var(--success)]">
              {formatCurrency(totals.debit)}
            </td>
            <td
              className={`text-right font-mono ${
                totals.balanced ? "text-[var(--success)]" : "text-red-300"
              }`}
            >
              {formatCurrency(totals.credit)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 text-center text-xs">
        {totals.balanced ? (
          <span className="rounded bg-[var(--success-bg)] px-3 py-1 text-[var(--success)]">
            Trial Balance is balanced
          </span>
        ) : (
          <span className="rounded bg-red-950 px-3 py-1 text-red-200">
            Difference {formatCurrency(totals.difference)}
          </span>
        )}
      </p>
    </div>
  );
}

function BalanceSheetBody({ data }: { data: Record<string, unknown> }) {
  const assets = data.assets as Record<string, { label: string; amount: string; bold?: boolean; indent?: boolean }>;
  const equity = data.equityLiabilities as Record<
    string,
    { label: string; amount: string; bold?: boolean; indent?: boolean }
  >;
  const check = data.check as { balanced: boolean; difference: string; netProfit: string };

  const assetOrder = [
    "fixedGross",
    "accumDep",
    "netFixed",
    "stock",
    "debtors",
    "advances",
    "cash",
    "currentTotal",
    "total",
  ];
  const equityOrder = [
    "capital",
    "retained",
    "equityTotal",
    "longTerm",
    "creditors",
    "accruals",
    "taxes",
    "shortLoans",
    "currentTotal",
    "total",
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatementColumn title="Assets" rows={assetOrder.map((k) => assets[k]).filter(Boolean)} />
        <StatementColumn
          title="Equity & Liabilities"
          rows={equityOrder.map((k) => equity[k]).filter(Boolean)}
        />
      </div>
      <p className="text-center text-xs text-[var(--muted)]">
        Period net profit included in retained earnings:{" "}
        <span className="font-mono text-[var(--foreground)]">
          {formatCurrency(check.netProfit)}
        </span>
      </p>
      <p className="text-center text-xs">
        {check.balanced ? (
          <span className="rounded bg-[var(--success-bg)] px-3 py-1 text-[var(--success)]">
            Assets = Equity + Liabilities
          </span>
        ) : (
          <span className="rounded bg-red-950 px-3 py-1 text-red-200">
            Out of balance by {formatCurrency(check.difference)}
          </span>
        )}
      </p>
    </div>
  );
}

function StatementColumn({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; amount: string; bold?: boolean; indent?: boolean }>;
}) {
  return (
    <div>
      <div className="mb-2 border-b border-[var(--border-strong)] pb-1 text-sm font-semibold text-[var(--accent)]">
        {title}
      </div>
      <table className="data-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className={`${row.indent ? "pl-5" : ""} ${row.bold ? "font-semibold" : ""}`}>
                {row.label}
              </td>
              <td
                className={`text-right font-mono ${
                  row.bold ? "font-semibold text-[var(--accent)]" : ""
                } ${Number(row.amount) < 0 ? "text-red-300" : ""}`}
              >
                {formatCurrency(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementLinesBody({ data }: { data: Record<string, unknown> }) {
  const lines = (data.lines as Array<{
    label: string;
    amount: string | null;
    bold?: boolean;
    indent?: boolean;
    header?: boolean;
  }>) ?? [];

  return (
    <div className="mx-auto max-w-xl overflow-auto">
      <table className="data-table">
        <tbody>
          {lines.map((line, idx) =>
            line.header ? (
              <tr key={`${line.label}-${idx}`}>
                <td
                  colSpan={2}
                  className="bg-[var(--sidebar)]/40 pt-3 font-semibold text-[var(--accent)]"
                >
                  {line.label}
                </td>
              </tr>
            ) : (
              <tr key={`${line.label}-${idx}`}>
                <td
                  className={`${line.indent ? "pl-5" : ""} ${line.bold ? "font-semibold" : ""}`}
                >
                  {line.label}
                </td>
                <td
                  className={`text-right font-mono ${
                    line.bold ? "font-semibold" : ""
                  } ${line.amount && Number(line.amount) < 0 ? "text-red-300" : ""} ${
                    line.bold ? "text-[var(--accent)]" : ""
                  }`}
                >
                  {line.amount != null ? formatCurrency(line.amount) : ""}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function AgingBody({
  data,
  showWht,
}: {
  data: Record<string, unknown>;
  showWht: boolean;
}) {
  const parties = (data.parties as Array<{
    name: string;
    ntn: string | null;
    outstandingDays: number;
    amount: string;
    buckets: {
      current: string;
      d31: string;
      d61: string;
      d91: string;
      d120: string;
    };
    whtStatus: string | null;
  }>) ?? [];
  const totals = data.totals as {
    total: string;
    current: string;
    d31: string;
    d61: string;
    d91: string;
    d120: string;
    over90: string;
  };
  const whtPending = data.whtPending as string | null;

  return (
    <div className="space-y-3">
      {showWht && whtPending && Number(whtPending) > 0 ? (
        <div className="border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          FBR WHT alert: {formatCurrency(whtPending)} in creditor balances have withholding tax
          pending.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { l: "Current (0–30d)", v: totals.current, c: "text-[var(--success)]" },
          { l: "31–60 days", v: totals.d31, c: "text-yellow-300" },
          { l: "61–90 days", v: totals.d61, c: "text-orange-300" },
          { l: "Over 90 days", v: totals.over90, c: "text-red-300" },
        ].map((x) => (
          <div key={x.l} className="border border-[var(--border)] px-3 py-2">
            <div className="text-[10px] text-[var(--muted)]">{x.l}</div>
            <div className={`font-mono text-sm font-semibold ${x.c}`}>
              {formatCurrency(x.v)}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>NTN</th>
              <th className="text-right">Total</th>
              <th className="text-right">0–30</th>
              <th className="text-right">31–60</th>
              <th className="text-right">61–90</th>
              <th className="text-right">91–120</th>
              <th className="text-right">&gt;120</th>
              {showWht ? <th>WHT</th> : null}
              <th className="text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.name}>
                <td className="font-medium">{p.name}</td>
                <td className="text-[var(--muted)]">{p.ntn ?? "—"}</td>
                <td className="text-right font-mono text-[var(--accent)]">
                  {formatCurrency(p.amount)}
                </td>
                <td className="text-right font-mono">
                  {Number(p.buckets.current) > 0 ? formatCurrency(p.buckets.current) : ""}
                </td>
                <td className="text-right font-mono">
                  {Number(p.buckets.d31) > 0 ? formatCurrency(p.buckets.d31) : ""}
                </td>
                <td className="text-right font-mono">
                  {Number(p.buckets.d61) > 0 ? formatCurrency(p.buckets.d61) : ""}
                </td>
                <td className="text-right font-mono">
                  {Number(p.buckets.d91) > 0 ? formatCurrency(p.buckets.d91) : ""}
                </td>
                <td className="text-right font-mono">
                  {Number(p.buckets.d120) > 0 ? formatCurrency(p.buckets.d120) : ""}
                </td>
                {showWht ? (
                  <td>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] ${
                        p.whtStatus === "Deducted"
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : "bg-red-950 text-red-200"
                      }`}
                    >
                      {p.whtStatus ?? "—"}
                    </span>
                  </td>
                ) : null}
                <td className="text-right font-semibold">{p.outstandingDays}d</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--accent)] font-semibold">
              <td colSpan={2}>TOTAL</td>
              <td className="text-right font-mono text-[var(--accent)]">
                {formatCurrency(totals.total)}
              </td>
              <td className="text-right font-mono">{formatCurrency(totals.current)}</td>
              <td className="text-right font-mono">{formatCurrency(totals.d31)}</td>
              <td className="text-right font-mono">{formatCurrency(totals.d61)}</td>
              <td className="text-right font-mono">{formatCurrency(totals.d91)}</td>
              <td className="text-right font-mono">{formatCurrency(totals.d120)}</td>
              {showWht ? <td /> : null}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
