type PageShellProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <header className="mb-6 border-b border-[var(--border)] pb-4">
        <h1 className="text-lg font-semibold text-[var(--accent)]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
