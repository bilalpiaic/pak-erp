"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { GarmentLoopMark } from "@/components/brand/GarmentLoopMark";
import { CurrentUserProvider } from "@/components/auth/CurrentUserProvider";
import { FiscalYearProvider } from "@/components/fiscal-year/FiscalYearProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { CompanyPrintProvider } from "@/components/print/CompanyPrintProvider";
import type { CompanyDTO, FiscalYearDTO } from "@/lib/company/types";

type AppShellProps = {
  company?: CompanyDTO | null;
  companyName?: string;
  ntn?: string | null;
  strn?: string | null;
  currency?: string;
  currentUserName?: string | null;
  currentUserRole?: string | null;
  currentUserUsername?: string | null;
  isDemo?: boolean;
  fiscalYears?: FiscalYearDTO[];
  activeFiscalYear?: FiscalYearDTO | null;
  children: React.ReactNode;
};

export function AppShell({
  company = null,
  companyName = "GarmentLoop ERP",
  ntn,
  strn,
  currency = "PKR",
  currentUserName = null,
  currentUserRole = null,
  currentUserUsername = null,
  isDemo = false,
  fiscalYears = [],
  activeFiscalYear = null,
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
    <FiscalYearProvider fiscalYears={fiscalYears} activeFiscalYear={activeFiscalYear}>
      <CurrentUserProvider
        username={currentUserUsername}
        displayName={currentUserName}
        role={currentUserRole}
        isDemo={isDemo}
      >
      <CompanyPrintProvider company={company}>
      <div className="app-shell flex h-dvh overflow-hidden">
        {/* Desktop / tablet sidebar */}
        <div className="no-print hidden h-full md:flex">
          <Sidebar
            companyName={companyName}
            ntn={ntn}
            strn={strn}
            currency={currency}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
          />
        </div>

        {/* Mobile drawer */}
        <div
          className={`no-print fixed inset-0 z-40 md:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
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
              currency={currency}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
              onNavigate={() => setMobileNavOpen(false)}
              className="w-full shadow-2xl"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print flex items-center gap-3 border-b border-[var(--border)] bg-[var(--sidebar)] px-3 py-2.5 md:hidden">
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
            <GarmentLoopMark size={28} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm font-bold text-[var(--foreground)]">
                {companyName}
              </div>
              <div className="truncate text-[10px] text-[var(--muted)]">
                GarmentLoop ERP · {currency}
                {activeFiscalYear ? ` · ${activeFiscalYear.name}` : ""}
                {isDemo ? " · DEMO" : ""}
              </div>
            </div>
          </header>

          {isDemo ? (
            <div className="no-print border-b border-amber-300/80 bg-[var(--warning-bg)] px-3 py-2 text-center text-[11px] font-medium text-[var(--warning)] sm:text-xs">
              Marketing demo tenant — sample company, forms, and reports only. Live accounting data is
              not shown.
            </div>
          ) : null}

          <main className="app-shell-main min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      </CompanyPrintProvider>
      </CurrentUserProvider>
    </FiscalYearProvider>
  );
}
