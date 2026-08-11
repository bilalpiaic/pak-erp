import { AppShell } from "@/components/layout/AppShell";
import { getPrimaryCompany } from "@/lib/company/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let company = null;
  try {
    company = await getPrimaryCompany();
  } catch (error) {
    console.error("Failed to load company for shell:", error);
  }

  return (
    <AppShell
      companyName={company?.name ?? "GarmentLoop ERP"}
      ntn={company?.ntn}
      strn={company?.strn}
    >
      {children}
    </AppShell>
  );
}
