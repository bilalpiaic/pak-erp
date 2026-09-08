import { StockLedgerView } from "@/components/stock/StockLedgerView";
import { PageShell } from "@/components/ui/PageShell";
import { listItems } from "@/lib/items/service";
import { getStockLedger } from "@/lib/stock/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ itemId?: string }>;

export default async function StockLedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let initial = null;
  let items: Awaited<ReturnType<typeof listItems>>["items"] = [];
  let loadError: string | null = null;
  try {
    items = (await listItems()).items;
    if (items.length) {
      initial = await getStockLedger({ itemId: params.itemId?.trim() || items[0]?.id });
    }
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Stock Ledger"
      description="Quantity card per item: opening, posted movements, running quantity and value, closing WAC."
    >
      <StockLedgerView initial={initial} items={items} loadError={loadError} />
    </PageShell>
  );
}
