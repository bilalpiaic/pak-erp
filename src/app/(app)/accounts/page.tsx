import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function AccountsPage() {
  return (
    <PageShell
      title="Chart of Accounts"
      description="Maintain account codes, types, groups, and active status."
    >
      <PhasePlaceholder
        phase="Phase 3 — Chart of Accounts"
        summary="List, create, edit, activate/deactivate, and search accounts stored in PostgreSQL."
      />
    </PageShell>
  );
}
