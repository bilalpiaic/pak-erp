import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function LedgerPage() {
  return (
    <PageShell
      title="Account Ledger"
      description="Opening balance, transactions, running balance, and closing balance by account and date range."
    >
      <PhasePlaceholder
        phase="Phase 5 — Ledger & Journal"
        summary="Server-side ledger calculation from posted voucher lines will replace client-side localStorage math."
      />
    </PageShell>
  );
}
