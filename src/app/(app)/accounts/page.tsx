import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  let accountCount: number | null = null;
  let dbError: string | null = null;

  try {
    accountCount = await getPrisma().account.count();
  } catch (error) {
    dbError =
      error instanceof Error
        ? error.message
        : "Database is unavailable. Check DATABASE_URL and run migrations.";
  }

  return (
    <PageShell
      title="Chart of Accounts"
      description="Maintain account codes, types, groups, and active status."
    >
      {dbError ? (
        <div className="mb-4 border border-[var(--warning-bg)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--warning)]">
          {dbError}
        </div>
      ) : (
        <div className="mb-4 border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
          PostgreSQL currently holds{" "}
          <span className="font-medium text-[var(--foreground)]">{accountCount}</span> accounts
          (seeded from the legacy prototype). Full CRUD arrives in Phase 3.
        </div>
      )}
      <PhasePlaceholder
        phase="Phase 3 — Chart of Accounts"
        summary="List, create, edit, activate/deactivate, and search accounts stored in PostgreSQL."
      />
    </PageShell>
  );
}
