import Link from "next/link";

import { PageShell } from "@/components/ui/PageShell";
import { REPORT_LINKS } from "@/lib/navigation";

export default function ReportsPage() {
  return (
    <PageShell
      title="Reports"
      description="Financial statements and aging reports derived from posted voucher lines."
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {REPORT_LINKS.map((report) => (
          <li key={report.href}>
            <Link
              href={report.href}
              className="block border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {report.label}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
