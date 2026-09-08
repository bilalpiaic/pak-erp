"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { ITEM_CATEGORY_LABELS, type ItemDTO } from "@/lib/items/types";

type ItemLovProps = {
  items: ItemDTO[];
  value: string;
  disabled?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  onChange: (itemId: string, item: ItemDTO | null) => void;
};

function itemLabel(item: ItemDTO): string {
  return `${item.sku} — ${item.name}`;
}

export function ItemLov({
  items,
  value,
  disabled = false,
  allowNone = false,
  noneLabel = "Non-stock / free text",
  onChange,
}: ItemLovProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [index, setIndex] = useState(0);

  const selected = items.find((item) => item.id === value) ?? null;
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = q
      ? items.filter(
          (item) =>
            item.sku.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            ITEM_CATEGORY_LABELS[item.category].toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q),
        )
      : items;
    return rows;
  }, [items, filter]);

  const options = allowNone ? [{ id: "", sku: "", name: noneLabel } as ItemDTO, ...filtered] : filtered;

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function pick(item: ItemDTO | null) {
    onChange(item?.id ?? "", item?.id ? item : null);
    setOpen(false);
    setFilter("");
    inputRef.current?.focus();
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "F5" || event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onLovKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!options.length) return;
      setIndex((i) => (i + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!options.length) return;
      setIndex((i) => (i - 1 + options.length) % options.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = options[index];
      if (chosen) pick(chosen.id ? chosen : null);
    }
  }

  return (
    <>
      <div className="flex min-w-[160px] items-stretch gap-1">
        <input
          ref={inputRef}
          readOnly
          disabled={disabled}
          value={selected ? itemLabel(selected) : allowNone && !value ? noneLabel : ""}
          placeholder="Select item"
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={onFieldKeyDown}
          className="field-input flex-1 cursor-pointer"
          title="List of Values (F5)"
        />
        <button
          type="button"
          disabled={disabled}
          title="List of Values (F5)"
          onClick={() => setOpen(true)}
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
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="flex w-full max-w-lg flex-col border border-[var(--border)] bg-[var(--panel)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <h2 id={titleId} className="text-sm font-semibold">
                Items
              </h2>
              <button type="button" className="px-2 py-1 text-[11px] text-[var(--muted)]" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="space-y-2 p-3">
              <input
                ref={searchRef}
                className="field-input w-full"
                placeholder="Search SKU or name…"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <ul className="max-h-72 overflow-auto border border-[var(--border)]">
                {options.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">No items found.</li>
                ) : (
                  options.map((item, rowIndex) => (
                    <li key={item.id || "none"}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                          rowIndex === index ? "bg-[var(--nav-active)] font-semibold" : "hover:bg-[var(--table-row-hover)]"
                        }`}
                        onMouseEnter={() => setIndex(rowIndex)}
                        onClick={() => pick(item.id ? item : null)}
                      >
                        <span>
                          {item.id ? (
                            <>
                              <span className="font-mono text-[var(--accent)]">{item.sku}</span>
                              <span className="ml-2">{item.name}</span>
                            </>
                          ) : (
                            item.name
                          )}
                        </span>
                        {item.id ? (
                          <span className="shrink-0 text-[10px] text-[var(--muted)]">
                            {item.unit} · {ITEM_CATEGORY_LABELS[item.category]}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
