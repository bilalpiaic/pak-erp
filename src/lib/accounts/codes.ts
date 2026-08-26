/** Shared COA codes used by posting and reports. */
export const ACCOUNT_CODES = {
  CASH_IN_HAND: "1001",
  BANK_HBL: "1002",
  TRADE_DEBTORS: "1010",
  TRADE_CREDITORS: "2001",
  SALES_TAXABLE: "4001",
  SALES_EXEMPT: "4002",
} as const;

export const PROTECTED_ACCOUNT_CODES = new Set<string>(Object.values(ACCOUNT_CODES));

/** Individual named debtor heads: 1010-001, 1010-002, … */
export const DEBTOR_SUBLEDGER_PREFIX = `${ACCOUNT_CODES.TRADE_DEBTORS}-`;

export function isProtectedAccountCode(code: string): boolean {
  return PROTECTED_ACCOUNT_CODES.has(code.trim());
}

export function isNamedDebtorAccountCode(code: string): boolean {
  return code.trim().startsWith(DEBTOR_SUBLEDGER_PREFIX);
}

export function isTradeDebtorsFamily(code: string): boolean {
  const trimmed = code.trim();
  return trimmed === ACCOUNT_CODES.TRADE_DEBTORS || isNamedDebtorAccountCode(trimmed);
}
