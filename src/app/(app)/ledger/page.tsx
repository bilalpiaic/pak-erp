import { LedgerView } from "@/components/ledger/LedgerView";
import { PageShell } from "@/components/ui/PageShell";
import { getLedger, listLedgerAccounts } from "@/lib/ledger/service";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  let initial = null;
  let accounts: Awaited<ReturnType<typeof listLedgerAccounts>> = [];
  let loadError: string | null = null;

  try {
    accounts = await listLedgerAccounts();
    initial = await getLedger({
      accountCode: accounts.find((a) => a.code === "1002")?.code ?? accounts[0]?.code,
    });
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
