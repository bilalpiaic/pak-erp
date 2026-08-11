import { DashboardView } from "@/components/dashboard/DashboardView";
import { PageShell } from "@/components/ui/PageShell";
import { getDashboard } from "@/lib/dashboard/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data = null;
  let loadError: string | null = null;

  try {
    data = await getDashboard();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Dashboard"
      description="Live financial KPIs and recent vouchers from posted accounting transactions."
    >
      <DashboardView data={data} loadError={loadError} />
    </PageShell>
  );
}
