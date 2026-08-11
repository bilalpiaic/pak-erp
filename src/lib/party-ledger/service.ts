import { ACCOUNT_CODES } from "@/lib/accounts/codes";
import {
  aggregatePostedBalances,
  getDrCr,
  listAccountMeta,
  moneyFromCents,
} from "@/lib/accounting/balances";
import { DEFAULT_FY_START, parseIsoDate, todayIso } from "@/lib/accounting/dates";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import type { CompanyDTO } from "@/lib/company/types";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import type { PartyTypeValue } from "@/lib/parties/types";
import type { VoucherTypeValue } from "@/lib/vouchers/types";

export type PartyLedgerKind = "debtor" | "creditor";

export type PartyLedgerQuery = {
  partyId: string;
  kind?: PartyLedgerKind;
  from?: string;
  to?: string;
};

export type PartyLedgerTxnDTO = {
  date: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  referenceNo: string | null;
  narration: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
  runningSide: "Debit" | "Credit";
};

export type PartyLedgerResult = {
  from: string;
  to: string;
  kind: PartyLedgerKind;
  company: CompanyDTO;
  party: {
    id: string;
    name: string;
    ntn: string | null;
    partyType: PartyTypeValue;
    phone: string | null;
    address: string | null;
  };
  account: {
    code: string;
    name: string;
    normalBalance: "Debit" | "Credit";
  };
  opening: {
    debit: string;
    credit: string;
    balance: string;
    side: "Debit" | "Credit";
  };
  transactions: PartyLedgerTxnDTO[];
  period: { debit: string; credit: string; count: number };
  closing: {
    balance: string;
    side: "Debit" | "Credit";
  };
};

async function requireCompany(): Promise<CompanyDTO> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return company;
}

function sideFromSigned(signed: number): "Debit" | "Credit" {
  return signed >= 0 ? "Debit" : "Credit";
}

function resolveKind(
  partyType: PartyTypeValue,
  requested?: PartyLedgerKind,
): PartyLedgerKind {
  if (requested) return requested;
  if (partyType === "Creditor") return "creditor";
  return "debtor";
}

export async function getPartyLedger(
  query: PartyLedgerQuery,
): Promise<PartyLedgerResult> {
  if (!query.partyId?.trim()) {
    throw new Error("Party is required.");
  }

  const prisma = getPrisma();
  const company = await requireCompany();
  const companyId = BigInt(company.id);
  const partyId = BigInt(query.partyId);

  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId },
  });
  if (!party) throw new Error("Party not found.");

  const kind = resolveKind(party.partyType as PartyTypeValue, query.kind);
  if (kind === "debtor" && party.partyType === "Creditor") {
    throw new Error("This party is a Creditor — use Creditor ledger.");
  }
  if (kind === "creditor" && party.partyType === "Debtor") {
    throw new Error("This party is a Debtor — use Debtor ledger.");
  }

  const accountCode =
    kind === "debtor" ? ACCOUNT_CODES.TRADE_DEBTORS : ACCOUNT_CODES.TRADE_CREDITORS;
  const accounts = await listAccountMeta();
  const account = accounts.find((a) => a.code === accountCode);
  if (!account) {
    throw new Error(`Account ${accountCode} not found in chart of accounts.`);
  }

  const fromStr = query.from ?? DEFAULT_FY_START;
  const toStr = query.to ?? todayIso();
  const from = parseIsoDate(fromStr);
  const to = parseIsoDate(toStr);
  if (!from || !to) throw new Error("Invalid date range. Use YYYY-MM-DD.");
  if (from > to) throw new Error("From date must be on or before To date.");

  const openingMap = await aggregatePostedBalances({
    before: fromStr,
    accountCode,
    partyId: query.partyId,
  });
  const opening = getDrCr(openingMap, accountCode);
  let run = opening.dr - opening.cr;

  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      partyId,
      status: "POSTED",
      voucherDate: { gte: from, lte: to },
      lines: { some: { account: { code: accountCode } } },
    },
    include: {
      lines: {
        where: { account: { code: accountCode } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ voucherDate: "asc" }, { voucherNo: "asc" }],
  });

  const transactions: PartyLedgerTxnDTO[] = [];
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
        referenceNo: voucher.referenceNo,
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
    kind,
    company,
    party: {
      id: party.id.toString(),
      name: party.name,
      ntn: party.ntn,
      partyType: party.partyType as PartyTypeValue,
      phone: party.phone,
      address: party.address,
    },
    account: {
      code: account.code,
      name: account.name,
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
