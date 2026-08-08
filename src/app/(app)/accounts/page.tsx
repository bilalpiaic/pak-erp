import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const prisma = getPrisma();
  const accountCount = await prisma.account.count();

  return (
    <PageShell
      title="Chart of Accounts"
      description="Maintain account codes, types, groups, and active status."
    >
      <div className="mb-4 border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
        PostgreSQL currently holds{" "}
        <span className="font-medium text-[var(--foreground)]">{accountCount}</span> accounts
        (seeded from the legacy prototype). Full CRUD arrives in Phase 3.
      </div>
      <PhasePlaceholder
        phase="Phase 3 — Chart of Accounts"
        summary="List, create, edit, activate/deactivate, and search accounts stored in PostgreSQL."
      />
    </PageShell>
  );
}
