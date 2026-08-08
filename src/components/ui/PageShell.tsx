type PageShellProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <header className="mb-4 border-b border-[var(--border)] pb-3 sm:mb-6 sm:pb-4">
        <h1 className="text-base font-semibold text-[var(--accent)] sm:text-lg lg:text-xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
