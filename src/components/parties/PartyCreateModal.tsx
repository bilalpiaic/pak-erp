"use client";

import { useEffect, useState } from "react";

import {
  PARTY_TYPES,
  type PartyDTO,
  type PartyInput,
  type PartyTypeValue,
} from "@/lib/parties/types";

type PartyCreateModalProps = {
  defaultPartyType?: PartyTypeValue;
  /** Limit selectable types (e.g. Debtor/Both for sales invoices). */
  allowedTypes?: PartyTypeValue[];
  onClose: () => void;
  onCreated: (party: PartyDTO) => void;
};

export function PartyCreateModal({
  defaultPartyType = "Debtor",
  allowedTypes = [...PARTY_TYPES],
  onClose,
  onCreated,
}: PartyCreateModalProps) {
  const initialType = allowedTypes.includes(defaultPartyType)
    ? defaultPartyType
    : allowedTypes[0] ?? "Debtor";

  const [form, setForm] = useState<PartyInput>({
    name: "",
    ntn: "",
    partyType: initialType,
    phone: "",
    email: "",
    address: "",
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateField<K extends keyof PartyInput>(key: K, value: PartyInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          ntn: form.ntn?.toString().trim() || null,
          phone: form.phone?.toString().trim() || null,
          email: form.email?.toString().trim() || null,
          address: form.address?.toString().trim() || null,
        }),
      });
      const data = (await response.json()) as { party?: PartyDTO; error?: string };
      if (!response.ok || !data.party) {
        setError(data.error ?? "Unable to create party.");
        return;
      }
      onCreated(data.party);
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
        aria-labelledby="party-create-title"
        className="w-full max-w-lg border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="party-create-title" className="text-sm font-semibold text-[var(--accent)]">
            New Party
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
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Name *
              </span>
              <input
                required
                autoFocus
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="field-input"
                placeholder="Customer or supplier name"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Type *
              </span>
              <select
                value={form.partyType}
                onChange={(e) =>
                  updateField("partyType", e.target.value as PartyTypeValue)
                }
                className="field-input"
              >
                {allowedTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                NTN / CNIC
              </span>
              <input
                value={form.ntn ?? ""}
                onChange={(e) => updateField("ntn", e.target.value)}
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Phone
              </span>
              <input
                value={form.phone ?? ""}
                onChange={(e) => updateField("phone", e.target.value)}
                className="field-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Email
              </span>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => updateField("email", e.target.value)}
                className="field-input"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                Address
              </span>
              <input
                value={form.address ?? ""}
                onChange={(e) => updateField("address", e.target.value)}
                className="field-input"
              />
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
              className="border border-[var(--border-strong)] bg-white px-3 py-2 text-[11px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="border border-[var(--accent)] bg-[var(--nav-active)] px-3 py-2 text-[11px] font-semibold text-[var(--accent)]"
            >
              {pending ? "Saving…" : "Create Party"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
