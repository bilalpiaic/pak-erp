import type { NormalBalance, VoucherStatus, VoucherType } from "../src/generated/prisma/client";

export const SEED_COMPANY = {
  name: "Gill Embroidery",
  ntn: "1234567-8",
  strn: "12-34-5678-001-56",
  address: "123 Gulberg III, Lahore, Punjab",
  phone: "042-35761234",
  email: "accounts@gillembroidery.com.pk",
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

export type SeedVoucherLine = {
  accountCode: string;
  debit: string;
  credit: string;
  lineNarration: string;
};

export type SeedVoucher = {
  voucherNo: string;
  voucherType: VoucherType;
  voucherDate: string; // ISO date
  referenceNo: string;
  partyName: string;
  narration: string;
  status: VoucherStatus;
  lines: SeedVoucherLine[];
};

export const SEED_VOUCHERS: SeedVoucher[] = [
  {
    voucherNo: "JV-001",
    voucherType: "JV",
    voucherDate: "2024-07-01",
    referenceNo: "OB-2024",
    partyName: "Opening Balances",
    narration: "Opening balances for FY 2024-25",
    status: "POSTED",
    lines: [
      { accountCode: "1001", debit: "250000.00", credit: "0.00", lineNarration: "Cash in Hand OB" },
      { accountCode: "1002", debit: "1800000.00", credit: "0.00", lineNarration: "HBL Bank OB" },
      { accountCode: "1003", debit: "450000.00", credit: "0.00", lineNarration: "MCB Bank OB" },
      { accountCode: "1010", debit: "2500000.00", credit: "0.00", lineNarration: "Debtors OB" },
      { accountCode: "1020", debit: "1200000.00", credit: "0.00", lineNarration: "Stock OB" },
      { accountCode: "1201", debit: "3500000.00", credit: "0.00", lineNarration: "Machinery OB" },
      { accountCode: "1202", debit: "800000.00", credit: "0.00", lineNarration: "Furniture OB" },
      { accountCode: "1204", debit: "5000000.00", credit: "0.00", lineNarration: "Land OB" },
      { accountCode: "1205", debit: "0.00", credit: "1200000.00", lineNarration: "Accum Dep OB" },
      { accountCode: "2001", debit: "0.00", credit: "1800000.00", lineNarration: "Creditors OB" },
      { accountCode: "2201", debit: "0.00", credit: "2500000.00", lineNarration: "LT Loan OB" },
      { accountCode: "3001", debit: "0.00", credit: "9000000.00", lineNarration: "Owner's Capital OB" },
      { accountCode: "3002", debit: "0.00", credit: "1000000.00", lineNarration: "Retained Earnings OB" },
    ],
  },
  {
    voucherNo: "BRV-001",
    voucherType: "BRV",
    voucherDate: "2024-07-05",
    referenceNo: "INV-0701",
    partyName: "Karachi Traders",
    narration: "Receipt against sales invoice",
    status: "POSTED",
    lines: [
      { accountCode: "1002", debit: "590000.00", credit: "0.00", lineNarration: "HBL receipt" },
      { accountCode: "4001", debit: "0.00", credit: "500000.00", lineNarration: "Sales taxable" },
      { accountCode: "2003", debit: "0.00", credit: "90000.00", lineNarration: "GST 18%" },
    ],
  },
  {
    voucherNo: "BPV-001",
    voucherType: "BPV",
    voucherDate: "2024-07-10",
    referenceNo: "PO-0702",
    partyName: "Pak Steel Ltd",
    narration: "Payment for raw material purchase",
    status: "POSTED",
    lines: [
      { accountCode: "5002", debit: "800000.00", credit: "0.00", lineNarration: "Purchases" },
      { accountCode: "2001", debit: "0.00", credit: "784000.00", lineNarration: "Net payable" },
      { accountCode: "2005", debit: "0.00", credit: "16000.00", lineNarration: "WHT 2% deducted" },
    ],
  },
  {
    voucherNo: "CPV-001",
    voucherType: "CPV",
    voucherDate: "2024-07-15",
    referenceNo: "SAL-JUL24",
    partyName: "Staff",
    narration: "Monthly salaries July 2024",
    status: "POSTED",
    lines: [
      { accountCode: "6001", debit: "450000.00", credit: "0.00", lineNarration: "Gross salaries" },
      { accountCode: "1001", debit: "0.00", credit: "435000.00", lineNarration: "Net paid cash" },
      { accountCode: "2004", debit: "0.00", credit: "15000.00", lineNarration: "Income tax withheld" },
    ],
  },
  {
    voucherNo: "BPV-002",
    voucherType: "BPV",
    voucherDate: "2024-07-20",
    referenceNo: "RENT-JUL",
    partyName: "Al-Noor Properties",
    narration: "Office rent July 2024",
    status: "POSTED",
    lines: [
      { accountCode: "6002", debit: "120000.00", credit: "0.00", lineNarration: "Rent expense" },
      { accountCode: "2005", debit: "0.00", credit: "12000.00", lineNarration: "WHT 10%" },
      { accountCode: "1002", debit: "0.00", credit: "108000.00", lineNarration: "Net paid HBL" },
    ],
  },
  {
    voucherNo: "BRV-002",
    voucherType: "BRV",
    voucherDate: "2024-07-25",
    referenceNo: "INV-0703",
    partyName: "Lahore Distributors",
    narration: "Sales receipt - exempt goods",
    status: "POSTED",
    lines: [
      { accountCode: "1002", debit: "350000.00", credit: "0.00", lineNarration: "HBL receipt" },
      { accountCode: "4002", debit: "0.00", credit: "350000.00", lineNarration: "Sales exempt" },
    ],
  },
  {
    voucherNo: "JV-002",
    voucherType: "JV",
    voucherDate: "2024-07-31",
    referenceNo: "DEP-JUL",
    partyName: "Internal",
    narration: "Monthly depreciation July 2024",
    status: "POSTED",
    lines: [
      { accountCode: "6007", debit: "75000.00", credit: "0.00", lineNarration: "Depreciation charge" },
      { accountCode: "1205", debit: "0.00", credit: "75000.00", lineNarration: "Accum depreciation" },
    ],
  },
  {
    voucherNo: "BPV-003",
    voucherType: "BPV",
    voucherDate: "2024-08-05",
    referenceNo: "UTIL-AUG",
    partyName: "LESCO",
    narration: "Electricity bill August 2024",
    status: "POSTED",
    lines: [
      { accountCode: "6003", debit: "85000.00", credit: "0.00", lineNarration: "Utility expense" },
      { accountCode: "1002", debit: "0.00", credit: "85000.00", lineNarration: "Paid via HBL" },
    ],
  },
  {
    voucherNo: "BRV-003",
    voucherType: "BRV",
    voucherDate: "2024-08-12",
    referenceNo: "INV-0801",
    partyName: "Multan Traders",
    narration: "Sales receipt with GST",
    status: "POSTED",
    lines: [
      { accountCode: "1002", debit: "826000.00", credit: "0.00", lineNarration: "HBL receipt" },
      { accountCode: "4001", debit: "0.00", credit: "700000.00", lineNarration: "Sales taxable" },
      { accountCode: "2003", debit: "0.00", credit: "126000.00", lineNarration: "GST 18%" },
    ],
  },
  {
    voucherNo: "BPV-004",
    voucherType: "BPV",
    voucherDate: "2024-08-20",
    referenceNo: "PO-0803",
    partyName: "Faisalabad Mills",
    narration: "Purchase payment",
    status: "POSTED",
    lines: [
      { accountCode: "5002", debit: "600000.00", credit: "0.00", lineNarration: "Purchases" },
      { accountCode: "2001", debit: "0.00", credit: "588000.00", lineNarration: "Net payable" },
      { accountCode: "2005", debit: "0.00", credit: "12000.00", lineNarration: "WHT 2%" },
    ],
  },
  {
    voucherNo: "JV-003",
    voucherType: "JV",
    voucherDate: "2024-09-30",
    referenceNo: "ADJ-SEP",
    partyName: "Internal",
    narration: "Stock adjustment & admin provisions",
    status: "POSTED",
    lines: [
      { accountCode: "1020", debit: "0.00", credit: "200000.00", lineNarration: "Stock reduction" },
      { accountCode: "6005", debit: "200000.00", credit: "0.00", lineNarration: "Admin expenses" },
    ],
  },
  {
    voucherNo: "CRV-001",
    voucherType: "CRV",
    voucherDate: "2024-09-15",
    referenceNo: "MISC-001",
    partyName: "Misc",
    narration: "Miscellaneous cash receipt",
    status: "POSTED",
    lines: [
      { accountCode: "1001", debit: "50000.00", credit: "0.00", lineNarration: "Cash received" },
      { accountCode: "4003", debit: "0.00", credit: "50000.00", lineNarration: "Other income" },
    ],
  },
];

export const SEED_PARTIES = [
  {
    name: "Karachi Traders",
    ntn: "2345678-9",
    partyType: "Debtor" as const,
    outstandingDays: 25,
    outstandingAmount: "590000.00",
    whtStatus: null as string | null,
  },
  {
    name: "Lahore Distributors",
    ntn: "5678901-2",
    partyType: "Debtor" as const,
    outstandingDays: 45,
    outstandingAmount: "350000.00",
    whtStatus: null,
  },
  {
    name: "Multan Traders",
    ntn: "6789012-3",
    partyType: "Debtor" as const,
    outstandingDays: 75,
    outstandingAmount: "826000.00",
    whtStatus: null,
  },
  {
    name: "Rawalpindi Co.",
    ntn: "8901234-5",
    partyType: "Debtor" as const,
    outstandingDays: 100,
    outstandingAmount: "420000.00",
    whtStatus: null,
  },
  {
    name: "Islamabad Stores",
    ntn: "9012345-6",
    partyType: "Debtor" as const,
    outstandingDays: 135,
    outstandingAmount: "280000.00",
    whtStatus: null,
  },
  {
    name: "Pak Steel Ltd",
    ntn: "3456789-0",
    partyType: "Creditor" as const,
    outstandingDays: 20,
    outstandingAmount: "784000.00",
    whtStatus: "Deducted",
  },
  {
    name: "Al-Noor Properties",
    ntn: "4567890-1",
    partyType: "Creditor" as const,
    outstandingDays: 10,
    outstandingAmount: "108000.00",
    whtStatus: "Deducted",
  },
  {
    name: "Faisalabad Mills",
    ntn: "7890123-4",
    partyType: "Creditor" as const,
    outstandingDays: 40,
    outstandingAmount: "588000.00",
    whtStatus: "Deducted",
  },
  {
    name: "Sukkur Suppliers",
    ntn: "0123456-7",
    partyType: "Creditor" as const,
    outstandingDays: 65,
    outstandingAmount: "320000.00",
    whtStatus: "Pending",
  },
  {
    name: "Sialkot Exports",
    ntn: "1234567-1",
    partyType: "Creditor" as const,
    outstandingDays: 90,
    outstandingAmount: "175000.00",
    whtStatus: "Pending",
  },
];
