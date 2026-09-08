import type { Prisma } from "@/generated/prisma/client";
import { ACCOUNT_CODES } from "@/lib/accounts/codes";

export type StockPostingAccounts = {
  stock: { id: bigint; code: string; name: string };
  cogs: { id: bigint; code: string; name: string };
  creditors: { id: bigint; code: string; name: string };
  capital: { id: bigint; code: string; name: string };
  otherIncome: { id: bigint; code: string; name: string };
  adminExpense: { id: bigint; code: string; name: string };
};

const SELECT = { id: true, code: true, name: true, isActive: true } as const;

async function requireAccount(
  tx: Prisma.TransactionClient,
  companyId: bigint,
  code: string,
  label: string,
): Promise<{ id: bigint; code: string; name: string }> {
  const account = await tx.account.findFirst({
    where: { companyId, code },
    select: SELECT,
  });
  if (!account) {
    throw new Error(`Required account missing: ${code} ${label}.`);
  }
  if (!account.isActive) {
    throw new Error(`Inactive posting account: ${code}.`);
  }
  return { id: account.id, code: account.code, name: account.name };
}

export async function resolveStockPostingAccounts(
  tx: Prisma.TransactionClient,
  companyId: bigint,
): Promise<StockPostingAccounts> {
  const cogsExisting = await tx.account.findFirst({
    where: { companyId, code: ACCOUNT_CODES.COGS },
    select: SELECT,
  });

  if (!cogsExisting) {
    await tx.account.create({
      data: {
        companyId,
        code: ACCOUNT_CODES.COGS,
        name: "Cost of Goods Sold",
        accountType: "Expense",
        accountGroup: "COGS",
        bsSection: "None",
        plSection: "Cogs",
        cfLink: "None",
        normalBalance: "Debit",
        isActive: true,
      },
    });
  } else if (!cogsExisting.isActive) {
    throw new Error(`Inactive posting account: ${ACCOUNT_CODES.COGS}.`);
  }

  const [stock, cogs, creditors, capital, otherIncome, adminExpense] = await Promise.all([
    requireAccount(tx, companyId, ACCOUNT_CODES.STOCK_IN_TRADE, "Stock in Trade"),
    requireAccount(tx, companyId, ACCOUNT_CODES.COGS, "Cost of Goods Sold"),
    requireAccount(tx, companyId, ACCOUNT_CODES.TRADE_CREDITORS, "Trade Creditors"),
    requireAccount(tx, companyId, "3001", "Owner's Capital"),
    requireAccount(tx, companyId, "4003", "Other Income"),
    requireAccount(tx, companyId, "6005", "Administrative Expenses"),
  ]);

  return { stock, cogs, creditors, capital, otherIncome, adminExpense };
}
