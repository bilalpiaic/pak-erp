import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import type { VoucherDTO } from "@/lib/vouchers/types";

type VoucherRegisterPrintProps = {
  vouchers: VoucherDTO[];
  filters?: string | null;
};

export function VoucherRegisterPrint({ vouchers, filters }: VoucherRegisterPrintProps) {
  return (
    <PrintSheet orientation="landscape">
      <PrintLetterhead
        title="Voucher Register"
        subtitle={filters || `${vouchers.length} vouchers`}
        extra={filters ? `${vouchers.length} vouchers` : null}
      />
      <table className="print-table">
        <thead>
          <tr>
            <th>Voucher No.</th>
            <th>Date</th>
            <th>Type</th>
            <th>Party</th>
            <th>Reference</th>
            <th className="num">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.length === 0 ? (
            <tr>
              <td colSpan={7}>No vouchers match the current filters.</td>
            </tr>
          ) : (
            vouchers.map((voucher) => (
              <tr key={voucher.id}>
                <td>{voucher.voucherNo}</td>
                <td>{voucher.voucherDate}</td>
                <td>{voucher.voucherType}</td>
                <td>{voucher.partyName || "—"}</td>
                <td>{voucher.referenceNo || "—"}</td>
                <td className="num">
                  <PrintAmount value={voucher.totalDebit} />
                </td>
                <td>{voucher.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <PrintSignatures columns={[{ label: "Prepared by" }, { label: "Reviewed by" }]} />
    </PrintSheet>
  );
}
