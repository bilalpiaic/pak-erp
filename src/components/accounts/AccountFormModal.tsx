"use client";

import { useEffect, useState } from "react";

import {
  ACCOUNT_GROUPS,
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  type AccountDTO,
  type AccountInput,
} from "@/lib/accounts/types";

type AccountFormModalProps = {
  mode: "create" | "edit";
  account?: AccountDTO | null;
  onClose: () => void;
  onSaved: (account: AccountDTO) => void;
};

const blank: AccountInput = {
  code: "",
  name: "",
  accountType: "Asset",
  accountGroup: "Current Assets",
  normalBalance: "Debit",
  isActive: true,
};

export function AccountFormModal({
  mode,
  account,
  onClose,
  onSaved,
}: AccountFormModalProps) {
  const [form, setForm] = useState<AccountInput>(blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (mode === "edit" && account) {
      setForm({
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        accountGroup: account.accountGroup ?? "Current Assets",
        normalBalance: account.normalBalance,
        isActive: account.isActive,
      });
    } else {
      setForm(blank);
    }
  }, [mode, account]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateField<K extends keyof AccountInput>(key: K, value: AccountInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        mode === "create" ? "/api/accounts" : `/api/accounts/${account?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = (await response.json()) as { account?: AccountDTO; error?: string };
      if (!response.ok || !data.account) {
        setError(data.error ?? "Unable to save account.");
        return;
      }
      onSaved(data.account);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        className="w-full max-w-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="account-modal-title" className="text-sm font-semibold text-[var(--accent)]">
            {mode === "create" ? "New Account" : "Edit Account"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Account Code *
              </span>
              <input
                required
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
                readOnly={mode === "edit"}
                className="field-input disabled:opacity-70"
                disabled={mode === "edit"}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Account Name *
              </span>
              <input
                required
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Group
              </span>
              <select
                value={form.accountGroup ?? ""}
                onChange={(e) => updateField("accountGroup", e.target.value)}
                className="field-input"
              >
                {ACCOUNT_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Type
              </span>
              <select
                value={form.accountType}
                onChange={(e) =>
                  updateField("accountType", e.target.value as AccountInput["accountType"])
                }
                className="field-input"
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Normal Balance
              </span>
              <select
                value={form.normalBalance}
                onChange={(e) =>
                  updateField(
                    "normalBalance",
                    e.target.value as AccountInput["normalBalance"],
                  )
                }
                className="field-input"
              >
                {NORMAL_BALANCES.map((balance) => (
                  <option key={balance} value={balance}>
                    {balance}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Status
              </span>
              <select
                value={form.isActive ? "Active" : "Inactive"}
                onChange={(e) => updateField("isActive", e.target.value === "Active")}
                className="field-input"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-[var(--border-strong)] px-3 py-2 text-xs text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
