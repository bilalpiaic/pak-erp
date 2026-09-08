import { StockValuationView } from "@/components/stock/StockValuationView";
import { PageShell } from "@/components/ui/PageShell";
import { getStockValuation } from "@/lib/stock/service";

export const dynamic = "force-dynamic";

export default async function StockValuationPage() {
  let initial = null;
  let loadError: string | null = null;
  try {
    initial = await getStockValuation();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Stock Valuation"
      description="On-hand quantity × weighted average cost versus posted Stock in Trade (1020). Difference must be zero when quantity flows are in sync."
    >
      <StockValuationView initial={initial} loadError={loadError} />
    </PageShell>
  );
}
