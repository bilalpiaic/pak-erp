import { JournalView } from "@/components/journal/JournalView";
import { PageShell } from "@/components/ui/PageShell";
import { getJournal } from "@/lib/journal/service";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  let initial = null;
  let loadError: string | null = null;

  try {
    initial = await getJournal();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="General Journal"
      description="Posted accounting lines with date, voucher, account, party, debit, and credit."
    >
      <JournalView initial={initial} loadError={loadError} />
    </PageShell>
  );
}
