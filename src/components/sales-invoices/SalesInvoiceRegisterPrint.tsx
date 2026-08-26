import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import type { SalesInvoiceDTO } from "@/lib/sales-invoices/types";

type SalesInvoiceRegisterPrintProps = {
  invoices: SalesInvoiceDTO[];
  filters?: string | null;
};

export function SalesInvoiceRegisterPrint({
  invoices,
  filters,
}: SalesInvoiceRegisterPrintProps) {
  return (
    <PrintSheet orientation="landscape">
      <PrintLetterhead
        title="Sales Invoice Register"
        subtitle={filters || `${invoices.length} invoices`}
        extra={filters ? `${invoices.length} invoices` : null}
      />
      <table className="print-table">
        <thead>
          <tr>
            <th>Invoice No.</th>
            <th>Date</th>
            <th>Party</th>
            <th>NTN</th>
            <th>PO #</th>
            <th className="num">Amount</th>
            <th>Status</th>
            <th>Voucher</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={8}>No sales invoices match the current filters.</td>
            </tr>
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNo}</td>
                <td>{invoice.invoiceDate}</td>
                <td>{invoice.partyName}</td>
                <td>{invoice.partyNtn ?? "—"}</td>
                <td>{invoice.poNumber || "—"}</td>
                <td className="num">
                  <PrintAmount value={invoice.totalAmount} />
                </td>
                <td>{invoice.status}</td>
                <td>{invoice.voucherNo ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <PrintSignatures columns={[{ label: "Prepared by" }, { label: "Reviewed by" }]} />
    </PrintSheet>
  );
}
