"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PrintButton } from "@/components/print/PrintButton";
import { OriginLink } from "@/components/ui/OriginLink";
import { formatCurrency } from "@/lib/formatting/money";
import { partyKindFromType, partyLedgerHref } from "@/lib/links";
import {
  PARTY_TYPES,
  type PartyDTO,
  type PartyInput,
  type PartyTypeValue,
} from "@/lib/parties/types";

type PartiesViewProps = {
  initialParties: PartyDTO[];
  openPartyId?: string | null;
  loadError?: string | null;
};

const EMPTY: PartyInput = {
  name: "",
  ntn: "",
  partyType: "Debtor",
  phone: "",
  email: "",
  address: "",
  isActive: true,
  outstandingDays: null,
  outstandingAmount: "0.00",
  whtStatus: "",
};

export function PartiesView({
  initialParties,
  openPartyId = null,
  loadError = null,
}: PartiesViewProps) {
  const router = useRouter();
  const [parties, setParties] = useState(initialParties);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [error, setError] = useState<string | null>(loadError);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartyDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PartyInput>(EMPTY);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!openPartyId) return;
    const party = initialParties.find((p) => p.id === openPartyId);
    if (!party) return;
    setCreating(false);
    setEditing(party);
    setForm({
      name: party.name,
      ntn: party.ntn ?? "",
      partyType: party.partyType,
      phone: party.phone ?? "",
      email: party.email ?? "",
      address: party.address ?? "",
      isActive: party.isActive,
      outstandingDays: party.outstandingDays,
      outstandingAmount: party.outstandingAmount,
      whtStatus: party.whtStatus ?? "",
    });
  }, [openPartyId, initialParties]);

  const filtered = useMemo(() => {
    return parties.filter((p) => {
      if (type !== "All" && p.partyType !== type && p.partyType !== "Both") return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.ntn ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [parties, search, type]);

  function refresh() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/parties");
        const data = (await response.json()) as { parties?: PartyDTO[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Failed to refresh parties.");
          return;
        }
        setParties(data.parties ?? []);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setForm(EMPTY);
    setMessage(null);
    setError(null);
  }

  function openEdit(party: PartyDTO) {
    setEditing(party);
    setCreating(false);
    setForm({
      name: party.name,
      ntn: party.ntn ?? "",
      partyType: party.partyType,
      phone: party.phone ?? "",
      email: party.email ?? "",
      address: party.address ?? "",
      isActive: party.isActive,
      outstandingDays: party.outstandingDays,
      outstandingAmount: party.outstandingAmount,
      whtStatus: party.whtStatus ?? "",
    });
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    if (openPartyId) {
      router.replace("/parties");
    }
  }

  async function save() {
    setError(null);
    try {
      const payload: PartyInput = {
        ...form,
        outstandingDays:
          form.outstandingDays === null || form.outstandingDays === undefined
            ? null
            : Number(form.outstandingDays),
      };
      const response = await fetch(
        editing ? `/api/parties/${editing.id}` : "/api/parties",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { party?: PartyDTO; error?: string };
      if (!response.ok || !data.party) {
        setError(data.error ?? "Save failed.");
        return;
      }
      setMessage(editing ? "Party updated." : "Party created.");
      closeForm();
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function toggleActive(party: PartyDTO) {
    setError(null);
    try {
      const response = await fetch(`/api/parties/${party.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !party.isActive, toggleActive: true }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <label className="block min-w-[180px] flex-1">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name / NTN / phone…"
            className="field-input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field-input w-[130px]"
          >
            <option value="All">All</option>
            {PARTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={openCreate}>
          New party
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>
          Refresh
        </button>
        <PrintButton />
      </div>

      {error ? (
        <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}

      {(creating || editing) && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="mb-3 text-sm font-semibold text-[var(--accent)]">
            {editing ? "Edit party" : "New party"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name *">
              <input
                className="field-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="NTN / CNIC">
              <input
                className="field-input"
                value={form.ntn ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, ntn: e.target.value }))}
              />
            </Field>
            <Field label="Type">
              <select
                className="field-input"
                value={form.partyType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, partyType: e.target.value as PartyTypeValue }))
                }
              >
                {PARTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input
                className="field-input"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <input
                className="field-input"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="WHT status">
              <select
                className="field-input"
                value={form.whtStatus ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, whtStatus: e.target.value }))}
              >
                <option value="">—</option>
                <option value="Deducted">Deducted</option>
                <option value="Pending">Pending</option>
              </select>
            </Field>
            <Field label="Outstanding days">
              <input
                type="number"
                min={0}
                className="field-input"
                value={form.outstandingDays ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    outstandingDays: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Outstanding amount">
              <input
                className="field-input"
                value={String(form.outstandingAmount ?? "")}
                onChange={(e) => setForm((f) => ({ ...f, outstandingAmount: e.target.value }))}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2 lg:col-span-3">
              <input
                className="field-input"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" onClick={save}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>NTN</th>
              <th>Type</th>
              <th className="text-right">Outstanding</th>
              <th className="text-right">Age</th>
              <th>WHT</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
                  No parties found.
                </td>
              </tr>
            ) : (
              filtered.map((party) => (
                <tr key={party.id}>
                  <td className="font-medium">
                    <OriginLink
                      href={partyLedgerHref(party.id, partyKindFromType(party.partyType))}
                    >
                      {party.name}
                    </OriginLink>
                  </td>
                  <td className="text-[var(--muted)]">{party.ntn ?? "—"}</td>
                  <td>{party.partyType}</td>
                  <td className="text-right font-mono">
                    {formatCurrency(party.outstandingAmount)}
                  </td>
                  <td className="text-right">
                    {party.outstandingDays != null ? `${party.outstandingDays}d` : "—"}
                  </td>
                  <td>{party.whtStatus ?? "—"}</td>
                  <td>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] ${
                        party.isActive
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : "bg-red-950 text-[var(--danger)]"
                      }`}
                    >
                      {party.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1"
                      onClick={() => openEdit(party)}
                    >
                      Edit
                    </button>
                    <a
                      href={`/party-ledger?partyId=${party.id}&kind=${
                        party.partyType === "Creditor" ? "creditor" : "debtor"
                      }`}
                      className="btn-secondary mr-1 inline-block px-2 py-1 no-underline"
                    >
                      Ledger
                    </a>
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1"
                      onClick={() => toggleActive(party)}
                    >
                      {party.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
