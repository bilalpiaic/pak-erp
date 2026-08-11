import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function JournalPage() {
  return (
    <PageShell
      title="General Journal"
      description="Posted accounting lines with date, voucher, account, party, debit, and credit."
    >
      <PhasePlaceholder
        phase="Phase 5 — Ledger & Journal"
        summary="Filterable journal of posted voucher lines with debit/credit totals and balance check."
      />
    </PageShell>
  );
}
