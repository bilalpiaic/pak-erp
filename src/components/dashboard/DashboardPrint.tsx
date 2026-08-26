import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import type { DashboardResult } from "@/lib/dashboard/service";
import { asAtCaption } from "@/lib/print/company";

type DashboardPrintProps = {
  data: DashboardResult;
};

export function DashboardPrint({ data }: DashboardPrintProps) {
  return (
    <PrintSheet orientation="portrait">
      <PrintLetterhead
        title="Accounting Dashboard"
        subtitle={data.fiscalYearName ? `Fiscal year: ${data.fiscalYearName}` : null}
        period={asAtCaption(data.asOf)}
        company={{ name: data.companyName }}
      />
      <div className="print-kpi-grid">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="print-kpi">
            <div className="print-kpi-label">{kpi.label}</div>
            <div className="print-kpi-value">
              <PrintAmount value={kpi.value} />
            </div>
          </div>
        ))}
      </div>
      <div className="print-col-title">Recent vouchers</div>
      <table className="print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher</th>
            <th>Type</th>
            <th>Party</th>
            <th>Narration</th>
            <th className="num">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.recent.length === 0 ? (
            <tr>
              <td colSpan={7}>No recent vouchers.</td>
            </tr>
          ) : (
            data.recent.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td>
                <td>{row.voucherNo}</td>
                <td>{row.voucherType}</td>
                <td>{row.partyName ?? "—"}</td>
                <td>{row.narration ?? ""}</td>
                <td className="num">
                  <PrintAmount value={row.amount} />
                </td>
                <td>{row.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <PrintSignatures />
    </PrintSheet>
  );
}
