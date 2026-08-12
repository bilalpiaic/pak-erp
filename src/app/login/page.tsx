import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — GarmentLoop ERP",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-sm border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-6 border-b border-[var(--border)] pb-4 text-center">
          <div className="font-display text-xl font-bold text-[var(--foreground)]">
            GarmentLoop ERP
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">Sign in with your username and password</p>
        </div>
        <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
