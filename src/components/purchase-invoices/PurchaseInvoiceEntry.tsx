"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { ItemLov } from "@/components/items/ItemLov";
import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import { OriginLink } from "@/components/ui/OriginLink";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { amountCentsFromQtyAndRate, toQtyUnits } from "@/lib/accounting/quantity";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
import type { ItemDTO } from "@/lib/items/types";
import { partyLedgerHref, purchaseInvoiceHref, stockLedgerHref, voucherHref } from "@/lib/links";
import type { PartyDTO } from "@/lib/parties/types";
import { companyPrintInfoFromDto } from "@/lib/print/company";
import type { PurchaseInvoiceDTO, PurchaseInvoiceInput } from "@/lib/purchase-invoices/types";

type LineDraft = { itemId: string; detail: string; quantity: string; rate: string; amount: string };

type Props = {
  initialInvoices: PurchaseInvoiceDTO[];
  parties: PartyDTO[];
  items: ItemDTO[];
  company: CompanyDTO | null;
  openInvoice?: PurchaseInvoiceDTO | null;
  loadError?: string | null;
};

function emptyLine(): LineDraft {
  return { itemId: "", detail: "", quantity: "", rate: "", amount: "" };
}

function computeAmount(quantity: string, rate: string): string {
  const q = toQtyUnits(quantity);
  const r = toQtyUnits(rate);
  if (q === null || r === null) return "";
  return centsToDecimalString(amountCentsFromQtyAndRate(q, r));
}

export function PurchaseInvoiceEntry({
  initialInvoices,
  parties,
  items,
  company,
  openInvoice = null,
  loadError = null,
}: Props) {
  const router = useRouter();
  const { isAdmin } = useCurrentUser();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saved, setSaved] = useState<PurchaseInvoiceDTO | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [error, setError] = useState<string | null>(loadError);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyId, setPartyId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);

  const creditors = useMemo(
    () => parties.filter((p) => p.isActive && p.partyType !== "Debtor").sort((a, b) => a.name.localeCompare(b.name)),
    [parties],
  );
  const selectedItemIds = useMemo(
    () => new Set(lines.map((line) => line.itemId).filter(Boolean)),
    [lines],
  );
  const stockItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (item.isActive && item.trackStock && item.category === "Consumable") ||
          selectedItemIds.has(item.id),
      ),
    [items, selectedItemIds],
  );

  useEffect(() => {
    if (!openInvoice) return;
    loadIntoForm(openInvoice, openInvoice.status === "DRAFT" ? "edit" : "view");
  }, [openInvoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        if (statusFilter !== "All" && invoice.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          invoice.invoiceNo.toLowerCase().includes(q) ||
          invoice.partyName.toLowerCase().includes(q) ||
          (invoice.billNo ?? "").toLowerCase().includes(q)
        );
      }),
    [invoices, search, statusFilter],
  );

  function refresh() {
    startTransition(async () => {
      const response = await fetch("/api/purchase-invoices");
      const data = (await response.json()) as { invoices?: PurchaseInvoiceDTO[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to refresh.");
        return;
      }
      setInvoices(data.invoices ?? []);
    });
  }

  function loadIntoForm(invoice: PurchaseInvoiceDTO, nextMode: "edit" | "view") {
    setSaved(invoice);
    setInvoiceNo(invoice.invoiceNo);
    setInvoiceDate(invoice.invoiceDate);
    setPartyId(invoice.partyId);
    setBillNo(invoice.billNo ?? "");
    setNarration(invoice.narration ?? "");
    setLines(
      invoice.lines.length
        ? invoice.lines.map((line) => ({
            itemId: line.itemId,
            detail: line.detail ?? "",
            quantity: line.quantity,
            rate: line.rate,
            amount: line.amount,
          }))
        : [emptyLine()],
    );
    setFormMode(nextMode);
    setMode("form");
    setError(null);
  }

  async function openCreate() {
    const response = await fetch("/api/purchase-invoices?nextNumber=1");
    const data = (await response.json()) as { invoiceNo?: string };
    setSaved(null);
    setInvoiceNo(data.invoiceNo ?? "PI-…");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setPartyId("");
    setBillNo("");
    setNarration("");
    setLines([emptyLine(), emptyLine()]);
    setFormMode("create");
    setMode("form");
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => {
      const next = [...prev];
      const row = { ...next[index], ...patch };
      if (patch.quantity !== undefined || patch.rate !== undefined) {
        row.amount = computeAmount(row.quantity, row.rate);
      }
      next[index] = row;
      return next;
    });
  }

  function buildPayload(): PurchaseInvoiceInput {
    return {
      invoiceDate,
      partyId,
      billNo,
      narration,
      lines: lines
        .filter((line) => line.itemId || line.quantity || line.rate)
        .map((line) => ({
          itemId: line.itemId,
          detail: line.detail,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount || computeAmount(line.quantity, line.rate),
        })),
    };
  }

  async function save(action: "draft" | "post") {
    setError(null);
    try {
      const payload = buildPayload();
      const existingId = saved?.id;
      let invoice: PurchaseInvoiceDTO | undefined;
      if (!existingId) {
        const response = await fetch("/api/purchase-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, post: action === "post" }),
        });
        const data = (await response.json()) as { invoice?: PurchaseInvoiceDTO; error?: string };
        if (!response.ok || !data.invoice) {
          setError(data.error ?? "Save failed.");
          return;
        }
        invoice = data.invoice;
      } else {
        const patch = await fetch(`/api/purchase-invoices/${existingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await patch.json()) as { invoice?: PurchaseInvoiceDTO; error?: string };
        if (!patch.ok || !data.invoice) {
          setError(data.error ?? "Update failed.");
          return;
        }
        invoice = data.invoice;
        if (action === "post") {
          const posted = await fetch(`/api/purchase-invoices/${invoice.id}/post`, { method: "POST" });
          const postData = (await posted.json()) as { invoice?: PurchaseInvoiceDTO; error?: string };
          if (!posted.ok || !postData.invoice) {
            setError(postData.error ?? "Post failed.");
            return;
          }
          invoice = postData.invoice;
        }
      }
      setSaved(invoice);
      setMessage(action === "post" ? "Purchase invoice posted." : "Draft saved.");
      refresh();
      if (action === "post") setFormMode("view");
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function act(path: string, okMessage: string) {
    if (!saved) return;
    const response = await fetch(`/api/purchase-invoices/${saved.id}/${path}`, { method: "POST" });
    const data = (await response.json()) as { invoice?: PurchaseInvoiceDTO; error?: string };
    if (!response.ok || !data.invoice) {
      setError(data.error ?? "Action failed.");
      return;
    }
    setSaved(data.invoice);
    setMessage(okMessage);
    setFormMode(data.invoice.status === "DRAFT" ? "edit" : "view");
    refresh();
  }

  const status = saved?.status ?? "DRAFT";
  const readOnly = formMode === "view" || status === "POSTED" || status === "CANCELLED";
  const totalCents = lines.reduce((sum, line) => sum + (toCents(line.amount) ?? 0), 0);
  const selectedParty = creditors.find((p) => p.id === partyId);

  if (mode === "form") {
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setMode("list"); router.replace("/purchase-invoices"); }}>
            Back
          </button>
          <span className="font-semibold">{invoiceNo}</span>
          <span className="text-xs text-[var(--muted)]">{status}</span>
          {!readOnly ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => void save("draft")}>Save draft</button>
              <button type="button" className="btn-primary" onClick={() => void save("post")}>Post</button>
            </>
          ) : null}
          {status === "POSTED" && isAdmin ? (
            <button type="button" className="btn-secondary" onClick={() => void act("unpost", "Unposted.")}>Unpost</button>
          ) : null}
          {status === "POSTED" ? (
            <button type="button" className="btn-secondary" onClick={() => void act("cancel", "Cancelled.")}>Cancel</button>
          ) : null}
          <PrintButton orientation="portrait" />
        </div>
        {error ? <p className="no-print border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="no-print border border-emerald-200 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">{message}</p> : null}

        <div className="no-print grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-xs">
            <span className="mb-1 block text-[var(--muted-strong)]">Date</span>
            <input type="date" className="field-input w-full" disabled={readOnly} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-[var(--muted-strong)]">Supplier</span>
            <select className="field-input w-full" disabled={readOnly} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">Select creditor…</option>
              {creditors.map((party) => (
                <option key={party.id} value={party.id}>{party.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-[var(--muted-strong)]">Supplier bill #</span>
            <input className="field-input w-full" disabled={readOnly} value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </label>
        </div>

        <div className="no-print overflow-auto border border-[var(--border)]">
          <table className="w-full min-w-[780px] text-left">
            <thead>
              <tr className="text-[11px] uppercase text-[var(--accent)]">
                <th className="bg-[var(--table-head)] px-3 py-2">Item</th>
                <th className="bg-[var(--table-head)] px-3 py-2">Detail</th>
                <th className="bg-[var(--table-head)] px-3 py-2 text-right">Qty</th>
                <th className="bg-[var(--table-head)] px-3 py-2 text-right">Rate</th>
                <th className="bg-[var(--table-head)] px-3 py-2 text-right">Amount</th>
                <th className="bg-[var(--table-head)] px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-[var(--border)]/60">
                  <td className="px-2 py-1.5">
                    <ItemLov
                      items={stockItems}
                      value={line.itemId}
                      disabled={readOnly}
                      onChange={(itemId) => updateLine(index, { itemId })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="field-input w-full" disabled={readOnly} value={line.detail} onChange={(e) => updateLine(index, { detail: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="field-input w-full text-right font-mono" disabled={readOnly} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="field-input w-full text-right font-mono" disabled={readOnly} value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="field-input w-full text-right font-mono" value={line.amount} disabled readOnly />
                  </td>
                  <td className="px-2 py-1.5">
                    {!readOnly ? (
                      <button type="button" className="text-[11px] text-[var(--danger)]" onClick={() => setLines((prev) => prev.length <= 1 ? [emptyLine()] : prev.filter((_, i) => i !== index))}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly ? (
          <button type="button" className="no-print border border-[var(--border-strong)] bg-white px-3 py-2 text-[11px] font-semibold" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            + Add line
          </button>
        ) : null}
        <p className="text-right font-semibold">{formatCurrency(centsToDecimalString(totalCents))}</p>

        <div className={readOnly ? "" : "print-only"}>
          <div className="print-sheet print-sheet-portrait border border-[var(--border)] bg-[var(--panel)] p-4">
            <table className="print-table w-full border-collapse">
              <PrintThead
                colSpan={6}
                banner={
                  <PrintLetterhead
                    company={companyPrintInfoFromDto(company)}
                    title="Purchase Invoice"
                    subtitle={status}
                    extra={`${invoiceNo} · ${invoiceDate}${billNo ? ` · Bill ${billNo}` : ""}`}
                  />
                }
              >
                <th>#</th>
                <th>Item</th>
                <th>Detail</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </PrintThead>
              <tbody>
                {lines.filter((l) => l.itemId).map((line, index) => {
                  const item = stockItems.find((row) => row.id === line.itemId);
                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{item ? `${item.sku} ${item.name}` : line.itemId}</td>
                      <td>{line.detail || "—"}</td>
                      <td className="num">{line.quantity}</td>
                      <td className="num"><PrintAmount value={line.rate} /></td>
                      <td className="num"><PrintAmount value={line.amount} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right font-semibold">Total</td>
                  <td className="num font-semibold"><PrintAmount value={centsToDecimalString(totalCents)} /></td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-2 text-sm">
              Supplier: {selectedParty?.name ?? saved?.partyName ?? "—"}
              {saved?.voucherNo ? (
                <> · Voucher {saved.voucherId ? <OriginLink href={voucherHref(saved.voucherId)}>{saved.voucherNo}</OriginLink> : saved.voucherNo}</>
              ) : null}
            </p>
            <PrintSignatures />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <label className="block min-w-[180px] flex-1">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Search</span>
          <input className="field-input w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="field-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {["All", "DRAFT", "POSTED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button type="button" className="btn-primary" onClick={() => void openCreate()}>New purchase invoice</button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>Refresh</button>
        <PrintButton orientation="landscape" />
      </div>
      {error ? <p className="no-print border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="no-print border border-emerald-200 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">{message}</p> : null}
      <div className="no-print overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[var(--accent)]">
              <th className="bg-[var(--table-head)] px-3 py-2">No</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Date</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Party</th>
              <th className="bg-[var(--table-head)] px-3 py-2 text-right">Amount</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((invoice) => (
              <tr key={invoice.id} className="border-b border-[var(--border)]/60">
                <td className="px-3 py-2">
                  <OriginLink href={purchaseInvoiceHref(invoice.id)}>
                    {invoice.invoiceNo}
                  </OriginLink>
                </td>
                <td className="px-3 py-2">{invoice.invoiceDate}</td>
                <td className="px-3 py-2">
                  <OriginLink href={partyLedgerHref(invoice.partyId, "creditor")}>{invoice.partyName}</OriginLink>
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(invoice.totalAmount)}</td>
                <td className="px-3 py-2">{invoice.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
