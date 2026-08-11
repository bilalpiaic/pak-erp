import { AppShell } from "@/components/layout/AppShell";
import { getPrimaryCompany } from "@/lib/company/service";
import { getActiveFiscalYear, listFiscalYears } from "@/lib/fiscal-years/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let company = null;
  let fiscalYears: Awaited<ReturnType<typeof listFiscalYears>> = [];
  let activeFiscalYear = null;

  try {
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
      fiscalYears={fiscalYears}
      activeFiscalYear={activeFiscalYear}
    >
      {children}
    </AppShell>
  );
}
