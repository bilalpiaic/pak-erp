export const PARTY_TYPES = ["Debtor", "Creditor", "Both"] as const;
export type PartyTypeValue = (typeof PARTY_TYPES)[number];

export type PartyDTO = {
  id: string;
  companyId: string;
  name: string;
  ntn: string | null;
  partyType: PartyTypeValue;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  outstandingDays: number | null;
  outstandingAmount: string;
  whtStatus: string | null;
  /** Named Trade Debtors GL head (sub-ledger). Null for creditors. */
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartyInput = {
  name: string;
  ntn?: string | null;
  partyType: PartyTypeValue;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
  outstandingDays?: number | null;
  outstandingAmount?: string | number | null;
  whtStatus?: string | null;
};

export type PartyListQuery = {
  search?: string;
  partyType?: string;
  active?: "all" | "active" | "inactive";
};
