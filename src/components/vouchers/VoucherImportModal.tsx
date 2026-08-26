"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { VoucherImportResult } from "@/lib/vouchers/import-types";

type VoucherImportModalProps = {
  onClose: () => void;
  onImported: (result: VoucherImportResult) => void;
};

export function VoucherImportModal({ onClose, onImported }: VoucherImportModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [postBalanced, setPostBalanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<VoucherImportResult | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    setCsvText(await file.text());
  }

  async function downloadSample(kind: "template" | "sample") {
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/import?sample=${kind}`);
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Unable to download sample.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        kind === "template" ? "vouchers-import-template.csv" : "vouchers-import-sample.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function run(dryRun: boolean) {
    if (!csvText.trim()) {
      setError("Choose a CSV file first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/vouchers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, dryRun, postBalanced }),
      });
      const data = (await response.json()) as VoucherImportResult & { error?: string };
      if (!response.ok && !data.items) {
        setError(data.error ?? "Import failed.");
        return;
      }
      setResult(data);
      if (!dryRun && data.created > 0) onImported(data);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-[var(--accent)]">
            Import vouchers from CSV
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 overflow-auto px-4 py-4">
          <p className="text-xs text-[var(--muted)]">
            One row per voucher line. Group lines with the same <code>voucher_key</code>.
            Account codes must already exist on the chart of accounts. Leave{" "}
            <code>voucher_no</code> blank to auto-number. <code>status</code> is DRAFT or POSTED.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-[11px]"
              onClick={() => void downloadSample("template")}
            >
              Download template
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-[11px]"
              onClick={() => void downloadSample("sample")}
            >
              Download sample
            </button>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              CSV file
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void onFile(event.target.files)}
              className="field-input"
            />
            {fileName ? (
              <span className="mt-1 block text-[11px] text-[var(--muted-strong)]">{fileName}</span>
            ) : null}
          </label>

          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={postBalanced}
              onChange={(event) => setPostBalanced(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Post balanced vouchers (overrides blank status; CSV <code>DRAFT</code> still stays draft)
          </label>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--foreground)]">
                {result.dryRun ? "Validation" : "Import"}: {result.created} ok · {result.posted}{" "}
                posted · {result.failed} failed ({result.voucherCount} vouchers, {result.totalRows}{" "}
                lines)
              </p>
              <div className="max-h-56 overflow-auto border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.06em] text-[var(--accent)]">
                      <th className="px-2 py-1">Key</th>
                      <th className="px-2 py-1">Rows</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Number</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={`${item.voucherKey}-${item.rowStart}`} className="border-b border-[var(--border)]/50">
                        <td className="px-2 py-1 font-mono">{item.voucherKey}</td>
                        <td className="px-2 py-1">
                          {item.rowStart === item.rowEnd
                            ? item.rowStart
                            : `${item.rowStart}–${item.rowEnd}`}
                        </td>
                        <td className="px-2 py-1">{item.voucherType ?? "—"}</td>
                        <td className="px-2 py-1 font-mono">{item.voucherNo ?? "—"}</td>
                        <td className="px-2 py-1">{item.status ?? "—"}</td>
                        <td className="px-2 py-1">
                          {item.ok ? (
                            <span className="text-[var(--success)]">OK</span>
                          ) : (
                            <span className="text-[var(--danger)]">{item.errors.join(" ")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            disabled={pending || !csvText.trim()}
            onClick={() => void run(true)}
            className="btn-secondary"
          >
            {pending ? "Working…" : "Validate"}
          </button>
          <button
            type="button"
            disabled={pending || !csvText.trim()}
            onClick={() => void run(false)}
            className="btn-primary"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
