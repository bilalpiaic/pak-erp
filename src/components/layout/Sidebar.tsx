"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "@/lib/navigation";

type SidebarProps = {
  companyName?: string;
  ntn?: string | null;
  strn?: string | null;
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({
  companyName = "GarmentLoop ERP",
  ntn,
  strn,
  onNavigate,
  className = "",
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] lg:w-[240px] ${className}`}
    >
      <div className="border-b border-[var(--border)] px-3.5 py-4">
        <div className="font-display text-[14px] font-bold leading-snug text-[var(--foreground)]">
          {companyName}
        </div>
        {ntn ? (
          <div className="mt-1 text-[10px] text-[var(--muted)]">NTN: {ntn}</div>
        ) : null}
        {strn ? (
          <div className="text-[10px] text-[var(--muted)]">STRN: {strn}</div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-strong)]">
              {section.title}
            </div>
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex w-full items-center border-l-[3px] px-3.5 py-2.5 text-left text-xs transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--nav-active)] font-semibold text-[var(--foreground)]"
                      : "border-transparent text-[var(--nav)] hover:bg-[var(--nav-hover)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] px-3.5 py-2.5 text-[10px] text-[var(--muted-strong)]">
        FY Jul–Jun · PKR ₨
      </div>
    </aside>
  );
}
