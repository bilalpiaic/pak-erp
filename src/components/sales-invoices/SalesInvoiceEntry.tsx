"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PrintButton } from "@/components/print/PrintButton";
import { SalesInvoiceForm } from "@/components/sales-invoices/SalesInvoiceForm";
import { OriginLink } from "@/components/ui/OriginLink";
import { formatCurrency } from "@/lib/formatting/money";
import type { CompanyDTO } from "@/lib/company/types";
import { partyLedgerHref, salesInvoiceHref } from "@/lib/links";
import type { PartyDTO } from "@/lib/parties/types";
import type { SalesInvoiceDTO } from "@/lib/sales-invoices/types";

type SalesInvoiceEntryProps = {
  initialInvoices: SalesInvoiceDTO[];
  parties: PartyDTO[];
  company: CompanyDTO | null;
  openInvoice?: SalesInvoiceDTO | null;
  loadError?: string | null;
};

type ViewState =
  | { kind: "list" }
  | {
      kind: "form";
      mode: "create" | "edit" | "view";
      invoiceNo: string;
      invoice?: SalesInvoiceDTO;
      autoPrint?: boolean;
    };

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#f8efd9", color: "#9a6b12" },
  POSTED: { bg: "#e6f5ec", color: "#1f7a4c" },
  CANCELLED: { bg: "#fde8e6", color: "#b42318" },
};

export function SalesInvoiceEntry({
  initialInvoices,
  parties,
  company,
  openInvoice = null,
  loadError = null,
}: SalesInvoiceEntryProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [view, setView] = useState<ViewState>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!openInvoice) return;
    setView({
      kind: "form",
      mode: openInvoice.status === "DRAFT" ? "edit" : "view",
      invoiceNo: openInvoice.invoiceNo,
      invoice: openInvoice,
    });
  }, [openInvoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- open by id from deep link

  const filtered = useMemo(() => {
    return invoices.filter((invoice) => {
      if (statusFilter !== "All" && invoice.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        invoice.invoiceNo.toLowerCase().includes(q) ||
        invoice.partyName.toLowerCase().includes(q) ||
        (invoice.poNumber ?? "").toLowerCase().includes(q) ||
        (invoice.narration ?? "").toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  function refresh() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/sales-invoices");
        const data = (await response.json()) as {
          invoices?: SalesInvoiceDTO[];
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Failed to refresh sales invoices.");
          return;
        }
        setInvoices(data.invoices ?? []);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  async function openNew() {
    setError(null);
    try {
      const response = await fetch("/api/sales-invoices?nextNumber=1");
      const data = (await response.json()) as { invoiceNo?: string; error?: string };
      if (!response.ok || !data.invoiceNo) {
        setError(data.error ?? "Unable to allocate invoice number.");
        return;
      }
      setView({ kind: "form", mode: "create", invoiceNo: data.invoiceNo });
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function cancelPosted(invoice: SalesInvoiceDTO) {
    if (!window.confirm(`Cancel posted sales invoice ${invoice.invoiceNo}?`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/sales-invoices/${invoice.id}/cancel`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        invoice?: SalesInvoiceDTO;
        error?: string;
      };
      if (!response.ok || !data.invoice) {
        setError(data.error ?? "Unable to cancel sales invoice.");
        return;
      }
      setMessage(`Cancelled ${data.invoice.invoiceNo}`);
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  if (view.kind === "form") {
    return (
      <SalesInvoiceForm
        mode={view.mode}
        invoiceNo={view.invoiceNo}
        initial={view.invoice}
        parties={parties}
        company={company}
        autoPrint={Boolean(view.autoPrint)}
        onBack={() => {
          setView({ kind: "list" });
          if (openInvoice) {
            router.replace("/sales-invoices");
          }
        }}
        onSaved={(invoice) => {
          setMessage(
            invoice.status === "POSTED"
              ? `Posted ${invoice.invoiceNo} to debtor ledger`
              : `Draft saved ${invoice.invoiceNo}`,
          );
          if (invoice.status === "DRAFT") {
            setView({
              kind: "form",
              mode: "edit",
              invoiceNo: invoice.invoiceNo,
              invoice,
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
        <button
          type="button"
          onClick={() => void openNew()}
          className="border border-[var(--accent)] bg-[var(--nav-active)] px-3 py-2 text-[11px] font-semibold text-[var(--accent)]"
        >
          + New Sales Invoice
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice / party / PO…"
            className="field-input sm:max-w-xs"
          />
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
          <PrintButton disabled={filtered.length === 0} />
          <span className="text-xs text-[var(--muted-strong)]">
            {pending ? "Refreshing…" : `${filtered.length} invoices`}
          </span>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Invoice No.</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Date</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Party</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">PO #</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2 text-right">Amount</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Status</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No sales invoices yet. Create one to post Dr Debtors / Cr Sales.
                </td>
              </tr>
            ) : (
              filtered.map((invoice) => {
                const status = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.DRAFT;
                return (
                  <tr
                    key={invoice.id}
                    className="border-b border-[var(--border)]/60 hover:bg-[rgba(26,37,64,0.45)]"
                  >
                    <td className="px-3 py-2 font-semibold text-[var(--accent)]">
                      <OriginLink href={salesInvoiceHref(invoice.id)}>
                        {invoice.invoiceNo}
                      </OriginLink>
                    </td>
                    <td className="px-3 py-2 text-xs">{invoice.invoiceDate}</td>
                    <td className="px-3 py-2 text-sm">
                      <OriginLink href={partyLedgerHref(invoice.partyId, "debtor")}>
                        {invoice.partyName}
                      </OriginLink>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">
                      {invoice.poNumber || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setView({
                              kind: "form",
                              mode: invoice.status === "DRAFT" ? "edit" : "view",
                              invoiceNo: invoice.invoiceNo,
                              invoice,
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
                              invoiceNo: invoice.invoiceNo,
                              invoice,
                              autoPrint: true,
                            })
                          }
                          className="bg-white border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
                        >
                          Print
                        </button>
                        {invoice.status === "POSTED" ? (
                          <button
                            type="button"
                            onClick={() => void cancelPosted(invoice)}
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
    </div>
  );
}
