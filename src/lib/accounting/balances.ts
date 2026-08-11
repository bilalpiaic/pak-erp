import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";

import { centsToDecimalString, toCents } from "./money";
import { parseIsoDate } from "./dates";

export type AccountMeta = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountGroup: string | null;
  normalBalance: "Debit" | "Credit";
  isActive: boolean;
};

export type DrCrCents = { dr: number; cr: number };

export type AccountBalanceMap = Map<string, DrCrCents>;

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) {
    throw new Error("No company found. Create a company in Settings first.");
  }
  return BigInt(company.id);
}

export async function listAccountMeta(): Promise<AccountMeta[]> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
  return accounts.map((account) => ({
    id: account.id.toString(),
    code: account.code,
    name: account.name,
    accountType: account.accountType,
    accountGroup: account.accountGroup,
    normalBalance: account.normalBalance,
    isActive: account.isActive,
  }));
}

type AggregateOptions = {
  /** Inclusive lower bound (voucher_date >= from) */
  from?: string | null;
  /** Inclusive upper bound (voucher_date <= to) */
  to?: string | null;
  /** Strict upper bound (voucher_date < before) — for opening balances */
  before?: string | null;
  accountCode?: string | null;
};

/**
 * Sum debit/credit cents for POSTED voucher lines, keyed by account code.
 */
export async function aggregatePostedBalances(
  options: AggregateOptions = {},
): Promise<AccountBalanceMap> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const from = options.from ? parseIsoDate(options.from) : null;
  const to = options.to ? parseIsoDate(options.to) : null;
  const before = options.before ? parseIsoDate(options.before) : null;

  if (options.from && !from) throw new Error("Invalid from date. Use YYYY-MM-DD.");
  if (options.to && !to) throw new Error("Invalid to date. Use YYYY-MM-DD.");
  if (options.before && !before) throw new Error("Invalid before date. Use YYYY-MM-DD.");

  const lines = await prisma.voucherLine.findMany({
    where: {
      account: options.accountCode
        ? { companyId, code: options.accountCode }
        : { companyId },
      voucher: {
        companyId,
        status: "POSTED",
        ...(from || to || before
          ? {
              voucherDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
                ...(before ? { lt: before } : {}),
              },
            }
          : {}),
      },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { code: true } },
    },
  });

  const map: AccountBalanceMap = new Map();
  for (const line of lines) {
    const code = line.account.code;
    const current = map.get(code) ?? { dr: 0, cr: 0 };
    current.dr += toCents(line.debit.toString()) ?? 0;
    current.cr += toCents(line.credit.toString()) ?? 0;
    map.set(code, current);
  }
  return map;
}

export function emptyDrCr(): DrCrCents {
  return { dr: 0, cr: 0 };
}

export function getDrCr(map: AccountBalanceMap, code: string): DrCrCents {
  return map.get(code) ?? emptyDrCr();
}

/** Signed balance: Debit-normal → dr-cr; Credit-normal → cr-dr. */
export function signedBalanceCents(
  bal: DrCrCents,
  normalBalance: "Debit" | "Credit",
): number {
  return normalBalance === "Debit" ? bal.dr - bal.cr : bal.cr - bal.dr;
}

export function moneyFromCents(cents: number): string {
  return centsToDecimalString(cents);
}

export function drCrMoney(bal: DrCrCents): { debit: string; credit: string } {
  return {
    debit: centsToDecimalString(bal.dr),
    credit: centsToDecimalString(bal.cr),
  };
}
