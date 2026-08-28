import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import type { LedgerResult } from "@/lib/ledger/service";
import { periodCaption } from "@/lib/print/company";

type LedgerPrintProps = {
  data: LedgerResult;
};

export function LedgerPrint({ data }: LedgerPrintProps) {
  return (
    <PrintSheet orientation="landscape">
      <table className="print-table">
        <PrintThead
          colSpan={8}
          banner={
            <>
              <PrintLetterhead
                title="Account Ledger"
                subtitle={`${data.account.code} — ${data.account.name}`}
                extra={`${data.account.accountGroup ?? "Ungrouped"} · ${data.account.accountType} · Normal ${data.account.normalBalance}`}
                period={periodCaption(data.from, data.to)}
              />
              <div className="print-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="print-kpi">
                  <div className="print-kpi-label">Opening</div>
                  <div className="print-kpi-value">
                    <PrintAmount value={data.opening.balance} />{" "}
                    {data.opening.side === "Debit" ? "Dr" : "Cr"}
                  </div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Period debit</div>
                  <div className="print-kpi-value">
                    <PrintAmount value={data.period.debit} />
                  </div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Period credit</div>
                  <div className="print-kpi-value">
                    <PrintAmount value={data.period.credit} />
                  </div>
                </div>
                <div className="print-kpi">
                  <div className="print-kpi-label">Closing</div>
                  <div className="print-kpi-value">
                    <PrintAmount value={data.closing.balance} />{" "}
                    {data.closing.side === "Debit" ? "Dr" : "Cr"}
                  </div>
                </div>
              </div>
            </>
          }
        >
          <th>Date</th>
          <th>Voucher</th>
          <th>Type</th>
          <th>Party</th>
          <th>Narration</th>
          <th className="num">Debit</th>
          <th className="num">Credit</th>
          <th className="num">Balance</th>
        </PrintThead>
        <tbody>
          <tr>
            <td colSpan={5} className="bold">
              Opening balance
            </td>
            <td className="num">
              <PrintAmount value={data.opening.debit} blankZero />
            </td>
            <td className="num">
              <PrintAmount value={data.opening.credit} blankZero />
            </td>
            <td className="num">
              <PrintAmount value={data.opening.balance} />{" "}
              {data.opening.side === "Debit" ? "Dr" : "Cr"}
            </td>
          </tr>
          {data.transactions.length === 0 ? (
            <tr>
              <td colSpan={8}>No movements in this period.</td>
            </tr>
          ) : (
            data.transactions.map((txn, idx) => (
              <tr key={`${txn.voucherId}-${idx}`}>
                <td>{txn.date}</td>
                <td>{txn.voucherNo}</td>
                <td>{txn.voucherType}</td>
                <td>{txn.partyName ?? "—"}</td>
                <td>{txn.narration ?? ""}</td>
                <td className="num">
                  <PrintAmount value={txn.debit} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={txn.credit} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={txn.runningBalance} />{" "}
                  {txn.runningSide === "Debit" ? "Dr" : "Cr"}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={5}>Closing balance ({data.period.count} transactions)</td>
            <td className="num">
              <PrintAmount value={data.period.debit} />
            </td>
            <td className="num">
              <PrintAmount value={data.period.credit} />
            </td>
            <td className="num">
              <PrintAmount value={data.closing.balance} />{" "}
              {data.closing.side === "Debit" ? "Dr" : "Cr"}
            </td>
          </tr>
        </tfoot>
      </table>
      <PrintSignatures />
    </PrintSheet>
  );
}
