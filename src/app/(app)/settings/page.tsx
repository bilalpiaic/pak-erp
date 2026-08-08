import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { PageShell } from "@/components/ui/PageShell";
import { getPrimaryCompanyWithFiscalYear } from "@/lib/company/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let data = null;
  let dbError: string | null = null;

  try {
    data = await getPrimaryCompanyWithFiscalYear();
  } catch (error) {
    dbError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Company Settings"
      description="Company name, address, NTN, STRN, phone, email, currency, and fiscal year — persisted in PostgreSQL."
    >
      {dbError ? (
        <div className="mb-4 border border-[var(--warning-bg)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--warning)]">
          {dbError}
        </div>
      ) : null}
      <CompanySettingsForm
        company={data?.company ?? null}
        fiscalYear={data?.fiscalYear ?? null}
      />
    </PageShell>
  );
}
