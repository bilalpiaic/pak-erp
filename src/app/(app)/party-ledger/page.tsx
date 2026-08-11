import { PartyLedgerView } from "@/components/party-ledger/PartyLedgerView";
import { PageShell } from "@/components/ui/PageShell";
import { listParties } from "@/lib/parties/service";
import {
  getPartyLedger,
  type PartyLedgerKind,
  type PartyLedgerResult,
} from "@/lib/party-ledger/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  partyId?: string;
  kind?: string;
}>;

export default async function PartyLedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const partyId = params.partyId?.trim() || null;
  const kind =
    params.kind === "debtor" || params.kind === "creditor"
      ? (params.kind as PartyLedgerKind)
      : null;

  let parties: Awaited<ReturnType<typeof listParties>>["parties"] = [];
  let initial: PartyLedgerResult | null = null;
  let loadError: string | null = null;

  try {
    parties = (await listParties({ active: "active" })).parties;
    if (partyId) {
      initial = await getPartyLedger({
        partyId,
        kind: kind ?? undefined,
      });
    }
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Party Ledger"
      description="Individual debtor or creditor ledger with opening, movements, and closing balance — ready to print."
    >
      <PartyLedgerView
        parties={parties}
        initialPartyId={partyId}
        initialKind={kind ?? initial?.kind ?? null}
        initial={initial}
        loadError={loadError}
      />
    </PageShell>
  );
}
