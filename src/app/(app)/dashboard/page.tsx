import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";
import { formatCurrency } from "@/lib/formatting/money";

const KPI_LABELS = [
  "Total Assets",
  "Total Liabilities",
  "Revenue",
  "Expenses",
  "Net Profit",
  "Cash & Bank",
] as const;

export default function DashboardPage() {
  return (
    <PageShell
      title="Dashboard"
      description="Company overview. Live KPIs will load from posted voucher lines in a later phase."
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 lg:grid-cols-3">
        {KPI_LABELS.map((label) => (
          <div
            key={label}
            className="border border-[var(--border)] bg-[var(--panel)] px-3 py-3 sm:px-4"
          >
            <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--muted)] sm:text-[11px]">
              {label}
            </div>
            <div className="mt-1 font-mono text-sm font-medium text-[var(--foreground)] sm:text-base">
              {formatCurrency(0)}
            </div>
          </div>
        ))}
      </div>

      <PhasePlaceholder
        phase="Phase 7 — Dashboard data"
        summary="Financial KPIs, recent vouchers, and cash position will be calculated server-side from posted accounting transactions."
      />
    </PageShell>
  );
}
