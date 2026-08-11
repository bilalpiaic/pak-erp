"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  type AccountDTO,
  type AccountInput,
  type AccountType,
} from "@/lib/accounts/types";
import {
  BS_BY_TYPE,
  BS_SECTION_LABELS,
  CF_BY_TYPE,
  CF_LINK_LABELS,
  GROUPS_BY_TYPE,
  PL_BY_TYPE,
  PL_SECTION_LABELS,
  defaultsForTypeGroup,
  suggestCfLink,
  type BsSection,
  type CfLink,
  type PlSection,
} from "@/lib/accounts/report-links";

type AccountFormModalProps = {
  mode: "create" | "edit";
  account?: AccountDTO | null;
  onClose: () => void;
  onSaved: (account: AccountDTO) => void;
};

function blankForm(): AccountInput {
  const defaults = defaultsForTypeGroup("Asset", "Current Assets");
  return {
    code: "",
    name: "",
    accountType: "Asset",
    accountGroup: defaults.accountGroup,
    bsSection: defaults.bsSection,
    plSection: defaults.plSection,
    cfLink: defaults.cfLink,
    normalBalance: defaults.normalBalance,
    isActive: true,
  };
}

export function AccountFormModal({
  mode,
  account,
  onClose,
  onSaved,
}: AccountFormModalProps) {
  const [form, setForm] = useState<AccountInput>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (mode === "edit" && account) {
      setForm({
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        accountGroup: account.accountGroup ?? defaultsForTypeGroup(account.accountType).accountGroup,
        bsSection: account.bsSection,
        plSection: account.plSection,
        cfLink: account.cfLink,
        normalBalance: account.normalBalance,
        isActive: account.isActive,
      });
    } else {
      setForm(blankForm());
    }
  }, [mode, account]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groupOptions = useMemo(
    () => GROUPS_BY_TYPE[form.accountType] ?? [],
    [form.accountType],
  );
  const bsOptions = useMemo(() => BS_BY_TYPE[form.accountType] ?? [], [form.accountType]);
  const plOptions = useMemo(() => PL_BY_TYPE[form.accountType] ?? [], [form.accountType]);
  const cfOptions = useMemo(() => CF_BY_TYPE[form.accountType] ?? [], [form.accountType]);

  const isBalanceSheetType =
    form.accountType === "Asset" ||
    form.accountType === "Liability" ||
    form.accountType === "Equity";

  function updateField<K extends keyof AccountInput>(key: K, value: AccountInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function onTypeChange(nextType: AccountType) {
    const defaults = defaultsForTypeGroup(nextType);
    setForm((prev) => ({
      ...prev,
      accountType: nextType,
      accountGroup: defaults.accountGroup,
      normalBalance: defaults.normalBalance,
      bsSection: defaults.bsSection,
      plSection: defaults.plSection,
      cfLink: defaults.cfLink,
    }));
    setError(null);
  }

  function onGroupChange(group: string) {
    const defaults = defaultsForTypeGroup(form.accountType, group);
    setForm((prev) => ({
      ...prev,
      accountGroup: group,
      bsSection: defaults.bsSection,
      plSection: defaults.plSection,
      cfLink: defaults.cfLink,
      normalBalance: defaults.normalBalance,
    }));
    setError(null);
  }

  function onBsChange(bsSection: BsSection) {
    setForm((prev) => ({
      ...prev,
      bsSection,
      cfLink: suggestCfLink(prev.accountType, bsSection, (prev.plSection as PlSection) ?? "None"),
    }));
    setError(null);
  }

  function onPlChange(plSection: PlSection) {
    setForm((prev) => ({
      ...prev,
      plSection,
      cfLink: suggestCfLink(prev.accountType, (prev.bsSection as BsSection) ?? "None", plSection),
    }));
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
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
                Type (BS / P&L class) *
              </span>
              <select
                value={form.accountType}
                onChange={(e) => onTypeChange(e.target.value as AccountType)}
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
                COA Sub-group *
              </span>
              <select
                value={form.accountGroup ?? ""}
                onChange={(e) => onGroupChange(e.target.value)}
                className="field-input"
              >
                {groupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Balance Sheet head {isBalanceSheetType ? "*" : ""}
              </span>
              <select
                value={form.bsSection ?? "None"}
                onChange={(e) => onBsChange(e.target.value as BsSection)}
                className="field-input"
                disabled={!isBalanceSheetType}
              >
                {bsOptions.map((section) => (
                  <option key={section} value={section}>
                    {BS_SECTION_LABELS[section]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Profit &amp; Loss head {!isBalanceSheetType ? "*" : ""}
              </span>
              <select
                value={form.plSection ?? "None"}
                onChange={(e) => onPlChange(e.target.value as PlSection)}
                className="field-input"
                disabled={isBalanceSheetType}
              >
                {plOptions.map((section) => (
                  <option key={section} value={section}>
                    {PL_SECTION_LABELS[section]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Cash Flow link
              </span>
              <select
                value={form.cfLink ?? "None"}
                onChange={(e) => updateField("cfLink", e.target.value as CfLink)}
                className="field-input"
              >
                {cfOptions.map((link) => (
                  <option key={link} value={link}>
                    {CF_LINK_LABELS[link]}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-[var(--muted-strong)]">
                New accounts roll into BS / P&amp;L / CF from these links — not from account code.
              </span>
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
