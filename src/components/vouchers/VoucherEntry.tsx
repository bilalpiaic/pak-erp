"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PrintButton } from "@/components/print/PrintButton";
import { OriginLink } from "@/components/ui/OriginLink";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { VoucherForm } from "@/components/vouchers/VoucherForm";
import { VoucherImportModal } from "@/components/vouchers/VoucherImportModal";
import { VoucherRegisterPrint } from "@/components/vouchers/VoucherRegisterPrint";
import type { AccountDTO } from "@/lib/accounts/types";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
import { partyLedgerHref, voucherHref } from "@/lib/links";
import type { PartyDTO } from "@/lib/parties/types";
import {
  VOUCHER_TYPES,
  type VoucherDTO,
  type VoucherTypeValue,
} from "@/lib/vouchers/types";

type VoucherEntryProps = {
  initialVouchers: VoucherDTO[];
  accounts: AccountDTO[];
  parties?: PartyDTO[];
  company?: CompanyDTO | null;
  openVoucher?: VoucherDTO | null;
  openVoucherId?: string | null;
  loadError?: string | null;
};

type ViewState =
  | { kind: "list" }
  | {
      kind: "form";
      mode: "create" | "edit" | "view";
      voucherType: VoucherTypeValue;
      voucherNo: string;
      voucher?: VoucherDTO;
      autoPrint?: boolean;
    };

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f8efd9", color: "#9a6b12" },
  POSTED: { bg: "#e6f5ec", color: "#1f7a4c" },
  CANCELLED: { bg: "#fde8e6", color: "#b42318" },
};

export function VoucherEntry({
  initialVouchers,
  accounts,
  parties = [],
  company = null,
  openVoucher = null,
  openVoucherId = null,
  loadError = null,
}: VoucherEntryProps) {
  const router = useRouter();
  const { isAdmin } = useCurrentUser();
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [view, setView] = useState<ViewState>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    const targetId = openVoucher?.id ?? openVoucherId;
    const target =
      openVoucher ??
      (openVoucherId
        ? initialVouchers.find((v) => v.id === openVoucherId) ?? null
        : null);
    if (!target || !targetId) return;
    setView({
      kind: "form",
      mode: target.status === "DRAFT" ? "edit" : "view",
      voucherType: target.voucherType,
      voucherNo: target.voucherNo,
      voucher: target,
    });
  }, [openVoucher?.id, openVoucherId]); // eslint-disable-line react-hooks/exhaustive-deps -- open by id from deep link

  const filtered = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (typeFilter !== "All" && voucher.voucherType !== typeFilter) return false;
      if (statusFilter !== "All" && voucher.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        voucher.voucherNo.toLowerCase().includes(q) ||
        (voucher.partyName ?? "").toLowerCase().includes(q) ||
        (voucher.narration ?? "").toLowerCase().includes(q) ||
        (voucher.referenceNo ?? "").toLowerCase().includes(q)
      );
    });
  }, [vouchers, search, typeFilter, statusFilter]);

  function refresh() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/vouchers");
        const data = (await response.json()) as {
          vouchers?: VoucherDTO[];
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Failed to refresh vouchers.");
          return;
        }
        setVouchers(data.vouchers ?? []);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  async function openNew(type: VoucherTypeValue) {
    setError(null);
    try {
      const response = await fetch(`/api/vouchers?nextNumber=${type}`);
      const data = (await response.json()) as { voucherNo?: string; error?: string };
      if (!response.ok || !data.voucherNo) {
        setError(data.error ?? "Unable to allocate voucher number.");
        return;
      }
      setView({
        kind: "form",
        mode: "create",
        voucherType: type,
        voucherNo: data.voucherNo,
      });
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function unpostPosted(voucher: VoucherDTO) {
    if (
      !window.confirm(
        `Unpost ${voucher.voucherNo}? It will return to draft, drop out of ledgers, and can then be edited or deleted.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}/unpost`, {
        method: "POST",
      });
      const data = (await response.json()) as { voucher?: VoucherDTO; error?: string };
      if (!response.ok || !data.voucher) {
        setError(data.error ?? "Unable to unpost voucher.");
        return;
      }
      setMessage(`Unposted ${data.voucher.voucherNo} — now a draft`);
      setView({
        kind: "form",
        mode: "edit",
        voucherType: data.voucher.voucherType,
        voucherNo: data.voucher.voucherNo,
        voucher: data.voucher,
      });
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function deleteDraft(voucher: VoucherDTO) {
    if (!window.confirm(`Delete draft voucher ${voucher.voucherNo}? This cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to delete voucher.");
        return;
      }
      setMessage(`Deleted ${voucher.voucherNo}`);
      if (view.kind === "form") setView({ kind: "list" });
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function cancelPosted(voucher: VoucherDTO) {
    if (!window.confirm(`Cancel posted voucher ${voucher.voucherNo}?`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}/cancel`, {
        method: "POST",
      });
      const data = (await response.json()) as { voucher?: VoucherDTO; error?: string };
      if (!response.ok || !data.voucher) {
        setError(data.error ?? "Unable to cancel voucher.");
        return;
      }
      setMessage(`Cancelled ${data.voucher.voucherNo}`);
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  if (view.kind === "form") {
    return (
      <VoucherForm
        key={`${view.voucher?.id ?? "new"}-${view.mode}-${view.voucher?.status ?? "new"}`}
        mode={view.mode}
        voucherType={view.voucherType}
        voucherNo={view.voucherNo}
        initial={view.voucher}
        accounts={accounts}
        parties={parties}
        company={company}
        autoPrint={Boolean(view.autoPrint)}
        onBack={() => {
          setView({ kind: "list" });
          if (openVoucher || openVoucherId) {
            router.replace("/vouchers");
          }
        }}
        onSaved={(voucher) => {
          setMessage(
            voucher.status === "POSTED"
              ? `Posted ${voucher.voucherNo}`
              : `Draft saved ${voucher.voucherNo}`,
          );
          if (voucher.status === "DRAFT") {
            setView({
              kind: "form",
              mode: "edit",
              voucherType: voucher.voucherType,
              voucherNo: voucher.voucherNo,
              voucher,
            });
          } else {
            setView({ kind: "list" });
          }
          refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {VOUCHER_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => void openNew(type)}
              className="border border-[var(--accent)] bg-[var(--nav-active)] px-3 py-2 text-[11px] font-semibold text-[var(--accent)]"
            >
              + {type}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vouchers..."
            className="field-input sm:max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="field-input sm:w-28"
          >
            <option>All</option>
            {VOUCHER_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field-input sm:w-36"
          >
            <option>All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="POSTED">POSTED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <PrintButton disabled={filtered.length === 0} orientation="landscape" />
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="btn-secondary"
          >
            Import CSV
          </button>
          <span className="text-xs text-[var(--muted-strong)]">
            {pending ? "Refreshing…" : `${filtered.length} vouchers`}
          </span>
        </div>
      </div>

      {message ? (
        <p className="no-print text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="no-print text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="no-print overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Voucher No.</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Date</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Type</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Party</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Reference</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2 text-right">Amount</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Status</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No vouchers match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((voucher) => {
                const status = STATUS_STYLE[voucher.status] ?? STATUS_STYLE.DRAFT;
                return (
                  <tr
                    key={voucher.id}
                    className="border-b border-[var(--border)]/60 hover:bg-[rgba(26,37,64,0.45)]"
                  >
                    <td className="px-3 py-2 font-semibold text-[var(--accent)]">
                      <OriginLink href={voucherHref(voucher.id)}>{voucher.voucherNo}</OriginLink>
                    </td>
                    <td className="px-3 py-2 text-xs">{voucher.voucherDate}</td>
                    <td className="px-3 py-2">
                      <span className="bg-white border border-[var(--border-strong)] px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground)]">
                        {voucher.voucherType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {voucher.partyId && voucher.partyName ? (
                        <OriginLink
                          href={partyLedgerHref(
                            voucher.partyId,
                            voucher.voucherType === "BPV" || voucher.voucherType === "CPV"
                              ? "creditor"
                              : "debtor",
                          )}
                        >
                          {voucher.partyName}
                        </OriginLink>
                      ) : (
                        voucher.partyName || "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">
                      {voucher.referenceNo || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatCurrency(voucher.totalDebit)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {voucher.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setView({
                              kind: "form",
                              mode: voucher.status === "DRAFT" ? "edit" : "view",
                              voucherType: voucher.voucherType,
                              voucherNo: voucher.voucherNo,
                              voucher,
                            })
                          }
                          className="bg-white border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setView({
                              kind: "form",
                              mode: "view",
                              voucherType: voucher.voucherType,
                              voucherNo: voucher.voucherNo,
                              voucher,
                              autoPrint: true,
                            })
                          }
                          className="bg-white border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
                        >
                          Print
                        </button>
                        {isAdmin && voucher.status === "DRAFT" ? (
                          <button
                            type="button"
                            onClick={() => void deleteDraft(voucher)}
                            className="bg-[#3b1f1f] px-2.5 py-1 text-[11px] text-[#fca5a5]"
                          >
                            Delete
                          </button>
                        ) : null}
                        {isAdmin && voucher.status === "POSTED" ? (
                          <button
                            type="button"
                            onClick={() => void unpostPosted(voucher)}
                            className="bg-white border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
                          >
                            Unpost
                          </button>
                        ) : null}
                        {voucher.status === "POSTED" ? (
                          <button
                            type="button"
                            onClick={() => void cancelPosted(voucher)}
                            className="bg-[#3b1f1f] px-2.5 py-1 text-[11px] text-[#fca5a5]"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {showImport ? (
        <VoucherImportModal
          onClose={() => setShowImport(false)}
          onImported={(result) => {
            setMessage(
              `Imported ${result.created} voucher${result.created === 1 ? "" : "s"}` +
                (result.posted ? ` (${result.posted} posted)` : "") +
                (result.failed ? `, ${result.failed} failed` : ""),
            );
            refresh();
          }}
        />
      ) : null}
      <div className="print-only">
        <VoucherRegisterPrint
          vouchers={filtered}
          filters={[
            search.trim() ? `Search: ${search.trim()}` : null,
            typeFilter !== "All" ? `Type: ${typeFilter}` : null,
            statusFilter !== "All" ? `Status: ${statusFilter}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || null}
        />
      </div>
    </div>
  );
}
