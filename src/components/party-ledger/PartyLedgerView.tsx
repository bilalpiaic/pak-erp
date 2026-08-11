"use client";

import { useMemo, useState, useTransition } from "react";

import { PrintButton } from "@/components/print/PrintButton";
import { useFiscalYear } from "@/components/fiscal-year/FiscalYearProvider";
import { OriginLink } from "@/components/ui/OriginLink";
import { formatCurrency } from "@/lib/formatting/money";
import type { PartyDTO } from "@/lib/parties/types";
import type {
  PartyLedgerKind,
  PartyLedgerResult,
} from "@/lib/party-ledger/service";
import { accountLedgerHref, partyMasterHref, voucherHref } from "@/lib/links";

type PartyLedgerViewProps = {
  parties: PartyDTO[];
  initialPartyId?: string | null;
  initialKind?: PartyLedgerKind | null;
  initial?: PartyLedgerResult | null;
  loadError?: string | null;
};

function defaultKindForParty(party: PartyDTO | undefined): PartyLedgerKind {
  if (!party) return "debtor";
  if (party.partyType === "Creditor") return "creditor";
  return "debtor";
}

export function PartyLedgerView({
  parties,
  initialPartyId = null,
  initialKind = null,
  initial = null,
  loadError = null,
}: PartyLedgerViewProps) {
  const { activeRange } = useFiscalYear();
  const activeParties = useMemo(
    () => parties.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [parties],
  );

  const [partyId, setPartyId] = useState(
    initialPartyId ?? initial?.party.id ?? activeParties[0]?.id ?? "",
  );
  const selectedParty = activeParties.find((p) => p.id === partyId);
  const [kind, setKind] = useState<PartyLedgerKind>(
    initialKind ?? initial?.kind ?? defaultKindForParty(selectedParty),
  );
  const [from, setFrom] = useState(initial?.from ?? activeRange.from);
  const [to, setTo] = useState(initial?.to ?? activeRange.to);
  const [data, setData] = useState<PartyLedgerResult | null>(initial);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();

  const kindOptions = useMemo(() => {
    if (!selectedParty) return ["debtor", "creditor"] as PartyLedgerKind[];
    if (selectedParty.partyType === "Debtor") return ["debtor"] as PartyLedgerKind[];
    if (selectedParty.partyType === "Creditor") return ["creditor"] as PartyLedgerKind[];
    return ["debtor", "creditor"] as PartyLedgerKind[];
  }, [selectedParty]);

  function onPartyChange(id: string) {
    setPartyId(id);
    const party = activeParties.find((p) => p.id === id);
    const nextKind = defaultKindForParty(party);
    setKind(nextKind);
  }

  function load() {
    if (!partyId) {
      setError("Select a party.");
      return;
    }
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ partyId, kind, from, to });
        const response = await fetch(`/api/party-ledger?${params}`);
        const json = (await response.json()) as PartyLedgerResult & { error?: string };
        if (!response.ok) {
          setError(json.error ?? "Failed to load party ledger.");
          setData(null);
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
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Party</span>
          <select
            value={partyId}
            onChange={(e) => onPartyChange(e.target.value)}
            className="field-input w-full"
          >
            <option value="">Select party…</option>
            {activeParties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name} ({party.partyType})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Ledger</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PartyLedgerKind)}
            className="field-input w-[140px]"
          >
            {kindOptions.map((option) => (
              <option key={option} value={option}>
                {option === "debtor" ? "Debtor" : "Creditor"}
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
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5">
          <div className="mb-4 border-b border-[var(--border)] pb-3">
            <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              {data.kind === "debtor" ? "Debtor Ledger" : "Creditor Ledger"}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {data.from} to {data.to}
            </div>
          </div>

          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Party
              </div>
              <div className="font-semibold">
                <OriginLink href={partyMasterHref(data.party.id)}>{data.party.name}</OriginLink>
              </div>
              <div className="text-xs text-[var(--muted)]">
                {[
                  data.party.ntn ? `NTN ${data.party.ntn}` : null,
                  data.party.phone,
                  data.party.partyType,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {data.party.address ? (
                <div className="mt-1 text-xs text-[var(--muted)]">{data.party.address}</div>
              ) : null}
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Control account
              </div>
              <div className="font-semibold">
                <OriginLink href={accountLedgerHref(data.account.code)}>
                  {data.account.code} — {data.account.name}
                </OriginLink>
              </div>
              <div className="text-xs text-[var(--muted)]">
                Opening {formatCurrency(data.opening.balance)} {data.opening.side} · Closing{" "}
                {formatCurrency(data.closing.balance)} {data.closing.side}
              </div>
            </div>
          </div>

          <table className="data-table w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Narration</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="font-semibold">
                  Opening balance
                </td>
                <td className="text-right font-mono text-xs">
                  {formatCurrency(data.opening.debit)}
                </td>
                <td className="text-right font-mono text-xs">
                  {formatCurrency(data.opening.credit)}
                </td>
                <td className="text-right font-mono text-xs">
                  {formatCurrency(data.opening.balance)} {data.opening.side === "Debit" ? "Dr" : "Cr"}
                </td>
              </tr>
              {data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-[var(--muted)]">
                    No posted transactions for this party in the selected period.
                  </td>
                </tr>
              ) : (
                data.transactions.map((txn) => (
                  <tr key={`${txn.voucherId}-${txn.voucherNo}-${txn.date}-${txn.debit}-${txn.credit}`}>
                    <td className="text-xs">{txn.date}</td>
                    <td className="font-semibold text-[var(--accent)]">
                      <OriginLink href={voucherHref(txn.voucherId)}>{txn.voucherNo}</OriginLink>
                    </td>
                    <td className="text-xs">{txn.voucherType}</td>
                    <td className="text-xs text-[var(--muted)]">{txn.referenceNo || "—"}</td>
                    <td className="text-xs">{txn.narration || "—"}</td>
                    <td className="text-right font-mono text-xs">
                      {txn.debit === "0.00" ? "—" : formatCurrency(txn.debit)}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {txn.credit === "0.00" ? "—" : formatCurrency(txn.credit)}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {formatCurrency(txn.runningBalance)}{" "}
                      {txn.runningSide === "Debit" ? "Dr" : "Cr"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="font-semibold">
                  Period totals ({data.period.count} lines)
                </td>
                <td className="text-right font-mono text-xs font-semibold">
                  {formatCurrency(data.period.debit)}
                </td>
                <td className="text-right font-mono text-xs font-semibold">
                  {formatCurrency(data.period.credit)}
                </td>
                <td className="text-right font-mono text-xs font-semibold">
                  {formatCurrency(data.closing.balance)}{" "}
                  {data.closing.side === "Debit" ? "Dr" : "Cr"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Select a party and click Apply to view and print the individual ledger.
        </p>
      )}
    </div>
  );
}
