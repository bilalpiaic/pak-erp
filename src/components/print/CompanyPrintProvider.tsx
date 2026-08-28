"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { CompanyDTO } from "@/lib/company/types";
import {
  companyPrintInfoFromDto,
  type CompanyPrintInfo,
} from "@/lib/print/company";

const CompanyPrintContext = createContext<CompanyPrintInfo | null>(null);

type CompanyPrintProviderProps = {
  company?: CompanyDTO | CompanyPrintInfo | null;
  children: ReactNode;
};

export function CompanyPrintProvider({
  company = null,
  children,
}: CompanyPrintProviderProps) {
  const value = useMemo<CompanyPrintInfo | null>(() => {
    if (!company) return null;
    if ("id" in company) return companyPrintInfoFromDto(company);
    return company;
  }, [company]);

  return (
    <CompanyPrintContext.Provider value={value}>{children}</CompanyPrintContext.Provider>
  );
}

export function useCompanyPrintInfo(): CompanyPrintInfo | null {
  return useContext(CompanyPrintContext);
}
