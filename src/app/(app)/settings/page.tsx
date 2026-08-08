import { PageShell } from "@/components/ui/PageShell";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function SettingsPage() {
  return (
    <PageShell
      title="Company Settings"
      description="Company name, address, NTN, STRN, phone, email, currency, and fiscal year."
    >
      <PhasePlaceholder
        phase="Phase 2 — Database"
        summary="Company master data will be stored in PostgreSQL and editable from this screen."
      />
    </PageShell>
  );
}
