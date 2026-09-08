"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { ItemLov } from "@/components/items/ItemLov";
import { PrintButton } from "@/components/print/PrintButton";
import { OriginLink } from "@/components/ui/OriginLink";
import { formatCurrency } from "@/lib/formatting/money";
import type { ItemDTO } from "@/lib/items/types";
import { stockAdjustmentHref } from "@/lib/links";
import {
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASONS,
  type StockAdjustmentDTO,
  type StockAdjustmentInput,
  type StockAdjustmentReasonValue,
} from "@/lib/stock-adjustments/types";

type LineDraft = { itemId: string; direction: "IN" | "OUT"; quantity: string; unitCost: string };

type Props = {
  initialAdjustments: StockAdjustmentDTO[];
  items: ItemDTO[];
  openAdjustment?: StockAdjustmentDTO | null;
  loadError?: string | null;
};

function emptyLine(direction: "IN" | "OUT" = "IN"): LineDraft {
  return { itemId: "", direction, quantity: "", unitCost: "" };
}

export function StockAdjustmentEntry({
  initialAdjustments,
  items,
  openAdjustment = null,
  loadError = null,
}: Props) {
  const { isAdmin } = useCurrentUser();
  const [rows, setRows] = useState(initialAdjustments);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [saved, setSaved] = useState<StockAdjustmentDTO | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adjustmentNo, setAdjustmentNo] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<StockAdjustmentReasonValue>("OPENING");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("IN")]);

  const stockItems = useMemo(() => items.filter((item) => item.isActive && item.trackStock), [items]);

  useEffect(() => {
    if (!openAdjustment) return;
    loadForm(openAdjustment);
  }, [openAdjustment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadForm(row: StockAdjustmentDTO) {
    setSaved(row);
    setAdjustmentNo(row.adjustmentNo);
    setAdjustmentDate(row.adjustmentDate);
    setReason(row.reason);
    setNarration(row.narration ?? "");
    setLines(
      row.lines.length
        ? row.lines.map((line) => ({
            itemId: line.itemId,
            direction: line.direction,
            quantity: line.quantity,
            unitCost: line.unitCost,
          }))
        : [emptyLine()],
    );
    setMode("form");
  }

  function refresh() {
    startTransition(async () => {
      const response = await fetch("/api/stock-adjustments");
      const data = (await response.json()) as { adjustments?: StockAdjustmentDTO[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to refresh.");
        return;
      }
      setRows(data.adjustments ?? []);
    });
  }

  async function openCreate() {
    const response = await fetch("/api/stock-adjustments?nextNumber=1");
    const data = (await response.json()) as { adjustmentNo?: string };
    setSaved(null);
    setAdjustmentNo(data.adjustmentNo ?? "STJ-…");
    setAdjustmentDate(new Date().toISOString().slice(0, 10));
    setReason("OPENING");
    setNarration("");
    setLines([emptyLine("IN")]);
    setMode("form");
  }

  function defaultDirection(nextReason: StockAdjustmentReasonValue): "IN" | "OUT" {
    if (nextReason === "LOSS") return "OUT";
    return "IN";
  }

  function buildPayload(): StockAdjustmentInput {
    return {
      adjustmentDate,
      reason,
      narration,
      lines: lines
        .filter((line) => line.itemId)
        .map((line) => ({
          itemId: line.itemId,
          direction: line.direction,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
    };
  }

  const status = saved?.status ?? "DRAFT";
  const readOnly = status === "POSTED" || status === "CANCELLED";

  async function save(post: boolean) {
    setError(null);
    try {
      const payload = buildPayload();
      let row: StockAdjustmentDTO | undefined;
      if (!saved?.id) {
        const response = await fetch("/api/stock-adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, post }),
        });
        const data = (await response.json()) as { adjustment?: StockAdjustmentDTO; error?: string };
        if (!response.ok || !data.adjustment) {
          setError(data.error ?? "Save failed.");
          return;
        }
        row = data.adjustment;
      } else {
        const patch = await fetch(`/api/stock-adjustments/${saved.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await patch.json()) as { adjustment?: StockAdjustmentDTO; error?: string };
        if (!patch.ok || !data.adjustment) {
          setError(data.error ?? "Update failed.");
          return;
        }
        row = data.adjustment;
        if (post) {
          const posted = await fetch(`/api/stock-adjustments/${row.id}/post`, { method: "POST" });
          const postData = (await posted.json()) as { adjustment?: StockAdjustmentDTO; error?: string };
          if (!posted.ok || !postData.adjustment) {
            setError(postData.error ?? "Post failed.");
            return;
          }
          row = postData.adjustment;
        }
      }
      setSaved(row);
      setMessage(post ? "Stock adjustment posted." : "Draft saved.");
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function act(path: string, ok: string) {
    if (!saved) return;
    const response = await fetch(`/api/stock-adjustments/${saved.id}/${path}`, { method: "POST" });
    const data = (await response.json()) as { adjustment?: StockAdjustmentDTO; error?: string };
    if (!response.ok || !data.adjustment) {
      setError(data.error ?? "Action failed.");
      return;
    }
    setSaved(data.adjustment);
    setMessage(ok);
    refresh();
  }

  if (mode === "form") {
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => setMode("list")}>Back</button>
          <span className="font-semibold">{adjustmentNo}</span>
          <span className="text-xs text-[var(--muted)]">{status}</span>
          {!readOnly ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => void save(false)}>Save draft</button>
              <button type="button" className="btn-primary" onClick={() => void save(true)}>Post</button>
            </>
          ) : null}
          {status === "POSTED" && isAdmin ? (
            <button type="button" className="btn-secondary" onClick={() => void act("unpost", "Unposted.")}>Unpost</button>
          ) : null}
          {status === "POSTED" ? (
            <button type="button" className="btn-secondary" onClick={() => void act("cancel", "Cancelled.")}>Cancel</button>
          ) : null}
        </div>
        {error ? <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="border border-emerald-200 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">{message}</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-xs">
            <span className="mb-1 block text-[var(--muted-strong)]">Date</span>
            <input type="date" className="field-input w-full" disabled={readOnly} value={adjustmentDate} onChange={(e) => setAdjustmentDate(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-[var(--muted-strong)]">Reason</span>
            <select
              className="field-input w-full"
              disabled={readOnly}
              value={reason}
              onChange={(e) => {
                const next = e.target.value as StockAdjustmentReasonValue;
                setReason(next);
                setLines((prev) => prev.map((line) => ({ ...line, direction: defaultDirection(next) })));
              }}
            >
              {STOCK_ADJUSTMENT_REASONS.map((value) => (
                <option key={value} value={value}>{STOCK_ADJUSTMENT_REASON_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs md:col-span-3">
            <span className="mb-1 block text-[var(--muted-strong)]">Narration</span>
            <input className="field-input w-full" disabled={readOnly} value={narration} onChange={(e) => setNarration(e.target.value)} />
          </label>
        </div>
        <div className="overflow-auto border border-[var(--border)]">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="text-[11px] uppercase text-[var(--accent)]">
                <th className="bg-[var(--table-head)] px-3 py-2">Item</th>
                <th className="bg-[var(--table-head)] px-3 py-2">Dir</th>
                <th className="bg-[var(--table-head)] px-3 py-2 text-right">Qty</th>
                <th className="bg-[var(--table-head)] px-3 py-2 text-right">Unit cost</th>
                <th className="bg-[var(--table-head)] px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-[var(--border)]/60">
                  <td className="px-2 py-1.5">
                    <ItemLov items={stockItems} value={line.itemId} disabled={readOnly} onChange={(itemId) => {
                      setLines((prev) => prev.map((row, i) => i === index ? { ...row, itemId } : row));
                    }} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="field-input"
                      disabled={readOnly || reason !== "COUNT"}
                      value={line.direction}
                      onChange={(e) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, direction: e.target.value as "IN" | "OUT" } : row))}
                    >
                      <option value="IN">IN</option>
                      <option value="OUT">OUT</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="field-input w-full text-right font-mono" disabled={readOnly} value={line.quantity} onChange={(e) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input className="field-input w-full text-right font-mono" disabled={readOnly} value={line.unitCost} onChange={(e) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, unitCost: e.target.value } : row))} placeholder={line.direction === "OUT" ? "WAC on post" : ""} />
                  </td>
                  <td className="px-2 py-1.5">
                    {!readOnly ? (
                      <button type="button" className="text-[11px] text-[var(--danger)]" onClick={() => setLines((prev) => prev.length <= 1 ? [emptyLine(defaultDirection(reason))] : prev.filter((_, i) => i !== index))}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly ? (
          <button type="button" className="border border-[var(--border-strong)] bg-white px-3 py-2 text-[11px] font-semibold" onClick={() => setLines((prev) => [...prev, emptyLine(defaultDirection(reason))])}>
            + Add line
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <button type="button" className="btn-primary" onClick={() => void openCreate()}>New adjustment</button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>Refresh</button>
        <PrintButton />
      </div>
      {error ? <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="border border-emerald-200 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">{message}</p> : null}
      <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[var(--accent)]">
              <th className="bg-[var(--table-head)] px-3 py-2">No</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Date</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Reason</th>
              <th className="bg-[var(--table-head)] px-3 py-2 text-right">Amount</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border)]/60">
                <td className="px-3 py-2">
                  <OriginLink href={stockAdjustmentHref(row.id)}>{row.adjustmentNo}</OriginLink>
                </td>
                <td className="px-3 py-2">{row.adjustmentDate}</td>
                <td className="px-3 py-2">{STOCK_ADJUSTMENT_REASON_LABELS[row.reason]}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalDebit)}</td>
                <td className="px-3 py-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
