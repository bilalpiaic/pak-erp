import type { Account, Party, Prisma } from "@/generated/prisma/client";
import { ACCOUNT_CODES, DEBTOR_SUBLEDGER_PREFIX } from "@/lib/accounts/codes";

type Tx = Prisma.TransactionClient;

export function partyNeedsDebtorAccount(partyType: string): boolean {
  return partyType === "Debtor" || partyType === "Both";
}

async function nextNamedDebtorCode(tx: Tx, companyId: bigint): Promise<string> {
  const rows = await tx.account.findMany({
    where: { companyId, code: { startsWith: DEBTOR_SUBLEDGER_PREFIX } },
    select: { code: true },
  });
  let max = 0;
  for (const row of rows) {
    const n = Number(row.code.slice(DEBTOR_SUBLEDGER_PREFIX.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${DEBTOR_SUBLEDGER_PREFIX}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Ensure a Debtor/Both party has a named Trade Debtors GL head (1010-NNN).
 * Reuses an unused same-name Trade Debtors account when present.
 */
export async function ensureDebtorNamedAccount(
  tx: Tx,
  party: Party,
): Promise<{ party: Party; account: Account }> {
  if (!partyNeedsDebtorAccount(party.partyType)) {
    throw new Error("Named debtor COA is only created for Debtor or Both parties.");
  }

  if (party.accountId) {
    const existing = await tx.account.findFirst({
      where: { id: party.accountId, companyId: party.companyId },
    });
    if (existing) {
      if (existing.name !== party.name) {
        const renamed = await tx.account.update({
          where: { id: existing.id },
          data: { name: party.name },
        });
        return { party, account: renamed };
      }
      return { party, account: existing };
    }
  }

  const sameName = await tx.account.findFirst({
    where: {
      companyId: party.companyId,
      name: party.name,
      bsSection: "TradeDebtors",
      code: { not: ACCOUNT_CODES.TRADE_DEBTORS },
    },
  });
  if (sameName) {
    const linked = await tx.party.findFirst({ where: { accountId: sameName.id } });
    if (!linked || linked.id === party.id) {
      const updated = await tx.party.update({
        where: { id: party.id },
        data: { accountId: sameName.id },
      });
      return { party: updated, account: sameName };
    }
  }

  const code = await nextNamedDebtorCode(tx, party.companyId);
  const account = await tx.account.create({
    data: {
      companyId: party.companyId,
      code,
      name: party.name,
      accountType: "Asset",
      accountGroup: "Current Assets",
      bsSection: "TradeDebtors",
      plSection: "None",
      cfLink: "None",
      normalBalance: "Debit",
      isActive: true,
    },
  });

  await tx.auditLog.create({
    data: {
      companyId: party.companyId,
      actor: "system",
      action: "CREATE",
      entity: "Account",
      recordId: account.id.toString(),
      newValue: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        origin: "debtor-subledger",
        partyId: party.id.toString(),
      },
    },
  });

  const updated = await tx.party.update({
    where: { id: party.id },
    data: { accountId: account.id },
  });

  return { party: updated, account };
}
