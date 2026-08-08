import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { PageShell } from "@/components/ui/PageShell";
import { getPrimaryCompanyWithFiscalYear } from "@/lib/company/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getPrimaryCompanyWithFiscalYear();

  return (
    <PageShell
      title="Company Settings"
      description="Company name, address, NTN, STRN, phone, email, currency, and fiscal year — persisted in PostgreSQL."
    >
      <CompanySettingsForm
        company={data?.company ?? null}
        fiscalYear={data?.fiscalYear ?? null}
      />
    </PageShell>
  );
}
