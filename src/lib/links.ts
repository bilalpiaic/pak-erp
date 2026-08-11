/** Canonical in-app deep links to source documents / masters. */

export function voucherHref(id: string): string {
  return `/vouchers?id=${encodeURIComponent(id)}`;
}

export function salesInvoiceHref(id: string): string {
  return `/sales-invoices?id=${encodeURIComponent(id)}`;
}

export function partyLedgerHref(
  partyId: string,
  kind: "debtor" | "creditor" = "debtor",
): string {
  return `/party-ledger?partyId=${encodeURIComponent(partyId)}&kind=${kind}`;
}

/** Infer ledger kind from party master type. */
export function partyKindFromType(
  partyType: string | null | undefined,
): "debtor" | "creditor" {
  return partyType === "Creditor" ? "creditor" : "debtor";
}

export function partyMasterHref(partyId?: string | null): string {
  if (!partyId) return "/parties";
  return `/parties?id=${encodeURIComponent(partyId)}`;
}

export function accountLedgerHref(accountCode: string): string {
  return `/ledger?account=${encodeURIComponent(accountCode)}`;
}

/** Map common report labels to COA codes for deep links. */
export const REPORT_LABEL_ACCOUNT_CODES: Record<string, string> = {
  "Trade Debtors": "1010",
  Debtors: "1010",
  "Trade Creditors": "2001",
  Creditors: "2001",
  "Cash in Hand": "1001",
  "Cash at Bank - HBL": "1002",
  "Cash at Bank - MCB": "1003",
  "Stock in Trade": "1020",
  "Owner's Capital": "3001",
  "Retained Earnings": "3002",
  "Sales - Taxable": "4001",
  "Sales - Exempt": "4002",
  Purchases: "5002",
  "Cost of Goods Sold": "5002",
};
