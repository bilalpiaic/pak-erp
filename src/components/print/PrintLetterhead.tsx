import type { CompanyDTO } from "@/lib/company/types";

type PrintLetterheadProps = {
  company: CompanyDTO | null | undefined;
  title: string;
  subtitle?: string | null;
};

/** Shared company letterhead for invoice / ledger printouts. */
export function PrintLetterhead({ company, title, subtitle }: PrintLetterheadProps) {
  const meta = [
    company?.ntn ? `NTN ${company.ntn}` : null,
    company?.strn ? `STRN ${company.strn}` : null,
    company?.phone ? `Tel ${company.phone}` : null,
    company?.email ?? null,
  ].filter(Boolean);

  return (
    <div className="print-letterhead mb-4 border-b border-[var(--border)] pb-3 text-center">
      <div className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
        {company?.name ?? "Company"}
      </div>
      {company?.address ? (
        <div className="mt-1 whitespace-pre-line text-xs text-[var(--muted)]">
          {company.address}
        </div>
      ) : null}
      {meta.length ? (
        <div className="mt-1 text-[11px] text-[var(--muted-strong)]">{meta.join(" · ")}</div>
      ) : null}
      <div className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
        {title}
      </div>
      {subtitle ? <div className="mt-1 text-xs text-[var(--muted)]">{subtitle}</div> : null}
    </div>
  );
}
