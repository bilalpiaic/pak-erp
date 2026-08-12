"use client";

import { useMemo, useState, useTransition } from "react";

import {
  USER_ROLES,
  type UserDTO,
  type UserInput,
  type UserRoleValue,
} from "@/lib/users/types";

type UsersViewProps = {
  initialUsers: UserDTO[];
  loadError?: string | null;
  currentUserId?: string | null;
};

const EMPTY: UserInput = {
  username: "",
  password: "",
  displayName: "",
  role: "USER",
  isActive: true,
};

export function UsersView({
  initialUsers,
  loadError = null,
  currentUserId = null,
}: UsersViewProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [error, setError] = useState<string | null>(loadError);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserInput>(EMPTY);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "All" && u.role !== roleFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  function refresh() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/users");
        const data = (await response.json()) as { users?: UserDTO[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Failed to refresh users.");
          return;
        }
        setUsers(data.users ?? []);
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

  function openEdit(user: UserDTO) {
    setEditing(user);
    setCreating(false);
    setForm({
      username: user.username,
      password: "",
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    });
    setMessage(null);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  async function save() {
    setError(null);
    try {
      const payload: UserInput = {
        ...form,
        password: form.password?.trim() ? form.password : undefined,
      };
      const response = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { user?: UserDTO; error?: string };
      if (!response.ok || !data.user) {
        setError(data.error ?? "Save failed.");
        return;
      }
      setMessage(editing ? "User updated." : "User created.");
      closeForm();
      refresh();
    } catch {
      setError("Unable to reach the server.");
    }
  }

  async function toggleActive(user: UserDTO) {
    setError(null);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive, toggleActive: true }),
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

  async function remove(user: UserDTO) {
    if (!window.confirm(`Delete user “${user.username}”? This cannot be undone.`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Delete failed.");
        return;
      }
      setMessage("User deleted.");
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
            placeholder="Username / display name…"
            className="field-input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Role</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="field-input w-[130px]"
          >
            <option value="All">All</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={openCreate}>
          New user
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>
          Refresh
        </button>
      </div>

      {error ? (
        <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="border border-emerald-200 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}

      {(creating || editing) && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="mb-3 text-sm font-semibold text-[var(--accent)]">
            {editing ? "Edit user" : "New user"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Username *">
              <input
                className="field-input"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </Field>
            <Field label={editing ? "Password (leave blank to keep)" : "Password *"}>
              <input
                type="password"
                className="field-input"
                autoComplete="new-password"
                value={form.password ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </Field>
            <Field label="Display name *">
              <input
                className="field-input"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </Field>
            <Field label="Role">
              <select
                className="field-input"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as UserRoleValue }))
                }
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className="field-input"
                value={form.isActive ? "active" : "inactive"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.value === "active" }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
              <th>Username</th>
              <th>Display name</th>
              <th>Role</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--muted)]">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id}>
                  <td className="font-mono font-medium">{user.username}</td>
                  <td>{user.displayName}</td>
                  <td>{user.role}</td>
                  <td>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] ${
                        user.isActive
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : "bg-[var(--danger-bg)] text-[var(--danger)]"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1"
                      onClick={() => openEdit(user)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1"
                      onClick={() => toggleActive(user)}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1"
                      disabled={currentUserId === user.id}
                      onClick={() => remove(user)}
                    >
                      Delete
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
