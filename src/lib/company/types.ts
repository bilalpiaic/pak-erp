export type CompanyDTO = {
  id: string;
  name: string;
  address: string | null;
  ntn: string | null;
  strn: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  fiscalYearStart: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CompanyInput = {
  name: string;
  address?: string | null;
  ntn?: string | null;
  strn?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  fiscalYearStart?: number;
};

export type FiscalYearDTO = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};
