import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth/request";
import { getPrimaryCompany } from "@/lib/company/service";
import { getActiveFiscalYear, listFiscalYears } from "@/lib/fiscal-years/service";
import { ensureSeedAdmin } from "@/lib/users/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let company = null;
  let fiscalYears: Awaited<ReturnType<typeof listFiscalYears>> = [];
  let activeFiscalYear = null;
  let session = null;

  try {
    await ensureSeedAdmin();
    session = await getSession();
    company = await getPrimaryCompany();
    if (company) {
      [fiscalYears, activeFiscalYear] = await Promise.all([
        listFiscalYears(),
        getActiveFiscalYear(),
      ]);
    }
  } catch (error) {
    console.error("Failed to load company for shell:", error);
  }

  return (
    <AppShell
      companyName={company?.name ?? "GarmentLoop ERP"}
      ntn={company?.ntn}
      strn={company?.strn}
      currency={company?.currency ?? "PKR"}
      currentUserName={session?.displayName ?? session?.username ?? null}
      currentUserRole={session?.role ?? null}
      fiscalYears={fiscalYears}
      activeFiscalYear={activeFiscalYear}
    >
      {children}
    </AppShell>
  );
}
