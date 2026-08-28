import { Fragment } from "react";

import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { asAtCaption, periodCaption, type CompanyPrintInfo } from "@/lib/print/company";
import type { PrintOrientation } from "@/lib/print/page";
import type { ReportType } from "@/lib/reports/service";

export const REPORT_PRINT_ORIENTATION: Record<ReportType, PrintOrientation> = {
  "trial-balance": "portrait",
  "balance-sheet": "portrait",
  "profit-loss": "portrait",
  "cash-flow": "portrait",
  "debtors-aging": "landscape",
  "creditors-aging": "landscape",
};

type ReportPrintProps = {
  type: ReportType;
  title: string;
  data: Record<string, unknown>;
};

function companyFromReport(data: Record<string, unknown>): CompanyPrintInfo {
  return {
    name: String(data.companyName ?? ""),
    address: (data.companyAddress as string | null) ?? null,
    ntn: (data.companyNtn as string | null) ?? null,
    strn: (data.companyStrn as string | null) ?? null,
    phone: (data.companyPhone as string | null) ?? null,
    email: (data.companyEmail as string | null) ?? null,
    currency: (data.currency as string | null) ?? null,
  };
}

function fyLine(data: Record<string, unknown>): string | null {
  return data.fiscalYearName ? `Fiscal year: ${String(data.fiscalYearName)}` : null;
}

export function ReportPrint({ type, title, data }: ReportPrintProps) {
  const orientation = REPORT_PRINT_ORIENTATION[type];
  const company = companyFromReport(data);
  const period =
    type === "balance-sheet" || type === "debtors-aging" || type === "creditors-aging"
      ? asAtCaption(String(data.to ?? ""))
      : periodCaption(String(data.from ?? ""), String(data.to ?? ""));

  return (
    <PrintSheet orientation={orientation}>
      <PrintLetterhead
        company={company}
        title={title}
        subtitle={fyLine(data)}
        period={period}
      />
      <ReportPrintBody type={type} data={data} />
      <PrintSignatures />
    </PrintSheet>
  );
}

function ReportPrintBody({ type, data }: { type: ReportType; data: Record<string, unknown> }) {
  switch (type) {
    case "trial-balance":
      return <TrialBalancePrint data={data} />;
    case "balance-sheet":
      return <BalanceSheetPrint data={data} />;
    case "profit-loss":
    case "cash-flow":
      return <StatementLinesPrint data={data} />;
    case "debtors-aging":
    case "creditors-aging":
      return <AgingPrint data={data} showWht={type === "creditors-aging"} />;
    default:
      return null;
  }
}

function TrialBalancePrint({ data }: { data: Record<string, unknown> }) {
  const sections =
    (data.sections as Array<{
      group: string;
      items: Array<{ code: string; name: string; debit: string; credit: string }>;
      subtotalDebit: string;
      subtotalCredit: string;
    }>) ?? [];
  const totals = data.totals as {
    debit: string;
    credit: string;
    balanced: boolean;
    difference: string;
  };

  return (
    <>
      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: "14%" }}>Code</th>
            <th>Account</th>
            <th className="num" style={{ width: "18%" }}>
              Debit
            </th>
            <th className="num" style={{ width: "18%" }}>
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.group}>
              <tr className="section-head">
                <td colSpan={4}>{section.group}</td>
              </tr>
              {section.items.map((item) => (
                <tr key={item.code}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td className="num">
                    <PrintAmount value={item.debit} blankZero />
                  </td>
                  <td className="num">
                    <PrintAmount value={item.credit} blankZero />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="indent">
                  Subtotal — {section.group}
                </td>
                <td className="num">
                  <PrintAmount value={section.subtotalDebit} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={section.subtotalCredit} blankZero />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={2}>Grand total</td>
            <td className="num">
              <PrintAmount value={totals.debit} />
            </td>
            <td className="num">
              <PrintAmount value={totals.credit} />
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="print-status">
        {totals.balanced
          ? "Trial Balance is balanced."
          : `Out of balance by ${totals.difference}.`}
      </p>
    </>
  );
}

type StatementLine = {
  label: string;
  amount: string;
  bold?: boolean;
  indent?: boolean;
};

function BalanceSheetPrint({ data }: { data: Record<string, unknown> }) {
  const assets = data.assets as Record<string, StatementLine>;
  const equity = data.equityLiabilities as Record<string, StatementLine>;
  const check = data.check as { balanced: boolean; difference: string; netProfit: string };

  const assetOrder = [
    "fixedGross",
    "accumDep",
    "netFixed",
    "stock",
    "debtors",
    "advances",
    "cash",
    "currentTotal",
    "total",
  ];
  const equityOrder = [
    "capital",
    "retained",
    "equityTotal",
    "longTerm",
    "creditors",
    "accruals",
    "taxes",
    "shortLoans",
    "currentTotal",
    "total",
  ];

  return (
    <>
      <div className="print-two-col">
        <StatementColumnPrint
          title="Assets"
          rows={assetOrder.map((k) => assets[k]).filter(Boolean)}
        />
        <StatementColumnPrint
          title="Equity & Liabilities"
          rows={equityOrder.map((k) => equity[k]).filter(Boolean)}
        />
      </div>
      <p className="print-status">
        Period net profit included in retained earnings:{" "}
        <PrintAmount value={check.netProfit} />
        {" · "}
        {check.balanced
          ? "Assets = Equity + Liabilities"
          : `Out of balance by ${check.difference}`}
      </p>
    </>
  );
}

function StatementColumnPrint({ title, rows }: { title: string; rows: StatementLine[] }) {
  return (
    <div>
      <div className="print-col-title">{title}</div>
      <table className="print-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.bold ? "total-row" : undefined}>
              <td className={`${row.indent ? "indent" : ""} ${row.bold ? "bold" : ""}`}>
                {row.label}
              </td>
              <td className="num">
                <PrintAmount value={row.amount} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementLinesPrint({ data }: { data: Record<string, unknown> }) {
  const lines =
    (data.lines as Array<{
      label: string;
      amount: string | null;
      bold?: boolean;
      indent?: boolean;
      header?: boolean;
    }>) ?? [];

  return (
    <table className="print-table">
      <thead>
        <tr>
          <th>Particulars</th>
          <th className="num" style={{ width: "28%" }}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) =>
          line.header ? (
            <tr key={`${line.label}-${idx}`} className="section-head">
              <td colSpan={2}>{line.label}</td>
            </tr>
          ) : (
            <tr key={`${line.label}-${idx}`} className={line.bold ? "total-row" : undefined}>
              <td className={`${line.indent ? "indent" : ""} ${line.bold ? "bold" : ""}`}>
                {line.label}
              </td>
              <td className="num">
                {line.amount != null ? <PrintAmount value={line.amount} /> : null}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function AgingPrint({
  data,
  showWht,
}: {
  data: Record<string, unknown>;
  showWht: boolean;
}) {
  const parties =
    (data.parties as Array<{
      id?: string | null;
      name: string;
      ntn: string | null;
      outstandingDays: number;
      amount: string;
      buckets: {
        current: string;
        d31: string;
        d61: string;
        d91: string;
        d120: string;
      };
      whtStatus: string | null;
    }>) ?? [];
  const totals = data.totals as {
    total: string;
    current: string;
    d31: string;
    d61: string;
    d91: string;
    d120: string;
    over90: string;
  };
  const whtPending = data.whtPending as string | null;
  const colSpan = showWht ? 10 : 9;

  return (
    <>
      {showWht && whtPending && Number(whtPending) > 0 ? (
        <p className="print-status" style={{ textAlign: "left", marginBottom: 6 }}>
          FBR WHT alert: pending withholding on {whtPending} of creditor balances.
        </p>
      ) : null}
      <table className="print-table">
        <thead>
          <tr>
            <th>Party</th>
            <th>NTN</th>
            <th className="num">Total</th>
            <th className="num">0–30</th>
            <th className="num">31–60</th>
            <th className="num">61–90</th>
            <th className="num">91–120</th>
            <th className="num">&gt;120</th>
            {showWht ? <th>WHT</th> : null}
            <th className="num">Age</th>
          </tr>
        </thead>
        <tbody>
          {parties.length === 0 ? (
            <tr>
              <td colSpan={colSpan}>No outstanding parties.</td>
            </tr>
          ) : (
            parties.map((p) => (
              <tr key={`${p.id ?? p.name}`}>
                <td>{p.name}</td>
                <td>{p.ntn ?? "—"}</td>
                <td className="num">
                  <PrintAmount value={p.amount} />
                </td>
                <td className="num">
                  <PrintAmount value={p.buckets.current} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={p.buckets.d31} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={p.buckets.d61} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={p.buckets.d91} blankZero />
                </td>
                <td className="num">
                  <PrintAmount value={p.buckets.d120} blankZero />
                </td>
                {showWht ? <td>{p.whtStatus ?? "—"}</td> : null}
                <td className="num">{p.outstandingDays}d</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={2}>Total</td>
            <td className="num">
              <PrintAmount value={totals.total} />
            </td>
            <td className="num">
              <PrintAmount value={totals.current} />
            </td>
            <td className="num">
              <PrintAmount value={totals.d31} />
            </td>
            <td className="num">
              <PrintAmount value={totals.d61} />
            </td>
            <td className="num">
              <PrintAmount value={totals.d91} />
            </td>
            <td className="num">
              <PrintAmount value={totals.d120} />
            </td>
            {showWht ? <td /> : null}
            <td />
          </tr>
        </tfoot>
      </table>
    </>
  );
}
