import { notFound } from "next/navigation";

import { ReportView } from "@/components/reports/ReportView";
import { PageShell } from "@/components/ui/PageShell";
import { getReport, REPORT_TYPES, type ReportType } from "@/lib/reports/service";

export const dynamic = "force-dynamic";

const REPORT_META: Record<ReportType, { title: string; description: string }> = {
  "trial-balance": {
    title: "Trial Balance",
    description: "Debit and credit balances by account with total and difference checks.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    description: "Assets, equity, and liabilities with an assets = equity + liabilities check.",
  },
  "profit-loss": {
    title: "Profit & Loss",
    description: "Revenue, cost of sales, expenses, and net profit for the selected period.",
  },
  "cash-flow": {
    title: "Cash Flow",
    description: "Basic operating, investing, and financing cash movement from posted transactions.",
  },
  "debtors-aging": {
    title: "Debtors Aging",
    description: "Party receivables aged Current / 1–30 / 31–60 / 61–90 / 91–120 / 120+.",
  },
  "creditors-aging": {
    title: "Creditors Aging",
    description: "Supplier payables aged Current / 1–30 / 31–60 / 61–90 / 91–120 / 120+.",
  },
};

type ReportPageProps = {
  params: Promise<{ type: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { type } = await params;
  if (!REPORT_TYPES.includes(type as ReportType)) notFound();
  const reportType = type as ReportType;
  const meta = REPORT_META[reportType];

  let initial = null;
  let loadError: string | null = null;
  try {
    initial = await getReport(reportType);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell title={meta.title} description={meta.description}>
      <ReportView
        type={reportType}
        title={meta.title}
        initial={initial}
        loadError={loadError}
      />
    </PageShell>
  );
}
