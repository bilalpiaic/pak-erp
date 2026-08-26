"use client";

import { useEffect, useMemo, useState } from "react";

import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { AccountLov } from "@/components/accounts/AccountLov";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { PartyCreateModal } from "@/components/parties/PartyCreateModal";
import { PrintButton } from "@/components/print/PrintButton";
import { VoucherAttachmentsPanel } from "@/components/vouchers/VoucherAttachmentsPanel";
import { VoucherPrint } from "@/components/vouchers/VoucherPrint";
import { centsToDecimalString, isBalanced, sumCents, toCents } from "@/lib/accounting/money";
import type { AccountDTO } from "@/lib/accounts/types";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
import type { PartyDTO } from "@/lib/parties/types";
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
  parties?: PartyDTO[];
  company?: CompanyDTO | null;
  autoPrint?: boolean;
  onBack: () => void;
  onSaved: (voucher: VoucherDTO) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isReceiptType(type: VoucherTypeValue): boolean {
  return type === "BRV" || type === "CRV";
}

function pickReceiptDebitAccount(
  voucherType: VoucherTypeValue,
  accounts: AccountDTO[],
): AccountDTO | undefined {
  const cashBank = accounts.filter((a) => a.isActive && a.bsSection === "CashAndBank");
  if (voucherType === "CRV") {
    return cashBank.find((a) => a.code === "1001") ?? cashBank[0];
  }
  if (voucherType === "BRV") {
    return (
      cashBank.find((a) => a.code === "1002") ??
      cashBank.find((a) => a.code !== "1001") ??
      cashBank[0]
    );
  }
  return undefined;
}

function defaultLines(
  voucherType: VoucherTypeValue,
  accounts: AccountDTO[],
  initial?: VoucherDTO | null,
): LineDraft[] {
  if (initial?.lines.length) {
    return initial.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.debit === "0.00" ? "" : line.debit,
      credit: line.credit === "0.00" ? "" : line.credit,
      lineNarration: line.lineNarration ?? "",
    }));
  }
  if (isReceiptType(voucherType)) {
    const debitAccount = pickReceiptDebitAccount(voucherType, accounts);
    return [
      { accountId: debitAccount?.id ?? "", debit: "", credit: "", lineNarration: "" },
      { accountId: "", debit: "", credit: "", lineNarration: "" },
    ];
  }
  return [
    { accountId: "", debit: "", credit: "", lineNarration: "" },
    { accountId: "", debit: "", credit: "", lineNarration: "" },
  ];
}

export function VoucherForm({
  mode,
  voucherType,
  voucherNo,
  initial,
  accounts: initialAccounts,
  parties: initialParties = [],
  company = null,
  autoPrint = false,
  onBack,
  onSaved,
}: VoucherFormProps) {
  const { isAdmin } = useCurrentUser();

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const [partyOptions, setPartyOptions] = useState(initialParties);
  const [accountOptions, setAccountOptions] = useState(initialAccounts);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [accountModalLine, setAccountModalLine] = useState<number | null>(null);
  const [autoDebtorAccountId, setAutoDebtorAccountId] = useState<string | null>(
    null,
  );
  const [partyId, setPartyId] = useState(initial?.partyId ?? "");

  const activeAccounts = useMemo(
    () =>
      accountOptions.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [accountOptions],
  );
  const activeParties = useMemo(
    () =>
      partyOptions.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [partyOptions],
  );
  const partiesForVoucher = useMemo(() => {
    let list =
      voucherType === "BRV" || voucherType === "CRV"
        ? activeParties.filter((p) => p.partyType !== "Creditor")
        : voucherType === "BPV" || voucherType === "CPV"
          ? activeParties.filter((p) => p.partyType !== "Debtor")
          : activeParties;
    if (partyId && !list.some((p) => p.id === partyId)) {
      const extra = activeParties.find((p) => p.id === partyId);
      if (extra) list = [...list, extra];
    }
    return list;
  }, [activeParties, voucherType, partyId]);

  const [voucherDate, setVoucherDate] = useState(initial?.voucherDate ?? todayIso());
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [partyName, setPartyName] = useState(initial?.partyName ?? "");
  const [partyNtn, setPartyNtn] = useState(initial?.partyNtn ?? "");
  const [whtApplicable, setWhtApplicable] = useState(Boolean(initial?.whtApplicable));
  const [narration, setNarration] = useState(initial?.narration ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    defaultLines(voucherType, initialAccounts, initial),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState<VoucherDTO | null>(initial ?? null);
  const status = savedVoucher?.status ?? initial?.status ?? "DRAFT";
  const readOnly = mode === "view" || status === "POSTED" || status === "CANCELLED";
  const existingId = savedVoucher?.id ?? initial?.id ?? null;

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
      partyId: partyId || null,
      partyName,
      partyNtn,
      whtApplicable,
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

  function applyNamedDebtorCredit(accountId: string) {
    const cashBankIds = new Set(
      accountOptions.filter((a) => a.bsSection === "CashAndBank").map((a) => a.id),
    );
    setLines((prev) => {
      const next = prev.map((line) => ({ ...line }));
      let idx = next.findIndex((line) => line.accountId === autoDebtorAccountId);
      if (idx < 0) {
        idx = next.findIndex(
          (line, i) =>
            i > 0 &&
            !cashBankIds.has(line.accountId) &&
            !line.debit &&
            (line.accountId === "" || i === 1),
        );
      }
      if (idx < 0) {
        next.push({ accountId, debit: "", credit: "", lineNarration: "" });
      } else {
        next[idx] = { ...next[idx], accountId };
      }
      return next;
    });
    setAutoDebtorAccountId(accountId);
  }

  async function attachDebtorAccount(party: PartyDTO) {
    if (!isReceiptType(voucherType) || party.partyType === "Creditor") return;
    try {
      const response = await fetch(`/api/parties/${party.id}/debtor-account`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        party?: PartyDTO;
        account?: AccountDTO;
        error?: string;
      };
      if (!response.ok || !data.party?.accountId || !data.account) {
        setError(data.error ?? "Unable to create named debtor account.");
        return;
      }
      setPartyOptions((prev) => prev.map((p) => (p.id === party.id ? data.party! : p)));
      setAccountOptions((prev) =>
        prev.some((a) => a.id === data.account!.id) ? prev : [...prev, data.account!],
      );
      applyNamedDebtorCredit(data.party.accountId);
    } catch {
      setError("Unable to attach named debtor account.");
    }
  }

  function selectParty(id: string) {
    setPartyId(id);
    const party = activeParties.find((p) => p.id === id);
    if (party) {
      setPartyName(party.name);
      setPartyNtn(party.ntn ?? "");
      void attachDebtorAccount(party);
    } else {
      setAutoDebtorAccountId(null);
    }
  }

  function handlePartyCreated(party: PartyDTO) {
    setPartyOptions((prev) =>
      prev.some((p) => p.id === party.id) ? prev : [...prev, party],
    );
    setPartyId(party.id);
    setPartyName(party.name);
    setPartyNtn(party.ntn ?? "");
    setShowPartyModal(false);
    void attachDebtorAccount(party);
  }

  function handleAccountCreated(account: AccountDTO) {
    setAccountOptions((prev) =>
      prev.some((a) => a.id === account.id) ? prev : [...prev, account],
    );
    if (accountModalLine !== null && accountModalLine >= 0) {
      updateLine(accountModalLine, "accountId", account.id);
    }
    setAccountModalLine(null);
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
      const existingId = savedVoucher?.id ?? initial?.id;

      if (!existingId) {
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
      } else {
        const patchResponse = await fetch(`/api/vouchers/${existingId}`, {
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
          const postResponse = await fetch(`/api/vouchers/${existingId}/post`, {
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

      if (voucher) {
        setSavedVoucher(voucher);
        onSaved(voucher);
      }
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  async function unpost() {
    if (!existingId) return;
    if (
      !window.confirm(
        `Unpost ${voucherNo}? It will return to draft and drop out of ledgers until you post it again.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/${existingId}/unpost`, { method: "POST" });
      const data = (await response.json()) as { voucher?: VoucherDTO; error?: string };
      if (!response.ok || !data.voucher) {
        setError(data.error ?? "Unable to unpost voucher.");
        return;
      }
      setSavedVoucher(data.voucher);
      onSaved(data.voucher);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  async function removeDraft() {
    if (!existingId) return;
    if (!window.confirm(`Delete draft voucher ${voucherNo}? This cannot be undone.`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/${existingId}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to delete voucher.");
        return;
      }
      onBack();
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--accent)]">
            {VOUCHER_TYPE_LABELS[voucherType]}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {voucherNo} · {savedVoucher?.status ?? initial?.status ?? "NEW"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          {isAdmin && status === "POSTED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void unpost()}
              className="border border-[var(--border-strong)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] disabled:opacity-60"
            >
              {pending ? "Unposting…" : "Unpost to edit"}
            </button>
          ) : null}
          {isAdmin && status === "DRAFT" && existingId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void removeDraft()}
              className="bg-[#3b1f1f] px-3 py-2 text-xs font-semibold text-[#fca5a5] disabled:opacity-60"
            >
              Delete draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            className="border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--muted)]"
          >
            ← Back to List
          </button>
        </div>
      </div>

      <div className="no-print border border-[var(--border)] bg-[var(--panel)] p-4">
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
          <div className="block md:col-span-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Party (master)
              </span>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  className="text-[10px] font-semibold text-[var(--accent)] hover:underline"
                >
                  + New party
                </button>
              ) : null}
            </div>
            <select
              value={partyId}
              disabled={readOnly}
              onChange={(e) => selectParty(e.target.value)}
              className="field-input"
            >
              <option value="">— Free-text / none —</option>
              {partiesForVoucher.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.partyType}
                  {p.accountCode ? ` · ${p.accountCode}` : ""})
                </option>
              ))}
            </select>
            {isReceiptType(voucherType) ? (
              <p className="mt-1 text-[10px] text-[var(--muted-strong)]">
                Debtor party credits their named COA (1010-001 …), not control 1010.
              </p>
            ) : null}
          </div>
          <label className="block md:col-span-1">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Party Name
            </span>
            <input
              value={partyName}
              disabled={readOnly}
              onChange={(e) => {
                setPartyName(e.target.value);
                setPartyId("");
              }}
              className="field-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              NTN / CNIC
            </span>
            <input
              value={partyNtn}
              disabled={readOnly}
              onChange={(e) => setPartyNtn(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={whtApplicable}
              disabled={readOnly}
              onChange={(e) => setWhtApplicable(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[12px] text-[var(--muted)]">WHT applicable</span>
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

      <div className="no-print overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span>Account (LOV / F5)</span>
                  {!readOnly && isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setAccountModalLine(-1)}
                      className="normal-case tracking-normal text-[10px] font-semibold text-[var(--accent)] hover:underline"
                    >
                      + New account
                    </button>
                  ) : null}
                </div>
              </th>
              <th className="px-3 py-2 text-right">Debit (₨)</th>
              <th className="px-3 py-2 text-right">Credit (₨)</th>
              <th className="px-3 py-2">Line Narration</th>
              {!readOnly ? <th className="px-3 py-2">Del</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const account = accountOptions.find((a) => a.id === line.accountId);
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
                      <div className="flex items-center gap-1">
                        <AccountLov
                          accounts={activeAccounts}
                          value={line.accountId}
                          onChange={(accountId) =>
                            updateLine(index, "accountId", accountId)
                          }
                        />
                        {isAdmin ? (
                          <button
                            type="button"
                            title="New account for this line"
                            onClick={() => setAccountModalLine(index)}
                            className="shrink-0 border border-[var(--border-strong)] bg-white px-2 py-2 text-[11px] font-semibold text-[var(--accent)]"
                          >
                            +
                          </button>
                        ) : null}
                      </div>
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
            <tr className="bg-[var(--table-head)]">
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
        <p className="no-print text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="no-print">
        <VoucherAttachmentsPanel
          voucherId={savedVoucher?.id ?? initial?.id ?? null}
          status={savedVoucher?.status ?? initial?.status ?? "DRAFT"}
          initialAttachments={savedVoucher?.attachments ?? initial?.attachments ?? []}
          readOnly={
            (savedVoucher?.status ?? initial?.status) === "CANCELLED" || mode === "view"
          }
        />
      </div>

      {!readOnly ? (
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { accountId: "", debit: "", credit: "", lineNarration: "" },
              ])
            }
            className="bg-white border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--foreground)]"
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
            className="bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] disabled:opacity-60"
          >
            {balanced ? "✓ Post Voucher" : "Post (Balance First)"}
          </button>
        </div>
      ) : null}

      <div className={readOnly ? "" : "print-only"}>
        <VoucherPrint
          company={company}
          voucherNo={voucherNo}
          voucherType={voucherType}
          voucherDate={voucherDate}
          referenceNo={referenceNo}
          partyId={partyId || null}
          partyName={partyName}
          partyNtn={partyNtn}
          partyKind={
            voucherType === "BPV" || voucherType === "CPV" ? "creditor" : "debtor"
          }
          whtApplicable={whtApplicable}
          narration={narration}
          status={savedVoucher?.status ?? initial?.status ?? "DRAFT"}
          lines={lines
            .filter(
              (line) =>
                line.accountId &&
                ((toCents(line.debit) ?? 0) > 0 || (toCents(line.credit) ?? 0) > 0),
            )
            .map((line) => {
              const account = accountOptions.find((a) => a.id === line.accountId);
              return {
                accountCode: account?.code ?? "",
                accountName: account?.name ?? "",
                debit: line.debit || "0.00",
                credit: line.credit || "0.00",
                lineNarration: line.lineNarration,
              };
            })}
          totalDebit={centsToDecimalString(totalDebitCents)}
          totalCredit={centsToDecimalString(totalCreditCents)}
        />
      </div>

      {showPartyModal ? (
        <PartyCreateModal
          defaultPartyType={
            voucherType === "BPV" || voucherType === "CPV" ? "Creditor" : "Debtor"
          }
          allowedTypes={
            voucherType === "BRV" || voucherType === "CRV"
              ? ["Debtor", "Both"]
              : voucherType === "BPV" || voucherType === "CPV"
                ? ["Creditor", "Both"]
                : undefined
          }
          onClose={() => setShowPartyModal(false)}
          onCreated={handlePartyCreated}
        />
      ) : null}

      {accountModalLine !== null ? (
        <AccountFormModal
          mode="create"
          onClose={() => setAccountModalLine(null)}
          onSaved={handleAccountCreated}
        />
      ) : null}
    </div>
  );
}
