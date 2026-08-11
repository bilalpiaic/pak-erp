"use client";

import { OriginLink } from "@/components/ui/OriginLink";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
import { partyLedgerHref, voucherHref } from "@/lib/links";
import type { SalesInvoiceDTO } from "@/lib/sales-invoices/types";

type PrintLine = {
  item: string;
  detail: string;
  quantity: string;
  rate: string;
  amount: string;
};

type SalesInvoicePrintProps = {
  company?: CompanyDTO | null;
  invoiceNo: string;
  invoiceDate: string;
  partyId?: string | null;
  partyName: string;
  partyNtn?: string | null;
  poNumber?: string | null;
  narration?: string | null;
  status?: string | null;
  voucherId?: string | null;
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
    partyId: invoice.partyId,
    partyName: invoice.partyName,
    partyNtn: invoice.partyNtn,
    poNumber: invoice.poNumber,
    narration: invoice.narration,
    status: invoice.status,
    voucherId: invoice.voucherId,
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
  invoiceNo,
  invoiceDate,
  partyId,
  partyName,
  partyNtn,
  poNumber,
  narration,
  status,
  voucherId,
  voucherNo,
  lines,
  totalAmount,
}: SalesInvoicePrintProps) {
  return (
    <div className="sales-invoice-print border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <div className="mb-4 border-b border-[var(--border)] pb-3">
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
          Sales Invoice
        </div>
        {status ? (
          <div className="mt-1 text-xs text-[var(--muted)]">Status: {status}</div>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Bill to
            </span>
            <div className="font-semibold">
              {partyId && partyName ? (
                <OriginLink href={partyLedgerHref(partyId, "debtor")}>{partyName}</OriginLink>
              ) : (
                partyName || "—"
              )}
            </div>
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
              {voucherId ? (
                <OriginLink href={voucherHref(voucherId)}>{voucherNo}</OriginLink>
              ) : (
                voucherNo
              )}
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
