import { PartiesView } from "@/components/parties/PartiesView";
import { PageShell } from "@/components/ui/PageShell";
import { listParties } from "@/lib/parties/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ id?: string }>;

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  let parties: Awaited<ReturnType<typeof listParties>>["parties"] = [];
  let loadError: string | null = null;

  try {
    parties = (await listParties()).parties;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Parties"
      description="Debtors and creditors master with NTN/CNIC and WHT status for FBR-oriented aging and vouchers."
    >
      <PartiesView
        initialParties={parties}
        openPartyId={params.id?.trim() || null}
        loadError={loadError}
      />
    </PageShell>
  );
}
