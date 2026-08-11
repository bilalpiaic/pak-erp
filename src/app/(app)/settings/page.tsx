import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { FiscalYearManager } from "@/components/settings/FiscalYearManager";
import { PageShell } from "@/components/ui/PageShell";
import { getPrimaryCompanyWithFiscalYear } from "@/lib/company/service";
import { listFiscalYears } from "@/lib/fiscal-years/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let data = null;
  let fiscalYears: Awaited<ReturnType<typeof listFiscalYears>> = [];
  let dbError: string | null = null;

  try {
    data = await getPrimaryCompanyWithFiscalYear();
    if (data?.company) {
      fiscalYears = await listFiscalYears();
    }
  } catch (error) {
    dbError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Company Settings"
      description="Company profile and fiscal years — select the active year in the sidebar for ledgers and reports."
    >
      {dbError ? (
        <div className="mb-4 border border-[var(--warning-bg)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--warning)]">
          {dbError}
        </div>
      ) : null}
      <div className="space-y-5">
        <CompanySettingsForm
          company={data?.company ?? null}
          fiscalYear={data?.fiscalYear ?? null}
        />
        {data?.company ? <FiscalYearManager initialYears={fiscalYears} /> : null}
      </div>
    </PageShell>
  );
}
