"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { PrintButton } from "@/components/print/PrintButton";
import { OriginLink } from "@/components/ui/OriginLink";
import {
  ACCOUNT_TYPES,
  type AccountDTO,
  type AccountGroupSection,
} from "@/lib/accounts/types";
import { accountLedgerHref } from "@/lib/links";

const TYPE_COLORS: Record<string, string> = {
  Asset: "#3b82f6",
  Liability: "#ef4444",
  Equity: "#a78bfa",
  Revenue: "#22c55e",
  Expense: "#f59e0b",
};

type ChartOfAccountsProps = {
  initialAccounts: AccountDTO[];
  initialGroups: AccountGroupSection[];
  loadError?: string | null;
};

export function ChartOfAccounts({
  initialAccounts,
  initialGroups,
  loadError = null,
}: ChartOfAccountsProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<AccountDTO | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, startTransition] = useTransition();
  const skipFirstFetch = useRef(true);

  const visibleCount = useMemo(
    () => groups.reduce((sum, section) => sum + section.accounts.length, 0),
    [groups],
  );

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const params = new URLSearchParams();
          if (search.trim()) params.set("search", search.trim());
          if (typeFilter !== "All") params.set("type", typeFilter);
          if (activeFilter !== "all") params.set("active", activeFilter);

          const response = await fetch(`/api/accounts?${params.toString()}`, {
            signal: controller.signal,
          });
          const data = (await response.json()) as {
            accounts?: AccountDTO[];
            groups?: AccountGroupSection[];
            error?: string;
          };
          if (!response.ok) {
            setError(data.error ?? "Failed to refresh accounts.");
            return;
          }
          setAccounts(data.accounts ?? []);
          setGroups(data.groups ?? []);
          setError(null);
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError("Unable to reach the server.");
        }
      });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [search, typeFilter, activeFilter]);

  async function reload() {
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (typeFilter !== "All") params.set("type", typeFilter);
        if (activeFilter !== "all") params.set("active", activeFilter);

        const response = await fetch(`/api/accounts?${params.toString()}`);
        const data = (await response.json()) as {
          accounts?: AccountDTO[];
          groups?: AccountGroupSection[];
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Failed to refresh accounts.");
          return;
        }
        setAccounts(data.accounts ?? []);
        setGroups(data.groups ?? []);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  async function toggleActive(account: AccountDTO) {
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toggleActiveOnly: true,
          isActive: !account.isActive,
        }),
      });
      const data = (await response.json()) as { account?: AccountDTO; error?: string };
      if (!response.ok || !data.account) {
        setError(data.error ?? "Unable to update account status.");
        return;
      }
      setMessage(
        data.account.isActive
          ? `Activated ${data.account.code} — ${data.account.name}`
          : `Deactivated ${data.account.code} — ${data.account.name}`,
      );
      await reload();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code / name / group..."
            className="field-input sm:max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="field-input sm:w-36"
          >
            <option>All</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
            className="field-input sm:w-36"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-[var(--muted-strong)]">
            {pending ? "Refreshing…" : `${visibleCount} accounts`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModal("create");
            }}
            className="bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)]"
          >
            + New Account
          </button>
        </div>
      </div>

      {message ? (
        <p className="no-print text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="no-print text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="print-only mb-2 text-center">
        <div className="text-base font-semibold">Chart of Accounts</div>
        <div className="text-xs text-[var(--muted)]">{visibleCount} accounts</div>
      </div>

      <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="data-table w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Code</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Account Name</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Group</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Type</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Normal Bal</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Status</th>
              <th className="sticky top-0 bg-[var(--table-head)] px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No accounts match the current filters.
                </td>
              </tr>
            ) : (
              groups.map((section) => (
                <GroupRows
                  key={section.group}
                  section={section}
                  onEdit={(account) => {
                    setEditing(account);
                    setModal("edit");
                  }}
                  onToggle={toggleActive}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted-strong)]">
        Accounts are listed code-wise (1→9) and grouped for hierarchy. Codes are immutable
        after creation; deactivate instead of deleting when transactions exist (
        {accounts.filter((a) => a.hasTransactions).length} accounts currently have posted
        lines).
      </p>

      {modal ? (
        <AccountFormModal
          mode={modal}
          account={editing}
          onClose={() => {
            setModal(null);
            setEditing(null);
          }}
          onSaved={(account) => {
            setModal(null);
            setEditing(null);
            setMessage(
              modal === "create"
                ? `Created ${account.code} — ${account.name}`
                : `Updated ${account.code} — ${account.name}`,
            );
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}

function GroupRows({
  section,
  onEdit,
  onToggle,
}: {
  section: AccountGroupSection;
  onEdit: (account: AccountDTO) => void;
  onToggle: (account: AccountDTO) => void;
}) {
  return (
    <>
      <tr className="bg-[#0f1a30]">
        <td
          colSpan={7}
          className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
        >
          {section.group}
          <span className="ml-2 font-normal text-[var(--muted-strong)]">
            ({section.accounts.length})
          </span>
        </td>
      </tr>
      {section.accounts.map((account) => (
        <tr
          key={account.id}
          className="border-b border-[var(--border)]/60 hover:bg-[rgba(26,37,64,0.45)]"
        >
          <td className="px-3 py-2 font-mono text-xs font-semibold text-[var(--accent)]">
            <OriginLink href={accountLedgerHref(account.code)}>{account.code}</OriginLink>
          </td>
          <td className="px-3 py-2 text-sm font-medium">
            <OriginLink href={accountLedgerHref(account.code)}>{account.name}</OriginLink>
          </td>
          <td className="px-3 py-2 text-xs text-[var(--muted)]">{account.accountGroup}</td>
          <td className="px-3 py-2">
            <span
              className="inline-block px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: "var(--nav-active)",
                color: TYPE_COLORS[account.accountType] ?? "#94a3b8",
              }}
            >
              {account.accountType}
            </span>
          </td>
          <td className="px-3 py-2 text-xs text-[var(--muted)]">{account.normalBalance}</td>
          <td className="px-3 py-2">
            <span
              className="inline-block px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: account.isActive ? "#14532d" : "#3b1f1f",
                color: account.isActive ? "#86efac" : "#fca5a5",
              }}
            >
              {account.isActive ? "Active" : "Inactive"}
            </span>
          </td>
          <td className="px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(account)}
                className="bg-white border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--foreground)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onToggle(account)}
                className="bg-white border border-[var(--border-strong)] px-2.5 py-1 text-[11px] text-[var(--warning)]"
              >
                {account.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
