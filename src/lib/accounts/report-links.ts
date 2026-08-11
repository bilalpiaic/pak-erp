import type { AccountGroup, AccountType } from "@/lib/accounts/types";

/** Balance Sheet statement sub-heads. */
export const BS_SECTIONS = [
  "None",
  "CashAndBank",
  "TradeDebtors",
  "Stock",
  "AdvancesPrepayments",
  "OtherCurrentAssets",
  "FixedAssetsGross",
  "AccumulatedDepreciation",
  "OtherNonCurrentAssets",
  "OwnersCapital",
  "RetainedEarnings",
  "Drawings",
  "LongTermFinancing",
  "TradeCreditors",
  "AccruedLiabilities",
  "TaxesPayable",
  "ShortTermLoans",
  "OtherCurrentLiabilities",
  "OtherLongTermLiabilities",
] as const;

export type BsSection = (typeof BS_SECTIONS)[number];

/** Profit & Loss statement sub-heads. */
export const PL_SECTIONS = [
  "None",
  "Sales",
  "OtherIncome",
  "OpeningStock",
  "Purchases",
  "ClosingStock",
  "OperatingExpense",
  "Depreciation",
  "FinancialCharges",
  "IncomeTax",
  "OtherExpense",
] as const;

export type PlSection = (typeof PL_SECTIONS)[number];

/**
 * Cash Flow statement link — how movements on this account appear in CF.
 * One field covers activity + role for the COA form.
 */
export const CF_LINKS = [
  "None",
  "CashEquivalent",
  "OperatingReceipt",
  "OperatingPayment",
  "NonCashAddBack",
  "InvestingPurchase",
  "InvestingDisposal",
  "FinancingBorrowing",
  "FinancingRepayment",
  "FinancingCapital",
  "FinancingDrawings",
] as const;

export type CfLink = (typeof CF_LINKS)[number];

export const BS_SECTION_LABELS: Record<BsSection, string> = {
  None: "— Not on Balance Sheet —",
  CashAndBank: "Cash & Bank Balances",
  TradeDebtors: "Trade Debtors",
  Stock: "Stock in Trade",
  AdvancesPrepayments: "Advances, Deposits & Prepayments",
  OtherCurrentAssets: "Other Current Assets",
  FixedAssetsGross: "Tangible Fixed Assets (Gross)",
  AccumulatedDepreciation: "Accumulated Depreciation",
  OtherNonCurrentAssets: "Other Non-current Assets",
  OwnersCapital: "Owner's Capital",
  RetainedEarnings: "Retained Earnings",
  Drawings: "Drawings",
  LongTermFinancing: "Long-term Financing",
  TradeCreditors: "Trade Creditors",
  AccruedLiabilities: "Accrued Liabilities",
  TaxesPayable: "Taxes & WHT Payable",
  ShortTermLoans: "Short-term Loans",
  OtherCurrentLiabilities: "Other Current Liabilities",
  OtherLongTermLiabilities: "Other Long-term Liabilities",
};

export const PL_SECTION_LABELS: Record<PlSection, string> = {
  None: "— Not on Profit & Loss —",
  Sales: "Net Revenue / Sales",
  OtherIncome: "Other Income",
  OpeningStock: "Opening Stock (COGS)",
  Purchases: "Purchases (COGS)",
  ClosingStock: "Closing Stock (COGS)",
  OperatingExpense: "Operating Expenses",
  Depreciation: "Depreciation",
  FinancialCharges: "Financial Charges",
  IncomeTax: "Income Tax",
  OtherExpense: "Other Expenses",
};

export const CF_LINK_LABELS: Record<CfLink, string> = {
  None: "— Not on Cash Flow —",
  CashEquivalent: "Cash & Bank (opening / closing)",
  OperatingReceipt: "Operating — cash receipts",
  OperatingPayment: "Operating — cash payments",
  NonCashAddBack: "Operating — non-cash add-back",
  InvestingPurchase: "Investing — asset purchases",
  InvestingDisposal: "Investing — asset disposals",
  FinancingBorrowing: "Financing — borrowings / proceeds",
  FinancingRepayment: "Financing — repayments",
  FinancingCapital: "Financing — capital introduced",
  FinancingDrawings: "Financing — drawings",
};

/** Groups allowed per account type (COA hierarchy). */
export const GROUPS_BY_TYPE: Record<AccountType, readonly AccountGroup[]> = {
  Asset: ["Current Assets", "Fixed Assets", "Other Assets"],
  Liability: ["Current Liabilities", "Long-term Liabilities"],
  Equity: ["Equity"],
  Revenue: ["Revenue"],
  Expense: [
    "COGS",
    "Operating Expenses",
    "Administrative",
    "Selling & Distribution",
    "Financial Charges",
    "Taxation",
  ],
};

/** BS sections allowed per account type. */
export const BS_BY_TYPE: Record<AccountType, readonly BsSection[]> = {
  Asset: [
    "CashAndBank",
    "TradeDebtors",
    "Stock",
    "AdvancesPrepayments",
    "OtherCurrentAssets",
    "FixedAssetsGross",
    "AccumulatedDepreciation",
    "OtherNonCurrentAssets",
  ],
  Liability: [
    "TradeCreditors",
    "AccruedLiabilities",
    "TaxesPayable",
    "ShortTermLoans",
    "OtherCurrentLiabilities",
    "LongTermFinancing",
    "OtherLongTermLiabilities",
  ],
  Equity: ["OwnersCapital", "RetainedEarnings", "Drawings"],
  Revenue: ["None"],
  Expense: ["None"],
};

/** P&L sections allowed per account type. */
export const PL_BY_TYPE: Record<AccountType, readonly PlSection[]> = {
  Asset: ["None"],
  Liability: ["None"],
  Equity: ["None"],
  Revenue: ["Sales", "OtherIncome"],
  Expense: [
    "OpeningStock",
    "Purchases",
    "ClosingStock",
    "OperatingExpense",
    "Depreciation",
    "FinancialCharges",
    "IncomeTax",
    "OtherExpense",
  ],
};

/** Sensible CF options per account type (form filter). */
export const CF_BY_TYPE: Record<AccountType, readonly CfLink[]> = {
  Asset: [
    "None",
    "CashEquivalent",
    "InvestingPurchase",
    "InvestingDisposal",
    "OperatingPayment",
  ],
  Liability: ["None", "FinancingBorrowing", "FinancingRepayment", "OperatingPayment"],
  Equity: ["None", "FinancingCapital", "FinancingDrawings"],
  Revenue: ["None", "OperatingReceipt"],
  Expense: ["None", "OperatingPayment", "NonCashAddBack"],
};

export type ReportLinkDefaults = {
  accountGroup: AccountGroup;
  normalBalance: "Debit" | "Credit";
  bsSection: BsSection;
  plSection: PlSection;
  cfLink: CfLink;
};

/** Default report links when type or group changes on the form. */
export function defaultsForTypeGroup(
  accountType: AccountType,
  accountGroup?: string | null,
): ReportLinkDefaults {
  const groups = GROUPS_BY_TYPE[accountType];
  const group =
    accountGroup && (groups as readonly string[]).includes(accountGroup)
      ? (accountGroup as AccountGroup)
      : groups[0];

  switch (accountType) {
    case "Asset":
      if (group === "Fixed Assets") {
        return {
          accountGroup: group,
          normalBalance: "Debit",
          bsSection: "FixedAssetsGross",
          plSection: "None",
          cfLink: "InvestingPurchase",
        };
      }
      if (group === "Other Assets") {
        return {
          accountGroup: group,
          normalBalance: "Debit",
          bsSection: "AdvancesPrepayments",
          plSection: "None",
          cfLink: "None",
        };
      }
      return {
        accountGroup: group,
        normalBalance: "Debit",
        bsSection: "OtherCurrentAssets",
        plSection: "None",
        cfLink: "None",
      };
    case "Liability":
      if (group === "Long-term Liabilities") {
        return {
          accountGroup: group,
          normalBalance: "Credit",
          bsSection: "LongTermFinancing",
          plSection: "None",
          cfLink: "FinancingBorrowing",
        };
      }
      return {
        accountGroup: group,
        normalBalance: "Credit",
        bsSection: "OtherCurrentLiabilities",
        plSection: "None",
        cfLink: "None",
      };
    case "Equity":
      return {
        accountGroup: "Equity",
        normalBalance: "Credit",
        bsSection: "OwnersCapital",
        plSection: "None",
        cfLink: "FinancingCapital",
      };
    case "Revenue":
      return {
        accountGroup: "Revenue",
        normalBalance: "Credit",
        bsSection: "None",
        plSection: "Sales",
        cfLink: "OperatingReceipt",
      };
    case "Expense":
      if (group === "COGS") {
        return {
          accountGroup: group,
          normalBalance: "Debit",
          bsSection: "None",
          plSection: "Purchases",
          cfLink: "OperatingPayment",
        };
      }
      if (group === "Financial Charges") {
        return {
          accountGroup: group,
          normalBalance: "Debit",
          bsSection: "None",
          plSection: "FinancialCharges",
          cfLink: "OperatingPayment",
        };
      }
      if (group === "Taxation") {
        return {
          accountGroup: group,
          normalBalance: "Debit",
          bsSection: "None",
          plSection: "IncomeTax",
          cfLink: "OperatingPayment",
        };
      }
      return {
        accountGroup: group,
        normalBalance: "Debit",
        bsSection: "None",
        plSection: "OperatingExpense",
        cfLink: "OperatingPayment",
      };
  }
}

/** Suggested CF link when BS / P&L section changes. */
export function suggestCfLink(
  accountType: AccountType,
  bsSection: BsSection,
  plSection: PlSection,
): CfLink {
  if (bsSection === "CashAndBank") return "CashEquivalent";
  if (bsSection === "FixedAssetsGross") return "InvestingPurchase";
  if (bsSection === "AccumulatedDepreciation") return "None";
  if (bsSection === "LongTermFinancing" || bsSection === "ShortTermLoans") {
    return "FinancingBorrowing";
  }
  if (bsSection === "OwnersCapital") return "FinancingCapital";
  if (bsSection === "Drawings") return "FinancingDrawings";
  if (plSection === "Sales" || plSection === "OtherIncome") return "OperatingReceipt";
  if (plSection === "Depreciation") return "NonCashAddBack";
  if (
    plSection === "Purchases" ||
    plSection === "OperatingExpense" ||
    plSection === "FinancialCharges" ||
    plSection === "IncomeTax" ||
    plSection === "OtherExpense" ||
    plSection === "OpeningStock"
  ) {
    return "OperatingPayment";
  }
  if (plSection === "ClosingStock") return "None";
  if (accountType === "Asset" || accountType === "Liability" || accountType === "Equity") {
    return "None";
  }
  return "None";
}

export function isBsSection(value: string | null | undefined): value is BsSection {
  return !!value && (BS_SECTIONS as readonly string[]).includes(value);
}

export function isPlSection(value: string | null | undefined): value is PlSection {
  return !!value && (PL_SECTIONS as readonly string[]).includes(value);
}

export function isCfLink(value: string | null | undefined): value is CfLink {
  return !!value && (CF_LINKS as readonly string[]).includes(value);
}

/** True when type posts to Balance Sheet (else P&L). Mutually exclusive. */
export function isBalanceSheetAccountType(accountType: AccountType): boolean {
  return (
    accountType === "Asset" || accountType === "Liability" || accountType === "Equity"
  );
}

export type StatementHeadOption = {
  value: string;
  label: string;
  kind: "bs" | "pl";
};

/**
 * Single LOV of statement heads for the account type.
 * Asset/Liability/Equity → BS heads only; Revenue/Expense → P&L heads only.
 */
export function statementHeadsForType(accountType: AccountType): StatementHeadOption[] {
  if (isBalanceSheetAccountType(accountType)) {
    return BS_BY_TYPE[accountType]
      .filter((section) => section !== "None")
      .map((section) => ({
        value: section,
        label: `BS · ${BS_SECTION_LABELS[section]}`,
        kind: "bs" as const,
      }));
  }
  return PL_BY_TYPE[accountType]
    .filter((section) => section !== "None")
    .map((section) => ({
      value: section,
      label: `P&L · ${PL_SECTION_LABELS[section]}`,
      kind: "pl" as const,
    }));
}

/** Active either/or statement head value from stored bs/pl fields. */
export function activeStatementHead(input: {
  accountType: AccountType;
  bsSection?: string | null;
  plSection?: string | null;
}): string {
  if (isBalanceSheetAccountType(input.accountType)) {
    return input.bsSection && input.bsSection !== "None" ? input.bsSection : "";
  }
  return input.plSection && input.plSection !== "None" ? input.plSection : "";
}

/** Apply one statement-head pick → exclusive bsSection / plSection + suggested CF. */
export function applyStatementHead(
  accountType: AccountType,
  head: string,
): { bsSection: BsSection; plSection: PlSection; cfLink: CfLink } {
  if (isBalanceSheetAccountType(accountType)) {
    const bsSection = isBsSection(head) && head !== "None" ? head : "OtherCurrentAssets";
    const plSection: PlSection = "None";
    return {
      bsSection,
      plSection,
      cfLink: suggestCfLink(accountType, bsSection, plSection),
    };
  }
  const plSection = isPlSection(head) && head !== "None" ? head : "OperatingExpense";
  const bsSection: BsSection = "None";
  return {
    bsSection,
    plSection,
    cfLink: suggestCfLink(accountType, bsSection, plSection),
  };
}

/** Display label for the single statement-head column on COA. */
export function statementHeadLabel(input: {
  accountType: AccountType;
  bsSection?: string | null;
  plSection?: string | null;
}): string {
  if (isBalanceSheetAccountType(input.accountType)) {
    const value = input.bsSection;
    if (!value || value === "None") return "—";
    return isBsSection(value) ? `BS · ${BS_SECTION_LABELS[value]}` : value;
  }
  const value = input.plSection;
  if (!value || value === "None") return "—";
  return isPlSection(value) ? `P&L · ${PL_SECTION_LABELS[value]}` : value;
}

