import { ChartOfAccounts } from "@/components/accounts/ChartOfAccounts";
import { PageShell } from "@/components/ui/PageShell";
import { listAccounts } from "@/lib/accounts/service";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  let accounts: Awaited<ReturnType<typeof listAccounts>>["accounts"] = [];
  let groups: Awaited<ReturnType<typeof listAccounts>>["groups"] = [];
  let loadError: string | null = null;

  try {
    const data = await listAccounts();
    accounts = data.accounts;
    groups = data.groups;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Chart of Accounts"
      description="Maintain account codes under BS/P&L COA groups, with Balance Sheet, Profit & Loss, and Cash Flow statement links."
    >
      <ChartOfAccounts
        initialAccounts={accounts}
        initialGroups={groups}
        loadError={loadError}
      />
    </PageShell>
  );
}
