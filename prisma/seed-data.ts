/** Chart of accounts for garment trading — Pakistani SME style. */

export const SEED_FISCAL_YEAR = {
  name: "FY 2025-26",
  startDate: new Date("2025-07-01T00:00:00.000Z"),
  endDate: new Date("2026-06-30T23:59:59.999Z"),
};

export const SEED_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  parentCode: string | null;
  isPostable: boolean;
  openingDebit: number;
  openingCredit: number;
}> = [
  { code: "1000", name: "Assets", type: "ASSET", parentCode: null, isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "1100", name: "Current Assets", type: "ASSET", parentCode: "1000", isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "1110", name: "Cash in Hand", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 150000, openingCredit: 0 },
  { code: "1120", name: "Cash at Bank - HBL", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 1250000, openingCredit: 0 },
  { code: "1130", name: "Accounts Receivable", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 485000, openingCredit: 0 },
  { code: "1140", name: "Inventory - Finished Goods", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 2100000, openingCredit: 0 },
  { code: "1150", name: "Inventory - Raw Material", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 650000, openingCredit: 0 },
  { code: "1160", name: "Advance Income Tax", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 85000, openingCredit: 0 },
  { code: "1170", name: "Sales Tax Input", type: "ASSET", parentCode: "1100", isPostable: true, openingDebit: 42000, openingCredit: 0 },
  { code: "1200", name: "Non-Current Assets", type: "ASSET", parentCode: "1000", isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "1210", name: "Furniture & Fixtures", type: "ASSET", parentCode: "1200", isPostable: true, openingDebit: 320000, openingCredit: 0 },
  { code: "1220", name: "Office Equipment", type: "ASSET", parentCode: "1200", isPostable: true, openingDebit: 185000, openingCredit: 0 },
  { code: "1230", name: "Accumulated Depreciation", type: "ASSET", parentCode: "1200", isPostable: true, openingDebit: 0, openingCredit: 95000 },

  { code: "2000", name: "Liabilities", type: "LIABILITY", parentCode: null, isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "2100", name: "Current Liabilities", type: "LIABILITY", parentCode: "2000", isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "2110", name: "Accounts Payable", type: "LIABILITY", parentCode: "2100", isPostable: true, openingDebit: 0, openingCredit: 720000 },
  { code: "2120", name: "Sales Tax Payable", type: "LIABILITY", parentCode: "2100", isPostable: true, openingDebit: 0, openingCredit: 58000 },
  { code: "2130", name: "Withholding Tax Payable", type: "LIABILITY", parentCode: "2100", isPostable: true, openingDebit: 0, openingCredit: 12500 },
  { code: "2140", name: "Accrued Expenses", type: "LIABILITY", parentCode: "2100", isPostable: true, openingDebit: 0, openingCredit: 45000 },
  { code: "2200", name: "Non-Current Liabilities", type: "LIABILITY", parentCode: "2000", isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "2210", name: "Long-term Loan", type: "LIABILITY", parentCode: "2200", isPostable: true, openingDebit: 0, openingCredit: 500000 },

  { code: "3000", name: "Equity", type: "EQUITY", parentCode: null, isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "3100", name: "Owner's Capital", type: "EQUITY", parentCode: "3000", isPostable: true, openingDebit: 0, openingCredit: 3500000 },
  { code: "3200", name: "Owner's Drawings", type: "EQUITY", parentCode: "3000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "3300", name: "Retained Earnings", type: "EQUITY", parentCode: "3000", isPostable: true, openingDebit: 0, openingCredit: 236500 },

  { code: "4000", name: "Revenue", type: "REVENUE", parentCode: null, isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "4100", name: "Sales - Local", type: "REVENUE", parentCode: "4000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "4200", name: "Sales - Export", type: "REVENUE", parentCode: "4000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "4300", name: "Other Income", type: "REVENUE", parentCode: "4000", isPostable: true, openingDebit: 0, openingCredit: 0 },

  { code: "5000", name: "Expenses", type: "EXPENSE", parentCode: null, isPostable: false, openingDebit: 0, openingCredit: 0 },
  { code: "5100", name: "Cost of Goods Sold", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5200", name: "Salaries & Wages", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5300", name: "Rent Expense", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5400", name: "Utilities", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5500", name: "Freight & Carriage", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5600", name: "Bank Charges", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5700", name: "Office Supplies", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5800", name: "Depreciation Expense", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5900", name: "Miscellaneous Expense", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
  { code: "5950", name: "Withholding Tax Expense", type: "EXPENSE", parentCode: "5000", isPostable: true, openingDebit: 0, openingCredit: 0 },
];
