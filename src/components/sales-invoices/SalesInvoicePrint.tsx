"use client";

import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
import type { SalesInvoiceDTO } from "@/lib/sales-invoices/types";

type PrintLine = {
  item: string;
  detail: string;
  quantity: string;
  rate: string;
  amount: string;
};

type SalesInvoicePrintProps = {
  company: CompanyDTO | null;
  invoiceNo: string;
  invoiceDate: string;
  partyName: string;
  partyNtn?: string | null;
  poNumber?: string | null;
  narration?: string | null;
  status?: string | null;
  voucherNo?: string | null;
  lines: PrintLine[];
  totalAmount: string;
};

/** Build print props from a saved invoice DTO. */
export function printPropsFromInvoice(
  company: CompanyDTO | null,
  invoice: SalesInvoiceDTO,
): SalesInvoicePrintProps {
  return {
    company,
    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate,
    partyName: invoice.partyName,
    partyNtn: invoice.partyNtn,
    poNumber: invoice.poNumber,
    narration: invoice.narration,
    status: invoice.status,
    voucherNo: invoice.voucherNo,
    lines: invoice.lines.map((line) => ({
      item: line.item,
      detail: line.detail ?? "",
      quantity: line.quantity,
      rate: line.rate,
      amount: line.amount,
    })),
    totalAmount: invoice.totalAmount,
  };
}

export function SalesInvoicePrint({
  company,
  invoiceNo,
  invoiceDate,
  partyName,
  partyNtn,
  poNumber,
  narration,
  status,
  voucherNo,
  lines,
  totalAmount,
}: SalesInvoicePrintProps) {
  return (
    <div className="sales-invoice-print border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <PrintLetterhead company={company} title="Sales Invoice" subtitle={status ?? undefined} />

      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Bill to
            </span>
            <div className="font-semibold">{partyName || "—"}</div>
            {partyNtn ? (
              <div className="text-xs text-[var(--muted)]">NTN {partyNtn}</div>
            ) : null}
          </div>
          {narration ? (
            <div className="text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--foreground)]">Narration: </span>
              {narration}
            </div>
          ) : null}
        </div>
        <div className="space-y-1 sm:text-right">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Invoice No.
            </span>
            <div className="font-semibold">{invoiceNo}</div>
          </div>
          <div className="text-xs">
            <span className="text-[var(--muted)]">Date: </span>
            {invoiceDate}
          </div>
          {poNumber ? (
            <div className="text-xs">
              <span className="text-[var(--muted)]">PO #: </span>
              {poNumber}
            </div>
          ) : null}
          {voucherNo ? (
            <div className="text-xs">
              <span className="text-[var(--muted)]">Voucher: </span>
              {voucherNo}
            </div>
          ) : null}
        </div>
      </div>

      <table className="data-table w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Detail</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-sm text-[var(--muted)]">
                No lines
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`${line.item}-${index}`}>
                <td className="text-xs text-[var(--muted)]">{index + 1}</td>
                <td className="text-sm font-medium">{line.item}</td>
                <td className="text-xs text-[var(--muted)]">{line.detail || "—"}</td>
                <td className="text-right font-mono text-xs">{line.quantity}</td>
                <td className="text-right font-mono text-xs">{formatCurrency(line.rate)}</td>
                <td className="text-right font-mono text-xs">{formatCurrency(line.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="text-right font-semibold">
              Total
            </td>
            <td className="text-right font-mono text-sm font-semibold">
              {formatCurrency(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 grid gap-8 text-xs text-[var(--muted)] sm:grid-cols-2">
        <div>
          <div className="mb-8 border-b border-[var(--border)] pb-1">Prepared by</div>
        </div>
        <div>
          <div className="mb-8 border-b border-[var(--border)] pb-1">Received by / Customer</div>
        </div>
      </div>
    </div>
  );
}
