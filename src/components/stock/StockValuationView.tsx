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
import { stockLedgerHref } from "@/lib/links";
import type { StockValuationResult } from "@/lib/stock/service";

type Props = {
  initial: StockValuationResult | null;
  loadError?: string | null;
};

export function StockValuationView({ initial, loadError = null }: Props) {
  const { activeRange } = useFiscalYear();
  const [asOf, setAsOf] = useState(initial?.asOf ?? activeRange.to);
  const [data, setData] = useState(initial);
  const [error, setError] = useState(loadError);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const response = await fetch(`/api/stock/valuation?asOf=${encodeURIComponent(asOf)}`);
      const json = (await response.json()) as StockValuationResult & { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Failed to load valuation.");
        return;
      }
      setData(json);
      setError(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">As of</span>
          <input type="date" className="field-input" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={pending} onClick={load}>{pending ? "Loading…" : "Apply"}</button>
        <PrintButton disabled={!data} orientation="landscape" />
      </div>
      {error ? <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
      {data ? (
        <>
          <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <div className="text-[11px] text-[var(--muted)]">Stock value</div>
              <div className="font-semibold">{formatCurrency(data.stockValue)}</div>
            </div>
            <div className="border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <div className="text-[11px] text-[var(--muted)]">GL 1020</div>
              <div className="font-semibold">{formatCurrency(data.glStock)}</div>
            </div>
            <div className={`border px-3 py-2 ${data.tied ? "border-[var(--border)] bg-[var(--panel)]" : "border-red-200 bg-[var(--danger-bg)]"}`}>
              <div className="text-[11px] text-[var(--muted)]">Difference</div>
              <div className="font-semibold">{formatCurrency(data.difference)}</div>
            </div>
          </div>
          <div className="no-print overflow-auto border border-[var(--border)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase text-[var(--accent)]">
                  <th className="bg-[var(--table-head)] px-3 py-2">SKU</th>
                  <th className="bg-[var(--table-head)] px-3 py-2">Name</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">Qty</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">WAC</th>
                  <th className="bg-[var(--table-head)] px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.itemId} className="border-b border-[var(--border)]/60">
                    <td className="px-3 py-2 font-mono text-xs">
                      <OriginLink href={stockLedgerHref(row.itemId)}>{row.sku}</OriginLink>
                    </td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.qty} {row.unit}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.wac)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PrintSheet orientation="landscape">
            <table className="print-table">
              <PrintThead
                colSpan={5}
                banner={
                  <PrintLetterhead
                    title="Stock Valuation"
                    subtitle={`As of ${data.asOf}`}
                    extra={data.tied ? "Tied to GL 1020" : `Difference ${data.difference}`}
                  />
                }
              >
                <th>SKU</th>
                <th>Name</th>
                <th className="num">Qty</th>
                <th className="num">WAC</th>
                <th className="num">Value</th>
              </PrintThead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.itemId}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td className="num">{row.qty} {row.unit}</td>
                    <td className="num"><PrintAmount value={row.wac} /></td>
                    <td className="num"><PrintAmount value={row.value} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4}>Total / GL 1020 {data.glStock}</td>
                  <td className="num"><PrintAmount value={data.stockValue} /></td>
                </tr>
              </tfoot>
            </table>
            <PrintSignatures />
          </PrintSheet>
        </>
      ) : null}
    </div>
  );
}
