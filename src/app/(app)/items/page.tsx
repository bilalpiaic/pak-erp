import { ItemsView } from "@/components/items/ItemsView";
import { PageShell } from "@/components/ui/PageShell";
import { listItems } from "@/lib/items/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ id?: string }>;

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  let items: Awaited<ReturnType<typeof listItems>>["items"] = [];
  let loadError: string | null = null;
  try {
    items = (await listItems()).items;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Items"
      description="Saleable items come from production (BOMs) and are sold. Consumable items are purchased and used in production. Quantity and value come from posted documents."
    >
      <ItemsView initialItems={items} openItemId={params.id?.trim() || null} loadError={loadError} />
    </PageShell>
  );
}
