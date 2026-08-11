"use client";

import { useMemo, useState } from "react";

import { centsToDecimalString, isBalanced, sumCents, toCents } from "@/lib/accounting/money";
import type { AccountDTO } from "@/lib/accounts/types";
import { formatCurrency } from "@/lib/formatting/money";
import {
  VOUCHER_TYPE_LABELS,
  type VoucherDTO,
  type VoucherInput,
  type VoucherTypeValue,
} from "@/lib/vouchers/types";

type LineDraft = {
  accountId: string;
  debit: string;
  credit: string;
  lineNarration: string;
};

type VoucherFormProps = {
  mode: "create" | "edit" | "view";
  voucherType: VoucherTypeValue;
  voucherNo: string;
  initial?: VoucherDTO | null;
  accounts: AccountDTO[];
  onBack: () => void;
  onSaved: (voucher: VoucherDTO) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function VoucherForm({
  mode,
  voucherType,
  voucherNo,
  initial,
  accounts,
  onBack,
  onSaved,
}: VoucherFormProps) {
  const readOnly =
    mode === "view" || initial?.status === "POSTED" || initial?.status === "CANCELLED";
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  const [voucherDate, setVoucherDate] = useState(initial?.voucherDate ?? todayIso());
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [partyName, setPartyName] = useState(initial?.partyName ?? "");
  const [narration, setNarration] = useState(initial?.narration ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.lines.length
      ? initial.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit === "0.00" ? "" : line.debit,
          credit: line.credit === "0.00" ? "" : line.credit,
          lineNarration: line.lineNarration ?? "",
        }))
      : [
          { accountId: "", debit: "", credit: "", lineNarration: "" },
          { accountId: "", debit: "", credit: "", lineNarration: "" },
        ],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const totalDebitCents = sumCents(lines.map((l) => l.debit));
  const totalCreditCents = sumCents(lines.map((l) => l.credit));
  const balanced = isBalanced(totalDebitCents, totalCreditCents) && totalDebitCents > 0;

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    setLines((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === "debit" && value) row.credit = "";
      if (field === "credit" && value) row.debit = "";
      next[index] = row;
      return next;
    });
    setError(null);
  }

  function buildPayload(): VoucherInput {
    return {
      voucherType,
      voucherDate,
      referenceNo,
      partyName,
      narration,
      lines: lines
        .filter(
          (line) =>
            line.accountId &&
            ((toCents(line.debit) ?? 0) > 0 || (toCents(line.credit) ?? 0) > 0),
        )
        .map((line) => ({
          accountId: line.accountId,
          debit: line.debit || "0",
          credit: line.credit || "0",
          lineNarration: line.lineNarration,
        })),
    };
  }

  async function save(action: "draft" | "post") {
    setPending(true);
    setError(null);
    try {
      const payload = buildPayload();

      if (action === "post" && !balanced) {
        setError("Debit must equal Credit to post.");
        return;
      }

      let voucher: VoucherDTO | undefined;

      if (mode === "create") {
        const response = await fetch("/api/vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, post: action === "post" }),
        });
        const data = (await response.json()) as { voucher?: VoucherDTO; error?: string };
        if (!response.ok || !data.voucher) {
          setError(data.error ?? "Unable to save voucher.");
          return;
        }
        voucher = data.voucher;
      } else if (initial) {
        const patchResponse = await fetch(`/api/vouchers/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const patchData = (await patchResponse.json()) as {
          voucher?: VoucherDTO;
          error?: string;
        };
        if (!patchResponse.ok || !patchData.voucher) {
          setError(patchData.error ?? "Unable to update voucher.");
          return;
        }
        voucher = patchData.voucher;

        if (action === "post") {
          const postResponse = await fetch(`/api/vouchers/${initial.id}/post`, {
            method: "POST",
          });
          const postData = (await postResponse.json()) as {
            voucher?: VoucherDTO;
            error?: string;
          };
          if (!postResponse.ok || !postData.voucher) {
            setError(postData.error ?? "Unable to post voucher.");
            return;
          }
          voucher = postData.voucher;
        }
      }

      if (voucher) onSaved(voucher);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--accent)]">
            {VOUCHER_TYPE_LABELS[voucherType]}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {voucherNo} · {initial?.status ?? "NEW"}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--muted)]"
        >
          ← Back to List
        </button>
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Voucher No.
            </span>
            <input value={voucherNo} readOnly className="field-input opacity-80" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Date
            </span>
            <input
              type="date"
              value={voucherDate}
              disabled={readOnly}
              onChange={(e) => setVoucherDate(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Reference No.
            </span>
            <input
              value={referenceNo}
              disabled={readOnly}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="block md:col-span-1">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Party Name
            </span>
            <input
              value={partyName}
              disabled={readOnly}
              onChange={(e) => setPartyName(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Narration
            </span>
            <input
              value={narration}
              disabled={readOnly}
              onChange={(e) => setNarration(e.target.value)}
              className="field-input"
            />
          </label>
        </div>
      </div>

      <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2 text-right">Debit (₨)</th>
              <th className="px-3 py-2 text-right">Credit (₨)</th>
              <th className="px-3 py-2">Line Narration</th>
              {!readOnly ? <th className="px-3 py-2">Del</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const account = accounts.find((a) => a.id === line.accountId);
              return (
                <tr key={index} className="border-b border-[var(--border)]/50">
                  <td className="px-3 py-2 text-xs text-[var(--muted-strong)]">{index + 1}</td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <div>
                        <div className="font-mono text-xs text-[var(--accent)]">
                          {account?.code}
                        </div>
                        <div className="text-xs text-[var(--muted)]">{account?.name}</div>
                      </div>
                    ) : (
                      <select
                        value={line.accountId}
                        onChange={(e) => updateLine(index, "accountId", e.target.value)}
                        className="field-input"
                      >
                        <option value="">-- Select --</option>
                        {activeAccounts.map((accountOption) => (
                          <option key={accountOption.id} value={accountOption.id}>
                            {accountOption.code} — {accountOption.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={readOnly}
                      value={line.debit}
                      onChange={(e) => updateLine(index, "debit", e.target.value)}
                      className="field-input text-right font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={readOnly}
                      value={line.credit}
                      onChange={(e) => updateLine(index, "credit", e.target.value)}
                      className="field-input text-right font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      disabled={readOnly}
                      value={line.lineNarration}
                      onChange={(e) => updateLine(index, "lineNarration", e.target.value)}
                      className="field-input"
                      placeholder="Line detail"
                    />
                  </td>
                  {!readOnly ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                        className="bg-[#3b1f1f] px-2 py-1 text-[11px] text-[#fca5a5]"
                      >
                        ✕
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            <tr className="bg-[#1a2540]">
              <td
                colSpan={2}
                className="px-3 py-2 text-right text-xs font-semibold text-[var(--accent)]"
              >
                TOTALS
              </td>
              <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-[var(--success)]">
                {formatCurrency(centsToDecimalString(totalDebitCents))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-[#fca5a5]">
                {formatCurrency(centsToDecimalString(totalCreditCents))}
              </td>
              <td colSpan={readOnly ? 1 : 2} className="px-3 py-2 text-center">
                {balanced ? (
                  <span className="bg-[var(--success-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--success)]">
                    ✓ Balanced
                  </span>
                ) : (
                  <span className="bg-[#7f1d1d] px-2 py-1 text-[11px] font-semibold text-[#fca5a5]">
                    Diff:{" "}
                    {formatCurrency(
                      centsToDecimalString(Math.abs(totalDebitCents - totalCreditCents)),
                    )}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { accountId: "", debit: "", credit: "", lineNarration: "" },
              ])
            }
            className="bg-[#1e3060] px-3 py-2 text-xs text-[#93c5fd]"
          >
            + Add Line
          </button>
          <div className="flex-1" />
          <button
            type="button"
            disabled={pending}
            onClick={() => void save("draft")}
            className="bg-[var(--warning-bg)] px-4 py-2 text-xs font-semibold text-[var(--warning)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            disabled={pending || !balanced}
            onClick={() => void save("post")}
            className="bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#0a1628] disabled:bg-[#3d3d3d] disabled:text-[#666]"
          >
            {balanced ? "✓ Post Voucher" : "Post (Balance First)"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
