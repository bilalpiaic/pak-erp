"use client";

import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import { OriginLink } from "@/components/ui/OriginLink";
import type { CompanyDTO } from "@/lib/company/types";
import { companyPrintInfoFromDto } from "@/lib/print/company";
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
  company,
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
    <div className="sales-invoice-print print-sheet print-sheet-portrait border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <table className="print-table data-table w-full border-collapse text-left">
        <PrintThead
          colSpan={6}
          banner={
            <>
              <PrintLetterhead
                company={companyPrintInfoFromDto(company)}
                title="Sales Invoice"
                subtitle={status ? `Status: ${status}` : null}
                extra={`Invoice ${invoiceNo} · ${invoiceDate}${poNumber ? ` · PO ${poNumber}` : ""}`}
              />
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
                      <span className="text-[var(--muted)]">SI voucher: </span>
                      {voucherId ? (
                        <OriginLink href={voucherHref(voucherId)}>{voucherNo}</OriginLink>
                      ) : (
                        voucherNo
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          }
        >
          <th>#</th>
          <th>Item</th>
          <th>Detail</th>
          <th className="num text-right">Qty</th>
          <th className="num text-right">Rate</th>
          <th className="num text-right">Amount</th>
        </PrintThead>
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
                <td className="num text-right font-mono text-xs">{line.quantity}</td>
                <td className="num text-right font-mono text-xs">
                  <PrintAmount value={line.rate} />
                </td>
                <td className="num text-right font-mono text-xs">
                  <PrintAmount value={line.amount} />
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="text-right font-semibold">
              Total
            </td>
            <td className="num text-right font-mono text-sm font-semibold">
              <PrintAmount value={totalAmount} />
            </td>
          </tr>
        </tfoot>
      </table>

      <PrintSignatures
        columns={[{ label: "Prepared by" }, { label: "Received by / Customer" }]}
      />
    </div>
  );
}
