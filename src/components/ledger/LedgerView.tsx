"use client";

import { useState, useTransition } from "react";

import { PrintButton } from "@/components/print/PrintButton";
import { formatCurrency } from "@/lib/formatting/money";
import { DEFAULT_FY_START, todayIso } from "@/lib/accounting/dates";
import type { LedgerResult } from "@/lib/ledger/service";

type AccountOption = { code: string; name: string; accountType: string };

type LedgerViewProps = {
  initial: LedgerResult | null;
  accounts: AccountOption[];
  loadError?: string | null;
};

export function LedgerView({
  initial,
  accounts,
  loadError = null,
}: LedgerViewProps) {
  const [account, setAccount] = useState(
    initial?.account.code ?? accounts[0]?.code ?? "1001",
  );
  const [from, setFrom] = useState(initial?.from ?? DEFAULT_FY_START);
  const [to, setTo] = useState(initial?.to ?? todayIso());
  const [data, setData] = useState<LedgerResult | null>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ account, from, to });
        const response = await fetch(`/api/ledger?${params}`);
        const json = (await response.json()) as LedgerResult & { error?: string };
        if (!response.ok) {
          setError(json.error ?? "Failed to load ledger.");
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
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Account</span>
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="field-input w-full"
          >
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
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
          <span className="mb-1 block text-[11px] text-[var(--muted)]">To</span>
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
        <PrintButton disabled={!data} />
      </div>

      {error ? (
        <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Stat
              label="Account"
              value={`${data.account.code} — ${data.account.name}`}
              hint={`${data.account.accountGroup ?? "—"} · ${data.account.accountType}`}
            />
            <Stat
              label="Opening"
              value={formatCurrency(data.opening.balance)}
              hint={`${data.opening.side} balance`}
            />
            <Stat
              label="Period Debits"
              value={formatCurrency(data.period.debit)}
              hint={`${data.period.count} transactions`}
              tone="success"
            />
            <Stat
              label="Period Credits"
              value={formatCurrency(data.period.credit)}
              tone="danger"
            />
            <Stat
              label="Closing"
              value={formatCurrency(data.closing.balance)}
              hint={`${data.closing.side} balance`}
            />
          </div>

          <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Type</th>
                  <th>Party</th>
                  <th>Narration</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[var(--sidebar)]/40">
                  <td colSpan={5} className="italic text-[var(--muted)]">
                    Opening balance
                  </td>
                  <td className="text-right font-mono text-[var(--success)]">
                    {Number(data.opening.debit) > 0
                      ? formatCurrency(data.opening.debit)
                      : ""}
                  </td>
                  <td className="text-right font-mono text-[var(--danger)]">
                    {Number(data.opening.credit) > 0
                      ? formatCurrency(data.opening.credit)
                      : ""}
                  </td>
                  <td className="text-right font-mono">
                    {formatCurrency(data.opening.balance)} {data.opening.side === "Debit" ? "Dr" : "Cr"}
                  </td>
                </tr>
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                      No movements in this period.
                    </td>
                  </tr>
                ) : (
                  data.transactions.map((txn, idx) => (
                    <tr key={`${txn.voucherId}-${idx}`}>
                      <td className="whitespace-nowrap">{txn.date}</td>
                      <td className="font-mono text-[11px]">{txn.voucherNo}</td>
                      <td>{txn.voucherType}</td>
                      <td>{txn.partyName ?? "—"}</td>
                      <td className="max-w-[240px] truncate text-[var(--muted)]">
                        {txn.narration ?? ""}
                      </td>
                      <td className="text-right font-mono text-[var(--success)]">
                        {Number(txn.debit) > 0 ? formatCurrency(txn.debit) : ""}
                      </td>
                      <td className="text-right font-mono text-[var(--danger)]">
                        {Number(txn.credit) > 0 ? formatCurrency(txn.credit) : ""}
                      </td>
                      <td className="text-right font-mono">
                        {formatCurrency(txn.runningBalance)}{" "}
                        {txn.runningSide === "Debit" ? "Dr" : "Cr"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--accent)] font-semibold">
                  <td colSpan={5}>Closing balance</td>
                  <td className="text-right font-mono text-[var(--success)]">
                    {formatCurrency(data.period.debit)}
                  </td>
                  <td className="text-right font-mono text-[var(--danger)]">
                    {formatCurrency(data.period.credit)}
                  </td>
                  <td className="text-right font-mono">
                    {formatCurrency(data.closing.balance)}{" "}
                    {data.closing.side === "Debit" ? "Dr" : "Cr"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "danger"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-sm font-medium ${color}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
