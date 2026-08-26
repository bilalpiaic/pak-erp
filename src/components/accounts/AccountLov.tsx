"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { AccountDTO } from "@/lib/accounts/types";

type AccountLovProps = {
  accounts: AccountDTO[];
  value: string;
  disabled?: boolean;
  onChange: (accountId: string) => void;
  placeholder?: string;
};

function accountLabel(account: AccountDTO): string {
  return `${account.code} — ${account.name}`;
}

function matchesQuery(account: AccountDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    account.code.toLowerCase().includes(q) ||
    account.name.toLowerCase().includes(q) ||
    (account.accountGroup ?? "").toLowerCase().includes(q) ||
    account.accountType.toLowerCase().includes(q) ||
    account.bsSection.toLowerCase().includes(q)
  );
}

export function AccountLov({
  accounts,
  value,
  disabled = false,
  onChange,
  placeholder = "-- Select account --",
}: AccountLovProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [index, setIndex] = useState(0);

  const selected = accounts.find((account) => account.id === value) ?? null;

  const filtered = useMemo(
    () => accounts.filter((account) => matchesQuery(account, filter)),
    [accounts, filter],
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [filter, open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((account) => account.id === value);
    if (selectedIndex >= 0) setIndex(selectedIndex);
  }, [open, filtered, value]);

  function openLov(initialFilter = "") {
    if (disabled) return;
    setFilter(initialFilter);
    setOpen(true);
  }

  function closeLov() {
    setOpen(false);
    setFilter("");
    inputRef.current?.focus();
  }

  function pick(account: AccountDTO) {
    onChange(account.id);
    setOpen(false);
    setFilter("");
    inputRef.current?.focus();
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "F5" || event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      openLov();
    }
  }

  function onLovKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "F5") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeLov();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!filtered.length) return;
      setIndex((i) => (i + 1) % filtered.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!filtered.length) return;
      setIndex((i) => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = filtered[index];
      if (chosen) pick(chosen);
    }
  }

  return (
    <>
      <div className="flex min-w-[240px] items-stretch gap-1">
        <input
          ref={inputRef}
          readOnly
          disabled={disabled}
          value={selected ? accountLabel(selected) : ""}
          placeholder={placeholder}
          onClick={() => openLov()}
          onKeyDown={onFieldKeyDown}
          className="field-input flex-1 cursor-pointer"
          title="List of Values (F5)"
          aria-haspopup="dialog"
        />
        <button
          type="button"
          disabled={disabled}
          title="List of Values (F5)"
          onClick={() => openLov()}
          className="shrink-0 border border-[var(--border-strong)] bg-white px-2 py-2 text-[10px] font-semibold text-[var(--accent)] disabled:opacity-50"
        >
          LOV
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={onLovKeyDown}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLov();
          }}
        >
          <div className="flex w-full max-w-lg flex-col border border-[var(--border)] bg-[var(--panel)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <h2 id={titleId} className="text-sm font-semibold text-[var(--foreground)]">
                Chart of Accounts
              </h2>
              <button
                type="button"
                className="px-2 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={closeLov}
              >
                Close
              </button>
            </div>
            <div className="space-y-2 p-3">
              <input
                ref={searchRef}
                className="field-input w-full"
                placeholder="Search code, name, group…"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <ul className="max-h-72 overflow-auto border border-[var(--border)]">
                {filtered.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                    No accounts found.
                  </li>
                ) : (
                  filtered.map((account, rowIndex) => {
                    const active = rowIndex === index;
                    return (
                      <li key={account.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                            active
                              ? "bg-[var(--nav-active)] font-semibold"
                              : "hover:bg-[var(--table-row-hover)]"
                          }`}
                          onMouseEnter={() => setIndex(rowIndex)}
                          onClick={() => pick(account)}
                        >
                          <span>
                            <span className="font-mono text-[var(--accent)]">{account.code}</span>
                            <span className="ml-2">{account.name}</span>
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--muted)]">
                            {account.accountGroup ?? account.accountType}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <p className="text-[10px] text-[var(--muted-strong)]">
                Type to filter · ↑↓ select · Enter pick · Esc close · F5 LOV
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
