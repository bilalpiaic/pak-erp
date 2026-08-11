export const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const NORMAL_BALANCES = ["Debit", "Credit"] as const;
export type NormalBalanceValue = (typeof NORMAL_BALANCES)[number];

export const ACCOUNT_GROUPS = [
  "Current Assets",
  "Fixed Assets",
  "Other Assets",
  "Current Liabilities",
  "Long-term Liabilities",
  "Equity",
  "Revenue",
  "COGS",
  "Operating Expenses",
  "Administrative",
  "Selling & Distribution",
  "Financial Charges",
  "Taxation",
] as const;

export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export type AccountDTO = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  accountType: AccountType;
  accountGroup: string | null;
  normalBalance: NormalBalanceValue;
  isActive: boolean;
  hasTransactions: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AccountInput = {
  code: string;
  name: string;
  accountType: AccountType;
  accountGroup?: string | null;
  normalBalance: NormalBalanceValue;
  isActive?: boolean;
};

export type AccountListQuery = {
  search?: string;
  accountType?: string;
  active?: "all" | "active" | "inactive";
};

export type AccountGroupSection = {
  group: string;
  accounts: AccountDTO[];
};
