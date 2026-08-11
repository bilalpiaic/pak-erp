"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PrintButton } from "@/components/print/PrintButton";
import type { CompanyDTO, FiscalYearDTO } from "@/lib/company/types";

type CompanySettingsFormProps = {
  company: CompanyDTO | null;
  fiscalYear: FiscalYearDTO | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function CompanySettingsForm({ company, fiscalYear }: CompanySettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: company?.name ?? "",
    address: company?.address ?? "",
    ntn: company?.ntn ?? "",
    strn: company?.strn ?? "",
    phone: company?.phone ?? "",
    email: company?.email ?? "",
    currency: company?.currency ?? "PKR",
    fiscalYearStart: String(company?.fiscalYearStart ?? 7),
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
    setError(null);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const payload = {
          id: company?.id,
          name: form.name,
          address: form.address,
          ntn: form.ntn,
          strn: form.strn,
          phone: form.phone,
          email: form.email,
          currency: form.currency,
          fiscalYearStart: Number(form.fiscalYearStart),
        };

        const response = await fetch("/api/company", {
          method: company ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Unable to save company settings.");
          return;
        }

        setSuccess(company ? "Company settings saved." : "Company created.");
        router.refresh();
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>
      <div className="border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--accent)]">Company Information</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company Name" required>
            <input
              required
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="field-input"
            />
          </Field>

          <Field label="Currency">
            <input
              value={form.currency}
              onChange={(e) => updateField("currency", e.target.value.toUpperCase())}
              className="field-input"
              maxLength={10}
            />
          </Field>

          <Field label="NTN">
            <input
              value={form.ntn}
              onChange={(e) => updateField("ntn", e.target.value)}
              className="field-input"
            />
          </Field>

          <Field label="STRN">
            <input
              value={form.strn}
              onChange={(e) => updateField("strn", e.target.value)}
              className="field-input"
            />
          </Field>

          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="field-input"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="field-input"
            />
          </Field>

          <Field label="Fiscal Year Starts">
            <select
              value={form.fiscalYearStart}
              onChange={(e) => updateField("fiscalYearStart", e.target.value)}
              className="field-input"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Address" className="md:col-span-2">
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="field-input min-h-[88px] resize-y"
              rows={3}
            />
          </Field>
        </div>
      </div>

      {fiscalYear ? (
        <div className="border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
          Active fiscal year:{" "}
          <span className="font-medium text-[var(--foreground)]">{fiscalYear.name}</span> (
          {fiscalYear.startDate} → {fiscalYear.endDate}
          {fiscalYear.isOpen ? "" : ", closed"})
          . Change selection in the sidebar or manage years below.
        </div>
      ) : (
        <div className="border border-dashed border-[var(--border-strong)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
          No fiscal year recorded yet. Use Fiscal Years below to create one.
        </div>
      )}

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {success}
        </p>
      ) : null}

      <div className="no-print flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-60"
        >
          {pending ? "Saving…" : company ? "Save Changes" : "Create Company"}
        </button>
        <p className="self-center text-xs text-[var(--muted-strong)]">
          Stored in PostgreSQL · Currency display ₨000,000,000.00
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
