import { VoucherEntry } from "@/components/vouchers/VoucherEntry";
import { PageShell } from "@/components/ui/PageShell";
import { listAccounts } from "@/lib/accounts/service";
import { getPrimaryCompany } from "@/lib/company/service";
import { listParties } from "@/lib/parties/service";
import { listVouchers } from "@/lib/vouchers/service";

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  let vouchers: Awaited<ReturnType<typeof listVouchers>>["vouchers"] = [];
  let accounts: Awaited<ReturnType<typeof listAccounts>>["accounts"] = [];
  let parties: Awaited<ReturnType<typeof listParties>>["parties"] = [];
  let company: Awaited<ReturnType<typeof getPrimaryCompany>> = null;
  let loadError: string | null = null;

  try {
    const [voucherData, accountData, partyData, companyData] = await Promise.all([
      listVouchers(),
      listAccounts({ active: "all" }),
      listParties({ active: "active" }),
      getPrimaryCompany(),
    ]);
    vouchers = voucherData.vouchers;
    accounts = accountData.accounts;
    parties = partyData.parties;
    company = companyData;
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
        parties={parties}
        company={company}
        loadError={loadError}
      />
    </PageShell>
  );
}
