"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type UsernameOption = {
  username: string;
  displayName: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lovTitleId = useId();
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const lovSearchRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Prevent browser password managers from injecting saved credentials on load.
  const [unlockAutofill, setUnlockAutofill] = useState(false);

  const [lovOpen, setLovOpen] = useState(false);
  const [lovLoading, setLovLoading] = useState(false);
  const [lovError, setLovError] = useState<string | null>(null);
  const [lovUsers, setLovUsers] = useState<UsernameOption[]>([]);
  const [lovFilter, setLovFilter] = useState("");
  const [lovIndex, setLovIndex] = useState(0);

  const filteredUsers = lovUsers.filter((u) => {
    const q = lovFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!lovOpen) return;
    const id = window.setTimeout(() => lovSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [lovOpen]);

  useEffect(() => {
    setLovIndex(0);
  }, [lovFilter, lovOpen]);

  async function openUsernameLov() {
    setUnlockAutofill(true);
    setLovOpen(true);
    setLovFilter("");
    setLovError(null);
    setLovLoading(true);
    try {
      const response = await fetch("/api/auth/usernames");
      const data = (await response.json()) as {
        users?: UsernameOption[];
        error?: string;
      };
      if (!response.ok) {
        setLovError(data.error ?? "Failed to load usernames.");
        setLovUsers([]);
        return;
      }
      setLovUsers(data.users ?? []);
    } catch {
      setLovError("Unable to reach the server.");
      setLovUsers([]);
    } finally {
      setLovLoading(false);
    }
  }

  function closeLov() {
    setLovOpen(false);
    setLovFilter("");
    setLovError(null);
    usernameRef.current?.focus();
  }

  function pickUsername(option: UsernameOption) {
    setUsername(option.username);
    setUnlockAutofill(true);
    setLovOpen(false);
    setLovFilter("");
    window.setTimeout(() => passwordRef.current?.focus(), 0);
  }

  function onUsernameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "F5") {
      event.preventDefault();
      void openUsernameLov();
    }
  }

  function onLovKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "F5") {
      event.preventDefault();
      void openUsernameLov();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeLov();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!filteredUsers.length) return;
      setLovIndex((i) => (i + 1) % filteredUsers.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!filteredUsers.length) return;
      setLovIndex((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredUsers[lovIndex];
      if (selected) pickUsername(selected);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Login failed.");
        setPending(false);
        return;
      }
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach the server.");
      setPending(false);
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="space-y-4"
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
      >
        <label className="block">
          <span className="mb-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
            <span>Username</span>
            <button
              type="button"
              className="text-[10px] font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              onClick={() => void openUsernameLov()}
              title="List of Values (F5)"
            >
              LOV (F5)
            </button>
          </span>
          <input
            ref={usernameRef}
            className="field-input w-full"
            name="erp-username"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={!unlockAutofill}
            onFocus={() => setUnlockAutofill(true)}
            onKeyDown={onUsernameKeyDown}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            aria-describedby="username-lov-hint"
          />
          <span id="username-lov-hint" className="mt-1 block text-[10px] text-[var(--muted-strong)]">
            Press F5 for available usernames
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[var(--muted)]">Password</span>
          <input
            ref={passwordRef}
            className="field-input w-full"
            name="erp-password"
            type="password"
            autoComplete="new-password"
            readOnly={!unlockAutofill}
            onFocus={() => setUnlockAutofill(true)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? (
          <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {lovOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={lovTitleId}
          onKeyDown={onLovKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLov();
          }}
        >
          <div className="w-full max-w-sm border border-[var(--border)] bg-[var(--panel)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <h2 id={lovTitleId} className="text-sm font-semibold text-[var(--foreground)]">
                Available usernames
              </h2>
              <button type="button" className="btn-secondary px-2 py-1 text-[11px]" onClick={closeLov}>
                Close
              </button>
            </div>
            <div className="space-y-2 p-3">
              <input
                ref={lovSearchRef}
                className="field-input w-full"
                placeholder="Filter username / name…"
                value={lovFilter}
                onChange={(e) => setLovFilter(e.target.value)}
              />
              {lovLoading ? (
                <p className="py-6 text-center text-sm text-[var(--muted)]">Loading…</p>
              ) : lovError ? (
                <p className="border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
                  {lovError}
                </p>
              ) : (
                <ul className="max-h-56 overflow-auto border border-[var(--border)]">
                  {filteredUsers.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                      No usernames found.
                    </li>
                  ) : (
                    filteredUsers.map((user, index) => {
                      const active = index === lovIndex;
                      return (
                        <li key={user.username}>
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                              active
                                ? "bg-[var(--nav-active)] font-semibold"
                                : "hover:bg-[var(--table-row-hover)]"
                            }`}
                            onMouseEnter={() => setLovIndex(index)}
                            onClick={() => pickUsername(user)}
                          >
                            <span className="font-mono">{user.username}</span>
                            <span className="truncate text-[11px] text-[var(--muted)]">
                              {user.displayName}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
              <p className="text-[10px] text-[var(--muted-strong)]">
                ↑↓ select · Enter pick · Esc close · F5 refresh list
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
