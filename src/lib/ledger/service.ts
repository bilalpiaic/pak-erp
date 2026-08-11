import {
  aggregatePostedBalances,
  getDrCr,
  listAccountMeta,
  moneyFromCents,
} from "@/lib/accounting/balances";
import { DEFAULT_FY_START, parseIsoDate, todayIso } from "@/lib/accounting/dates";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import type { VoucherTypeValue } from "@/lib/vouchers/types";

export type LedgerQuery = {
  accountCode?: string;
  from?: string;
  to?: string;
};

export type LedgerTxnDTO = {
  date: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  partyId: string | null;
  partyName: string | null;
  narration: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
  runningSide: "Debit" | "Credit";
};

export type LedgerResult = {
  from: string;
  to: string;
  account: {
    code: string;
    name: string;
    accountType: string;
    accountGroup: string | null;
    normalBalance: "Debit" | "Credit";
  };
  opening: {
    debit: string;
    credit: string;
    balance: string;
    side: "Debit" | "Credit";
  };
  transactions: LedgerTxnDTO[];
  period: { debit: string; credit: string; count: number };
  closing: {
    balance: string;
    side: "Debit" | "Credit";
  };
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

function sideFromSigned(signed: number): "Debit" | "Credit" {
  return signed >= 0 ? "Debit" : "Credit";
}

export async function getLedger(query: LedgerQuery = {}): Promise<LedgerResult> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const accounts = await listAccountMeta();
  const code = query.accountCode ?? accounts.find((a) => a.isActive)?.code ?? "1001";
  const account = accounts.find((a) => a.code === code);
  if (!account) throw new Error(`Account ${code} not found.`);

  const fromStr = query.from ?? DEFAULT_FY_START;
  const toStr = query.to ?? todayIso();
  const from = parseIsoDate(fromStr);
  const to = parseIsoDate(toStr);
  if (!from || !to) throw new Error("Invalid date range. Use YYYY-MM-DD.");
  if (from > to) throw new Error("From date must be on or before To date.");

  const openingMap = await aggregatePostedBalances({
    before: fromStr,
    accountCode: code,
  });
  const opening = getDrCr(openingMap, code);
  // Running balance tracked as debit-minus-credit (debit positive)
  let run = opening.dr - opening.cr;

  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      status: "POSTED",
      voucherDate: { gte: from, lte: to },
      lines: { some: { account: { code } } },
    },
    include: {
      lines: {
        where: { account: { code } },
        include: { account: { select: { code: true } } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ voucherDate: "asc" }, { voucherNo: "asc" }],
  });

  const transactions: LedgerTxnDTO[] = [];
  let periodDr = 0;
  let periodCr = 0;

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const debit = toCents(line.debit.toString()) ?? 0;
      const credit = toCents(line.credit.toString()) ?? 0;
      periodDr += debit;
      periodCr += credit;
      run += debit - credit;
      transactions.push({
        date: voucher.voucherDate.toISOString().slice(0, 10),
        voucherId: voucher.id.toString(),
        voucherNo: voucher.voucherNo,
        voucherType: voucher.voucherType as VoucherTypeValue,
        partyId: voucher.partyId?.toString() ?? null,
        partyName: voucher.partyName,
        narration: line.lineNarration ?? voucher.narration,
        debit: centsToDecimalString(debit),
        credit: centsToDecimalString(credit),
        runningBalance: moneyFromCents(Math.abs(run)),
        runningSide: sideFromSigned(run),
      });
    }
  }

  const openSigned = opening.dr - opening.cr;

  return serialize({
    from: fromStr,
    to: toStr,
    account: {
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      accountGroup: account.accountGroup,
      normalBalance: account.normalBalance,
    },
    opening: {
      debit: centsToDecimalString(opening.dr),
      credit: centsToDecimalString(opening.cr),
      balance: moneyFromCents(Math.abs(openSigned)),
      side: sideFromSigned(openSigned),
    },
    transactions,
    period: {
      debit: centsToDecimalString(periodDr),
      credit: centsToDecimalString(periodCr),
      count: transactions.length,
    },
    closing: {
      balance: moneyFromCents(Math.abs(run)),
      side: sideFromSigned(run),
    },
  });
}

export async function listLedgerAccounts() {
  const accounts = await listAccountMeta();
  return accounts
    .filter((a) => a.isActive)
    .map((a) => ({ code: a.code, name: a.name, accountType: a.accountType }));
}
