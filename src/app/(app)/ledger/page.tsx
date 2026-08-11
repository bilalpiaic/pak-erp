import { LedgerView } from "@/components/ledger/LedgerView";
import { PageShell } from "@/components/ui/PageShell";
import { getLedger, listLedgerAccounts } from "@/lib/ledger/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ account?: string }>;

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  let initial = null;
  let accounts: Awaited<ReturnType<typeof listLedgerAccounts>> = [];
  let loadError: string | null = null;

  try {
    accounts = await listLedgerAccounts();
    const requested = params.account?.trim();
    const accountCode =
      (requested && accounts.find((a) => a.code === requested)?.code) ||
      accounts.find((a) => a.code === "1002")?.code ||
      accounts[0]?.code;
    initial = await getLedger({ accountCode });
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Account Ledger"
      description="Opening balance, transactions, running balance, and closing balance by account and date range."
    >
      <LedgerView initial={initial} accounts={accounts} loadError={loadError} />
    </PageShell>
  );
}
