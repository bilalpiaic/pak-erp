import type { CompanyDTO } from "@/lib/company/types";

/** Fields needed on a printed letterhead. */
export type CompanyPrintInfo = {
  name: string;
  address?: string | null;
  ntn?: string | null;
  strn?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string | null;
};

export function companyPrintInfoFromDto(
  company: CompanyDTO | null | undefined,
): CompanyPrintInfo | null {
  if (!company) return null;
  return {
    name: company.name,
    address: company.address,
    ntn: company.ntn,
    strn: company.strn,
    phone: company.phone,
    email: company.email,
    currency: company.currency,
  };
}

export function mergeCompanyPrintInfo(
  primary?: CompanyPrintInfo | null,
  fallback?: CompanyPrintInfo | null,
): CompanyPrintInfo | null {
  if (!primary && !fallback) return null;
  return {
    name: primary?.name || fallback?.name || "",
    address: primary?.address ?? fallback?.address ?? null,
    ntn: primary?.ntn ?? fallback?.ntn ?? null,
    strn: primary?.strn ?? fallback?.strn ?? null,
    phone: primary?.phone ?? fallback?.phone ?? null,
    email: primary?.email ?? fallback?.email ?? null,
    currency: primary?.currency ?? fallback?.currency ?? null,
  };
}

export function periodCaption(from?: string | null, to?: string | null): string {
  if (from && to && from === to) return `As at ${to}`;
  if (from && to) return `For the period ${from} to ${to}`;
  if (to) return `As at ${to}`;
  if (from) return `From ${from}`;
  return "";
}

export function asAtCaption(to?: string | null): string {
  return to ? `As at ${to}` : "";
}
