export type NavItem = {
  href: string;
  label: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    title: "Accounting",
    items: [
      { href: "/accounts", label: "Chart of Accounts" },
      { href: "/parties", label: "Parties" },
      { href: "/vouchers", label: "Voucher Entry" },
      { href: "/journal", label: "General Journal" },
      { href: "/ledger", label: "Account Ledger" },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/reports/trial-balance", label: "Trial Balance" },
      { href: "/reports/balance-sheet", label: "Balance Sheet" },
      { href: "/reports/profit-loss", label: "Profit & Loss" },
      { href: "/reports/cash-flow", label: "Cash Flow" },
      { href: "/reports/debtors-aging", label: "Debtors Aging" },
      { href: "/reports/creditors-aging", label: "Creditors Aging" },
    ],
  },
  {
    title: "Administration",
    items: [{ href: "/settings", label: "Company Settings" }],
  },
];

export const REPORT_LINKS = NAV_SECTIONS.find((s) => s.title === "Reports")?.items ?? [];
