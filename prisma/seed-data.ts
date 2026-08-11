import type { NormalBalance } from "../src/generated/prisma/client";

/** Neutral shell company — not demo trading identity. */
export const SEED_COMPANY = {
  name: "My Company",
  ntn: null as string | null,
  strn: null as string | null,
  address: null as string | null,
  phone: null as string | null,
  email: null as string | null,
  currency: "PKR",
  fiscalYearStart: 7,
};

export const SEED_FISCAL_YEAR = {
  name: "FY 2024-25",
  startDate: new Date("2024-07-01"),
  endDate: new Date("2025-06-30"),
  isOpen: true,
};

export type SeedAccount = {
  code: string;
  name: string;
  accountType: string;
  accountGroup: string;
  normalBalance: NormalBalance;
  isActive: boolean;
};

/** Chart of accounts only — no demo parties or vouchers. */
export const SEED_ACCOUNTS: SeedAccount[] = [
  { code: "1001", name: "Cash in Hand", accountGroup: "Current Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1002", name: "Cash at Bank - HBL", accountGroup: "Current Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1003", name: "Cash at Bank - MCB", accountGroup: "Current Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1010", name: "Trade Debtors", accountGroup: "Current Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1020", name: "Stock in Trade", accountGroup: "Current Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1030", name: "Advances - Employees", accountGroup: "Current Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1040", name: "Prepaid Expenses", accountGroup: "Other Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1050", name: "Security Deposits", accountGroup: "Other Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1201", name: "Plant & Machinery", accountGroup: "Fixed Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1202", name: "Furniture & Fixtures", accountGroup: "Fixed Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1203", name: "Motor Vehicles", accountGroup: "Fixed Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1204", name: "Land & Building", accountGroup: "Fixed Assets", accountType: "Asset", normalBalance: "Debit", isActive: true },
  { code: "1205", name: "Accum. Depreciation", accountGroup: "Fixed Assets", accountType: "Asset", normalBalance: "Credit", isActive: true },
  { code: "2001", name: "Trade Creditors", accountGroup: "Current Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "2002", name: "Accrued Liabilities", accountGroup: "Current Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "2003", name: "Sales Tax Payable", accountGroup: "Current Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "2004", name: "Income Tax Payable", accountGroup: "Current Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "2005", name: "WHT Payable", accountGroup: "Current Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "2006", name: "Short-term Loans", accountGroup: "Current Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "2201", name: "Long-term Financing", accountGroup: "Long-term Liabilities", accountType: "Liability", normalBalance: "Credit", isActive: true },
  { code: "3001", name: "Owner's Capital", accountGroup: "Equity", accountType: "Equity", normalBalance: "Credit", isActive: true },
  { code: "3002", name: "Retained Earnings", accountGroup: "Equity", accountType: "Equity", normalBalance: "Credit", isActive: true },
  { code: "3003", name: "Drawings", accountGroup: "Equity", accountType: "Equity", normalBalance: "Debit", isActive: true },
  { code: "4001", name: "Sales - Taxable", accountGroup: "Revenue", accountType: "Revenue", normalBalance: "Credit", isActive: true },
  { code: "4002", name: "Sales - Exempt", accountGroup: "Revenue", accountType: "Revenue", normalBalance: "Credit", isActive: true },
  { code: "4003", name: "Other Income", accountGroup: "Revenue", accountType: "Revenue", normalBalance: "Credit", isActive: true },
  { code: "5001", name: "Opening Stock", accountGroup: "COGS", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "5002", name: "Purchases", accountGroup: "COGS", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "5003", name: "Closing Stock", accountGroup: "COGS", accountType: "Expense", normalBalance: "Credit", isActive: true },
  { code: "6001", name: "Salaries & Wages", accountGroup: "Operating Expenses", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "6002", name: "Rent Expense", accountGroup: "Operating Expenses", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "6003", name: "Utility Bills", accountGroup: "Operating Expenses", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "6004", name: "Transport Expense", accountGroup: "Operating Expenses", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "6005", name: "Administrative Expenses", accountGroup: "Administrative", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "6006", name: "Selling Expenses", accountGroup: "Selling & Distribution", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "6007", name: "Depreciation Expense", accountGroup: "Operating Expenses", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "7001", name: "Bank Charges", accountGroup: "Financial Charges", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "7002", name: "Markup / Interest", accountGroup: "Financial Charges", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "8001", name: "Income Tax - Current", accountGroup: "Taxation", accountType: "Expense", normalBalance: "Debit", isActive: true },
  { code: "8002", name: "Sales Tax (GST)", accountGroup: "Taxation", accountType: "Expense", normalBalance: "Debit", isActive: true },
];
