import { StockAdjustmentEntry } from "@/components/stock/StockAdjustmentEntry";
import { PageShell } from "@/components/ui/PageShell";
import { listItems } from "@/lib/items/service";
import { getStockAdjustment, listStockAdjustments } from "@/lib/stock-adjustments/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ id?: string }>;

export default async function StockAdjustmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let adjustments: Awaited<ReturnType<typeof listStockAdjustments>>["adjustments"] = [];
  let items: Awaited<ReturnType<typeof listItems>>["items"] = [];
  let openAdjustment: Awaited<ReturnType<typeof getStockAdjustment>> = null;
  let loadError: string | null = null;
  try {
    const [adj, itemData] = await Promise.all([listStockAdjustments(), listItems({ active: "active" })]);
    adjustments = adj.adjustments;
    items = itemData.items;
    if (params.id?.trim()) openAdjustment = await getStockAdjustment(params.id.trim());
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Stock Adjustments"
      description="Opening stock, gains, losses, and count adjustments. Posting writes quantity and the matching 1020 journal in one transaction."
    >
      <StockAdjustmentEntry
        initialAdjustments={adjustments}
        items={items}
        openAdjustment={openAdjustment}
        loadError={loadError}
      />
    </PageShell>
  );
}
