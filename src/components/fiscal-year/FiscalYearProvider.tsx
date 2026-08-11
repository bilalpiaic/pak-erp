"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { FiscalYearDTO } from "@/lib/company/types";
import { dateRangeForFiscalYear } from "@/lib/fiscal-years/period";

type FiscalYearContextValue = {
  fiscalYears: FiscalYearDTO[];
  activeFiscalYear: FiscalYearDTO | null;
  activeRange: { from: string; to: string };
  pending: boolean;
  selectFiscalYear: (id: string) => void;
  refreshFiscalYears: () => Promise<void>;
};

const FiscalYearContext = createContext<FiscalYearContextValue | null>(null);

type FiscalYearProviderProps = {
  fiscalYears: FiscalYearDTO[];
  activeFiscalYear: FiscalYearDTO | null;
  children: ReactNode;
};

export function FiscalYearProvider({
  fiscalYears: initialYears,
  activeFiscalYear: initialActive,
  children,
}: FiscalYearProviderProps) {
  const router = useRouter();
  const [fiscalYears, setFiscalYears] = useState(initialYears);
  const [activeFiscalYear, setActiveFiscalYear] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setFiscalYears(initialYears);
    setActiveFiscalYear(initialActive);
  }, [initialYears, initialActive]);

  const activeRange = useMemo(() => {
    if (!activeFiscalYear) {
      return { from: "2024-07-01", to: new Date().toISOString().slice(0, 10) };
    }
    return dateRangeForFiscalYear(activeFiscalYear);
  }, [activeFiscalYear]);

  const refreshFiscalYears = useCallback(async () => {
    const response = await fetch("/api/fiscal-years");
    if (!response.ok) return;
    const data = (await response.json()) as {
      fiscalYears: FiscalYearDTO[];
      activeFiscalYear: FiscalYearDTO | null;
    };
    setFiscalYears(data.fiscalYears);
    setActiveFiscalYear(data.activeFiscalYear);
  }, []);

  const selectFiscalYear = useCallback(
    (id: string) => {
      startTransition(async () => {
        try {
          const response = await fetch("/api/fiscal-years/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          if (!response.ok) return;
          const data = (await response.json()) as {
            activeFiscalYear: FiscalYearDTO | null;
          };
          setActiveFiscalYear(data.activeFiscalYear);
          router.refresh();
        } catch {
          // keep previous selection
        }
      });
    },
    [router],
  );

  const value = useMemo(
    () => ({
      fiscalYears,
      activeFiscalYear,
      activeRange,
      pending,
      selectFiscalYear,
      refreshFiscalYears,
    }),
    [
      fiscalYears,
      activeFiscalYear,
      activeRange,
      pending,
      selectFiscalYear,
      refreshFiscalYears,
    ],
  );

  return (
    <FiscalYearContext.Provider value={value}>{children}</FiscalYearContext.Provider>
  );
}

export function useFiscalYear(): FiscalYearContextValue {
  const ctx = useContext(FiscalYearContext);
  if (!ctx) {
    return {
      fiscalYears: [],
      activeFiscalYear: null,
      activeRange: {
        from: "2024-07-01",
        to: new Date().toISOString().slice(0, 10),
      },
      pending: false,
      selectFiscalYear: () => undefined,
      refreshFiscalYears: async () => undefined,
    };
  }
  return ctx;
}
