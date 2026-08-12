import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — GarmentLoop ERP",
};

export default function LoginPage() {
  return (
    <div className="login-stage relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/garment-factory.gif"
          alt=""
          className="login-factory-gif h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(16,22,30,0.78)_0%,rgba(28,36,48,0.50)_48%,rgba(185,148,69,0.26)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_12%,rgba(8,10,14,0.55)_100%)]" />
      </div>

      <div className="login-card w-full max-w-sm border border-white/30 bg-[rgba(249,247,242,0.93)] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.38)] backdrop-blur-md">
        <div className="mb-6 border-b border-[var(--border)] pb-4 text-center">
          <div className="font-display text-xl font-bold tracking-tight text-[var(--foreground)]">
            GarmentLoop ERP
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Sign in with your username and password
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
