import { notFound } from "next/navigation";

import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

const REPORTS: Record<string, { title: string; summary: string }> = {
  "trial-balance": {
    title: "Trial Balance",
    summary: "Debit and credit balances by account with total and difference checks.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    summary: "Assets, equity, and liabilities with an assets = equity + liabilities check.",
  },
  "profit-loss": {
    title: "Profit & Loss",
    summary: "Revenue, cost of sales, expenses, and net profit for the selected period.",
  },
  "cash-flow": {
    title: "Cash Flow",
    summary: "Basic operating, investing, and financing cash movement from posted transactions.",
  },
  "debtors-aging": {
    title: "Debtors Aging",
    summary: "Party receivables aged Current / 1–30 / 31–60 / 61–90 / 91–120 / 120+.",
  },
  "creditors-aging": {
    title: "Creditors Aging",
    summary: "Supplier payables aged Current / 1–30 / 31–60 / 61–90 / 91–120 / 120+.",
  },
};

type ReportPageProps = {
  params: Promise<{ type: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { type } = await params;
  const report = REPORTS[type];
  if (!report) notFound();

  return (
    <PageShell title={report.title} description={report.summary}>
      <PhasePlaceholder
        phase="Phase 6 — Reports"
        summary={`${report.title} will be calculated server-side from posted voucher lines using NUMERIC(18,2) precision.`}
      />
    </PageShell>
  );
}
