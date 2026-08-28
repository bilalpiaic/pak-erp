import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import { companyPrintInfoFromDto, periodCaption } from "@/lib/print/company";
import type { PartyLedgerResult } from "@/lib/party-ledger/service";

type PartyLedgerPrintProps = {
  data: PartyLedgerResult;
};

export function PartyLedgerPrint({ data }: PartyLedgerPrintProps) {
  const partyMeta = [
    data.party.ntn ? `NTN ${data.party.ntn}` : null,
    data.party.phone,
    data.party.partyType,
    data.party.address,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PrintSheet orientation="landscape">
      <table className="print-table">
        <PrintThead
          colSpan={8}
          banner={
            <PrintLetterhead
              company={companyPrintInfoFromDto(data.company)}
              title={data.kind === "debtor" ? "Debtor Ledger" : "Creditor Ledger"}
              subtitle={data.party.name}
              extra={`${partyMeta}${partyMeta ? " · " : ""}Control ${data.account.code} — ${data.account.name}`}
              period={periodCaption(data.from, data.to)}
            />
          }
        >
          <th>Date</th>
          <th>Voucher</th>
          <th>Type</th>
          <th>Reference</th>
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
              <td colSpan={8}>No posted transactions for this party in the selected period.</td>
            </tr>
          ) : (
            data.transactions.map((txn) => (
              <tr key={`${txn.voucherId}-${txn.voucherNo}-${txn.date}-${txn.debit}-${txn.credit}`}>
                <td>{txn.date}</td>
                <td>{txn.voucherNo}</td>
                <td>{txn.voucherType}</td>
                <td>{txn.referenceNo || "—"}</td>
                <td>{txn.narration || "—"}</td>
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
            <td colSpan={5}>Period totals ({data.period.count} lines)</td>
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
