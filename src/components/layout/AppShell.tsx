"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";

type AppShellProps = {
  companyName?: string;
  ntn?: string | null;
  strn?: string | null;
  children: React.ReactNode;
};

export function AppShell({
  companyName = "GarmentLoop ERP",
  ntn,
  strn,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop / tablet sidebar */}
      <div className="hidden h-full md:flex">
        <Sidebar companyName={companyName} ntn={ntn} strn={strn} />
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
            mobileNavOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 flex h-full w-[min(18rem,86vw)] transform transition-transform duration-200 ease-out ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar
            companyName={companyName}
            ntn={ntn}
            strn={strn}
            onNavigate={() => setMobileNavOpen(false)}
            className="w-full shadow-2xl"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--sidebar)] px-3 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center border border-[var(--border-strong)] bg-[var(--panel)] text-[var(--foreground)]"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
          >
            <span className="sr-only">Open menu</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M3 4.5h12M3 9h12M3 13.5h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-[var(--foreground)]">
              {companyName}
            </div>
            <div className="truncate text-[10px] text-[var(--muted)]">GarmentLoop ERP · PKR</div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
