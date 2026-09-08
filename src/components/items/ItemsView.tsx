"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { ItemsPrint } from "@/components/items/ItemsPrint";
import { PrintButton } from "@/components/print/PrintButton";
import { OriginLink } from "@/components/ui/OriginLink";
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_HINTS,
  ITEM_CATEGORY_LABELS,
  ITEM_UNITS,
  type ItemDTO,
  type ItemInput,
} from "@/lib/items/types";
import { stockLedgerHref } from "@/lib/links";

type ItemsViewProps = {
  initialItems: ItemDTO[];
  openItemId?: string | null;
  loadError?: string | null;
};

const EMPTY: ItemInput = {
  sku: "",
  name: "",
  category: "Saleable",
  unit: "Pcs",
  trackStock: true,
  isActive: true,
  defaultSaleRate: "",
};

export function ItemsView({ initialItems, openItemId = null, loadError = null }: ItemsViewProps) {
  const router = useRouter();
  const { isAdmin } = useCurrentUser();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [error, setError] = useState<string | null>(loadError);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<ItemDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ItemInput>(EMPTY);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!openItemId) return;
    const item = initialItems.find((row) => row.id === openItemId);
    if (!item) return;
    openEdit(item);
  }, [openItemId, initialItems]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    });
  }, [items, search, category]);

  function refresh() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/items");
        const data = (await response.json()) as { items?: ItemDTO[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Failed to refresh items.");
          return;
        }
        setItems(data.items ?? []);
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

  function openEdit(item: ItemDTO) {
    setEditing(item);
    setCreating(false);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      trackStock: item.trackStock,
      isActive: item.isActive,
      defaultSaleRate: item.defaultSaleRate ?? "",
    });
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    if (openItemId) router.replace("/items");
  }

  async function save() {
    setError(null);
    try {
      const response = await fetch(editing ? `/api/items/${editing.id}` : "/api/items", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { item?: ItemDTO; error?: string };
      if (!response.ok || !data.item) {
        setError(data.error ?? "Save failed.");
        return;
      }
      setMessage(editing ? "Item updated." : "Item created.");
      closeForm();
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function toggleActive(item: ItemDTO) {
    const response = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive, toggleActive: true }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Update failed.");
      return;
    }
    refresh();
  }

  async function remove(item: ItemDTO) {
    if (!isAdmin) return;
    const response = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Delete failed.");
      return;
    }
    setMessage("Item deleted.");
    refresh();
  }

  const showForm = creating || editing;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-2">
        <label className="block min-w-[180px] flex-1">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SKU / name…"
            className="field-input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input w-[160px]">
            <option value="All">All</option>
            {ITEM_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {ITEM_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={openCreate}>
          New item
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>
          Refresh
        </button>
        <PrintButton />
      </div>

      {error ? (
        <p className="no-print border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="no-print border border-emerald-200 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}

      {showForm ? (
        <div className="no-print border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="mb-3 text-sm font-semibold">{editing ? "Edit item" : "New item"}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block text-[var(--muted-strong)]">SKU</span>
              <input className="field-input w-full" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[var(--muted-strong)]">Name</span>
              <input className="field-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[var(--muted-strong)]">Category</span>
              <select
                className="field-input w-full"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ItemInput["category"] })}
              >
                {ITEM_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {ITEM_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-[var(--muted)]">
                {ITEM_CATEGORY_HINTS[form.category]}
              </span>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[var(--muted-strong)]">Unit</span>
              <select className="field-input w-full" value={form.unit ?? "Pcs"} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {ITEM_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[var(--muted-strong)]">Default sale rate</span>
              <input
                className="field-input w-full"
                value={form.defaultSaleRate ?? ""}
                onChange={(e) => setForm({ ...form, defaultSaleRate: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.trackStock ?? true}
                onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
              />
              Track stock quantity
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="no-print overflow-auto border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
              <th className="bg-[var(--table-head)] px-3 py-2">SKU</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Name</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Category</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Unit</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Stock</th>
              <th className="bg-[var(--table-head)] px-3 py-2">Status</th>
              <th className="bg-[var(--table-head)] px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-[var(--border)]/60">
                <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">{ITEM_CATEGORY_LABELS[item.category]}</td>
                <td className="px-3 py-2">{item.unit}</td>
                <td className="px-3 py-2">{item.trackStock ? "Tracked" : "No"}</td>
                <td className="px-3 py-2">{item.isActive ? "Active" : "Inactive"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <button type="button" className="text-[var(--accent)]" onClick={() => openEdit(item)}>
                      Edit
                    </button>
                    <OriginLink href={stockLedgerHref(item.id)} className="text-[var(--accent)]">
                      Ledger
                    </OriginLink>
                    <button type="button" className="text-[var(--muted)]" onClick={() => void toggleActive(item)}>
                      {item.isActive ? "Deactivate" : "Activate"}
                    </button>
                    {isAdmin ? (
                      <button type="button" className="text-[var(--danger)]" onClick={() => void remove(item)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ItemsPrint items={filtered} />
    </div>
  );
}
