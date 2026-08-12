type PhasePlaceholderProps = {
  phase: string;
  summary: string;
};

export function PhasePlaceholder({ phase, summary }: PhasePlaceholderProps) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--panel)] px-4 py-6 sm:px-5 sm:py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
        {phase}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">{summary}</p>
      <p className="mt-4 text-xs text-[var(--muted-strong)]">
        Amounts will display as{" "}
        <span className="font-medium text-[var(--foreground)]">₨ 1,250,000.00</span> once data
        is connected.
      </p>
    </div>
  );
}
