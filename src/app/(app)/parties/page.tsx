import { PartiesView } from "@/components/parties/PartiesView";
import { PageShell } from "@/components/ui/PageShell";
import { listParties } from "@/lib/parties/service";

export const dynamic = "force-dynamic";

export default async function PartiesPage() {
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
      <PartiesView initialParties={parties} loadError={loadError} />
    </PageShell>
  );
}
