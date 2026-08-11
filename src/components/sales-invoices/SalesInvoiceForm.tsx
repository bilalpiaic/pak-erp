"use client";

import { useMemo, useState } from "react";

import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { formatCurrency } from "@/lib/formatting/money";
import type { PartyDTO } from "@/lib/parties/types";
import type {
  SalesInvoiceDTO,
  SalesInvoiceInput,
} from "@/lib/sales-invoices/types";
import { toQuantityOrRate } from "@/lib/sales-invoices/validation";

type LineDraft = {
  item: string;
  detail: string;
  quantity: string;
  rate: string;
  amount: string;
};

type SalesInvoiceFormProps = {
  mode: "create" | "edit" | "view";
  invoiceNo: string;
  initial?: SalesInvoiceDTO | null;
  parties: PartyDTO[];
  onBack: () => void;
  onSaved: (invoice: SalesInvoiceDTO) => void;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): LineDraft {
  return { item: "", detail: "", quantity: "", rate: "", amount: "" };
}

function computeAmount(quantity: string, rate: string): string {
  const q = toQuantityOrRate(quantity);
  const r = toQuantityOrRate(rate);
  if (q === null || r === null) return "";
  return centsToDecimalString(Math.round(q * r * 100));
}

export function SalesInvoiceForm({
  mode,
  invoiceNo,
  initial,
  parties,
  onBack,
  onSaved,
}: SalesInvoiceFormProps) {
  const readOnly =
    mode === "view" || initial?.status === "POSTED" || initial?.status === "CANCELLED";

  const debtorParties = useMemo(
    () =>
      parties
        .filter((p) => p.isActive && p.partyType !== "Creditor")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [parties],
  );

  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? todayIso());
  const [partyId, setPartyId] = useState(initial?.partyId ?? "");
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? "");
  const [narration, setNarration] = useState(initial?.narration ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.lines.length
      ? initial.lines.map((line) => ({
          item: line.item,
          detail: line.detail ?? "",
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount,
        }))
      : [emptyLine(), emptyLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<SalesInvoiceDTO | null>(initial ?? null);

  const totalCents = lines.reduce((sum, line) => sum + (toCents(line.amount) ?? 0), 0);
  const selectedParty = debtorParties.find((p) => p.id === partyId);

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    setLines((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === "quantity" || field === "rate") {
        row.amount = computeAmount(
          field === "quantity" ? value : row.quantity,
          field === "rate" ? value : row.rate,
        );
      }
      next[index] = row;
      return next;
    });
    setError(null);
  }

  function buildPayload(): SalesInvoiceInput {
    return {
      invoiceDate,
      partyId,
      poNumber,
      narration,
      lines: lines
        .filter((line) => line.item.trim() || line.quantity || line.rate)
        .map((line) => ({
          item: line.item,
          detail: line.detail,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount || computeAmount(line.quantity, line.rate),
        })),
    };
  }

  async function save(action: "draft" | "post") {
    setPending(true);
    setError(null);
    try {
      if (!partyId) {
        setError("Select a customer / debtor party.");
        return;
      }
      const payload = buildPayload();
      if (action === "post" && payload.lines.length < 1) {
        setError("Add at least one line before posting.");
        return;
      }

      let invoice: SalesInvoiceDTO | undefined;
      const existingId = savedInvoice?.id ?? initial?.id;

      if (!existingId) {
        const response = await fetch("/api/sales-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, post: action === "post" }),
        });
        const data = (await response.json()) as {
          invoice?: SalesInvoiceDTO;
          error?: string;
        };
        if (!response.ok || !data.invoice) {
          setError(data.error ?? "Failed to save sales invoice.");
          return;
        }
        invoice = data.invoice;
      } else {
        const patchResponse = await fetch(`/api/sales-invoices/${existingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const patchData = (await patchResponse.json()) as {
          invoice?: SalesInvoiceDTO;
          error?: string;
        };
        if (!patchResponse.ok || !patchData.invoice) {
          setError(patchData.error ?? "Failed to update sales invoice.");
          return;
        }
        invoice = patchData.invoice;

        if (action === "post") {
          const postResponse = await fetch(`/api/sales-invoices/${invoice.id}/post`, {
            method: "POST",
          });
          const postData = (await postResponse.json()) as {
            invoice?: SalesInvoiceDTO;
            error?: string;
          };
          if (!postResponse.ok || !postData.invoice) {
            setError(postData.error ?? "Failed to post sales invoice.");
            setSavedInvoice(invoice);
            return;
          }
          invoice = postData.invoice;
        }
      }

      setSavedInvoice(invoice);
      onSaved(invoice);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-xs text-[var(--accent)] underline-offset-2 hover:underline"
          >
            ← Back to list
          </button>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {mode === "create" ? "New Sales Invoice" : `Sales Invoice ${invoiceNo}`}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Posts Dr Trade Debtors (1010) / Cr Sales (4001) to the customer ledger.
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void save("draft")}
              className="border border-[var(--border-strong)] bg-white px-3 py-2 text-[11px] font-semibold"
            >
              {pending ? "Saving…" : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void save("post")}
              className="border border-[var(--accent)] bg-[var(--nav-active)] px-3 py-2 text-[11px] font-semibold text-[var(--accent)]"
            >
              {pending ? "Posting…" : "Post to Ledger"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 border border-[var(--border)] bg-[var(--panel)] p-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted-strong)]">Invoice No.</span>
          <input className="field-input w-full" value={invoiceNo} disabled />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted-strong)]">Date</span>
          <input
            type="date"
            className="field-input w-full"
            value={invoiceDate}
            disabled={readOnly}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
        <label className="block text-xs md:col-span-2">
          <span className="mb-1 block text-[var(--muted-strong)]">Party (Customer / Debtor)</span>
          <select
            className="field-input w-full"
            value={partyId}
            disabled={readOnly}
            onChange={(e) => setPartyId(e.target.value)}
          >
            <option value="">Select party…</option>
            {debtorParties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
                {party.ntn ? ` (${party.ntn})` : ""}
              </option>
            ))}
          </select>
          {selectedParty?.ntn ? (
            <span className="mt-1 block text-[10px] text-[var(--muted)]">
              NTN {selectedParty.ntn}
            </span>
          ) : null}
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[var(--muted-strong)]">PO #</span>
          <input
            className="field-input w-full"
            value={poNumber}
            disabled={readOnly}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="Customer PO number"
          />
        </label>
        <label className="block text-xs md:col-span-3">
          <span className="mb-1 block text-[var(--muted-strong)]">Narration</span>
          <input
            className="field-input w-full"
            value={narration}
            disabled={readOnly}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Optional invoice note"
          />
        </label>
      </div>

      <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="bg-[var(--table-head)] px-3 py-2">Item</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Detail</th>
              <th className="bg-[var(--table-head)] px-3 py-2 text-right">Quantity</th>
              <th className="bg-[var(--table-head)] px-3 py-2 text-right">Rate</th>
              <th className="bg-[var(--table-head)] px-3 py-2 text-right">Amount</th>
              {!readOnly ? (
                <th className="bg-[var(--table-head)] px-3 py-2"> </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-b border-[var(--border)]/60">
                <td className="px-2 py-1.5">
                  <input
                    className="field-input w-full min-w-[120px]"
                    value={line.item}
                    disabled={readOnly}
                    onChange={(e) => updateLine(index, "item", e.target.value)}
                    placeholder="Item"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="field-input w-full min-w-[160px]"
                    value={line.detail}
                    disabled={readOnly}
                    onChange={(e) => updateLine(index, "detail", e.target.value)}
                    placeholder="Detail"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="field-input w-full min-w-[90px] text-right font-mono"
                    value={line.quantity}
                    disabled={readOnly}
                    onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    placeholder="0"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="field-input w-full min-w-[100px] text-right font-mono"
                    value={line.rate}
                    disabled={readOnly}
                    onChange={(e) => updateLine(index, "rate", e.target.value)}
                    placeholder="0.00"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="field-input w-full min-w-[110px] text-right font-mono"
                    value={line.amount}
                    disabled
                    readOnly
                  />
                </td>
                {!readOnly ? (
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      className="text-[11px] text-[var(--danger)]"
                      onClick={() =>
                        setLines((prev) =>
                          prev.length <= 1 ? [emptyLine()] : prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--border)]">
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold">
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                {formatCurrency(centsToDecimalString(totalCents))}
              </td>
              {!readOnly ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly ? (
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="border border-[var(--border-strong)] bg-white px-3 py-2 text-[11px] font-semibold"
        >
          + Add line
        </button>
      ) : null}

      {initial?.status || savedInvoice?.status ? (
        <p className="text-xs text-[var(--muted)]">
          Status:{" "}
          <strong>{savedInvoice?.status ?? initial?.status}</strong>
          {(savedInvoice?.voucherNo ?? initial?.voucherNo)
            ? ` · Linked voucher ${(savedInvoice?.voucherNo ?? initial?.voucherNo)!}`
            : null}
        </p>
      ) : null}
    </div>
  );
}
