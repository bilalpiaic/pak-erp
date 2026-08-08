import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function VouchersPage() {
  return (
    <PageShell
      title="Voucher Entry"
      description="Create draft vouchers and post balanced double-entry transactions (BPV, BRV, CPV, CRV, JV)."
    >
      <PhasePlaceholder
        phase="Phase 4 — Voucher Engine"
        summary="Debit/credit validation, draft/post/cancel workflow, and transactional posting will land here."
      />
    </PageShell>
  );
}
