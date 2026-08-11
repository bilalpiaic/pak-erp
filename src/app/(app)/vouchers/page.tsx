import { VoucherEntry } from "@/components/vouchers/VoucherEntry";
import { PageShell } from "@/components/ui/PageShell";
import { listAccounts } from "@/lib/accounts/service";
import { listVouchers } from "@/lib/vouchers/service";

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  let vouchers: Awaited<ReturnType<typeof listVouchers>>["vouchers"] = [];
  let accounts: Awaited<ReturnType<typeof listAccounts>>["accounts"] = [];
  let loadError: string | null = null;

  try {
    const [voucherData, accountData] = await Promise.all([
      listVouchers(),
      listAccounts({ active: "all" }),
    ]);
    vouchers = voucherData.vouchers;
    accounts = accountData.accounts;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Voucher Entry"
      description="Create draft vouchers and post balanced double-entry transactions (BPV, BRV, CPV, CRV, JV). Posted vouchers are immutable — cancel instead of editing."
    >
      <VoucherEntry
        initialVouchers={vouchers}
        accounts={accounts}
        loadError={loadError}
      />
    </PageShell>
  );
}
