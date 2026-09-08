"use client";

import { useState, useTransition } from "react";

import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import { OriginLink } from "@/components/ui/OriginLink";
import { useFiscalYear } from "@/components/fiscal-year/FiscalYearProvider";
import { formatCurrency } from "@/lib/formatting/money";
import { ITEM_CATEGORY_LABELS, type ItemCategoryValue, type ItemDTO } from "@/lib/items/types";
import { purchaseInvoiceHref, salesInvoiceHref, stockAdjustmentHref, voucherHref } from "@/lib/links";
import { periodCaption } from "@/lib/print/company";
import type { StockLedgerResult } from "@/lib/stock/service";

type Props = {
  initial: StockLedgerResult | null;
  items: Array<Pick<ItemDTO, "id" | "sku" | "name">>;
  loadError?: string | null;
};

function sourceHref(txn: StockLedgerResult["transactions"][number]): string {
  if (txn.sourceDocument === "SalesInvoice") return salesInvoiceHref(txn.sourceDocumentId);
  if (txn.sourceDocument === "PurchaseInvoice") return purchaseInvoiceHref(txn.sourceDocumentId);
  if (txn.sourceDocument === "StockAdjustment") return stockAdjustmentHref(txn.sourceDocumentId);
  return voucherHref(txn.voucherId);
}

export function StockLedgerView({ initial, items, loadError = null }: Props) {
  const { activeRange } = useFiscalYear();
  const [itemId, setItemId] = useState(initial?.item.id ?? items[0]?.id ?? "");
  const [from, setFrom] = useState(initial?.from ?? activeRange.from);
  const [to, setTo] = useState(initial?.to ?? activeRange.to);
  const [data, setData] = useState(initial);
  const [error, setError] = useState(loadError);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const params = new URLSearchParams({ itemId, from, to });
      const response = await fetch(`/api/stock/ledger?${params}`);
      const json = (await response.json()) as StockLedgerResult & { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Failed to load stock ledger.");
        return;
      }
      setData(json);
      setError(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Item</span>
          <select className="field-input w-full" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>
            ))}
          </select>
        </label>
        <input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn-primary" disabled={pending} onClick={load}>{pending ? "Loading…" : "Apply"}</button>
        <PrintButton disabled={!data} orientation="landscape" />
      </div>
      {error ? <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
      {data ? (
        <>
          <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <div className="text-[11px] text-[var(--muted)]">Opening</div>
              <div>{data.opening.qty} · {formatCurrency(data.opening.value)}</div>
            </div>
            <div className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <div className="text-[11px] text-[var(--muted)]">Closing</div>
              <div>{data.closing.qty} · {formatCurrency(data.closing.value)}</div>
            </div>
            <div className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <div className="text-[11px] text-[var(--muted)]">WAC</div>
              <div>{formatCurrency(data.closing.wac)}</div>
            </div>
          </div>
          <div className="no-print overflow-auto border border-[var(--border)]">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase text-[var(--accent)]">
                  <th className="bg-[var(--table-head)] px-3 py-2">Date</th>
                  <th className="bg-[var(--table-head)] px-3 py-2">Document</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">In</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">Out</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">Value</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">Qty</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">Value bal</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((txn, idx) => (
                  <tr key={`${txn.voucherId}-${idx}`} className="border-b border-[var(--border)]/60">
                    <td className="px-3 py-2">{txn.date}</td>
                    <td className="px-3 py-2">
                      <OriginLink href={sourceHref(txn)}>{txn.voucherNo}</OriginLink>
                      <span className="ml-2 text-[11px] text-[var(--muted)]">{txn.moveType}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{txn.quantityIn === "0" ? "" : txn.quantityIn}</td>
                    <td className="px-3 py-2 text-right font-mono">{txn.quantityOut === "0" ? "" : txn.quantityOut}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(txn.value)}</td>
                    <td className="px-3 py-2 text-right font-mono">{txn.runningQty}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(txn.runningValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PrintSheet orientation="landscape">
            <table className="print-table">
              <PrintThead
                colSpan={7}
                banner={
                  <PrintLetterhead
                    title="Stock Ledger"
                    subtitle={`${data.item.sku} — ${data.item.name}`}
                    extra={`${data.item.unit} · ${ITEM_CATEGORY_LABELS[data.item.category as ItemCategoryValue] ?? data.item.category}`}
                    period={periodCaption(data.from, data.to)}
                  />
                }
              >
                <th>Date</th>
                <th>Document</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th className="num">Value</th>
                <th className="num">Qty</th>
                <th className="num">Value bal</th>
              </PrintThead>
              <tbody>
                {data.transactions.map((txn, idx) => (
                  <tr key={`${txn.voucherId}-${idx}`}>
                    <td>{txn.date}</td>
                    <td>{txn.voucherNo} {txn.moveType}</td>
                    <td className="num">{txn.quantityIn === "0" ? "" : txn.quantityIn}</td>
                    <td className="num">{txn.quantityOut === "0" ? "" : txn.quantityOut}</td>
                    <td className="num"><PrintAmount value={txn.value} /></td>
                    <td className="num">{txn.runningQty}</td>
                    <td className="num"><PrintAmount value={txn.runningValue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PrintSignatures />
          </PrintSheet>
        </>
      ) : null}
    </div>
  );
}
