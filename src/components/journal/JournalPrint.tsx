import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import type { JournalResult } from "@/lib/journal/service";
import { periodCaption } from "@/lib/print/company";

type JournalPrintProps = {
  data: JournalResult;
  voucherType?: string;
  search?: string;
};

export function JournalPrint({ data, voucherType, search }: JournalPrintProps) {
  const extras = [
    voucherType && voucherType !== "All" ? `Type: ${voucherType}` : null,
    search?.trim() ? `Search: ${search.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PrintSheet orientation="landscape">
      <PrintLetterhead
        title="General Journal"
        subtitle={extras || null}
        period={periodCaption(data.from, data.to)}
      />
      <table className="print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher</th>
            <th>Type</th>
            <th>Acc</th>
            <th>Account</th>
            <th>Party</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
            <th>Narration</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 ? (
            <tr>
              <td colSpan={9}>No posted journal lines in this range.</td>
            </tr>
          ) : (
            data.lines.map((line, idx) => (
              <tr key={`${line.voucherId}-${line.accountCode}-${idx}`}>
                <td>{line.date}</td>
                <td>{line.voucherNo}</td>
                <td>{line.voucherType}</td>
                <td>{line.accountCode}</td>
                <td>{line.accountName}</td>
                <td>{line.partyName ?? "—"}</td>
                <td className="num">
                  <PrintAmount value={line.debit} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={line.credit} blankZero />
                </td>
                <td>{line.narration ?? ""}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={6}>
              Totals ({data.totals.count} lines)
              {data.totals.balanced ? " — Balanced" : " — Out of balance"}
            </td>
            <td className="num">
              <PrintAmount value={data.totals.debit} />
            </td>
            <td className="num">
              <PrintAmount value={data.totals.credit} />
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      <PrintSignatures />
    </PrintSheet>
  );
}
