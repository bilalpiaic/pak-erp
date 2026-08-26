import { ACCOUNT_CODES } from "@/lib/accounts/codes";
import {
  listAccountMeta,
  moneyFromCents,
} from "@/lib/accounting/balances";
import { parseIsoDate } from "@/lib/accounting/dates";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import type { CompanyDTO } from "@/lib/company/types";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import { getActiveDateRange } from "@/lib/fiscal-years/service";
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
  accountCode: string;
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
    controlCode: string;
    controlName: string;
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
    include: { account: { select: { id: true, code: true, name: true } } },
  });
  if (!party) throw new Error("Party not found.");

  const kind = resolveKind(party.partyType as PartyTypeValue, query.kind);
  if (kind === "debtor" && party.partyType === "Creditor") {
    throw new Error("This party is a Creditor — use Creditor ledger.");
  }
  if (kind === "creditor" && party.partyType === "Debtor") {
    throw new Error("This party is a Debtor — use Debtor ledger.");
  }

  const controlCode =
    kind === "debtor" ? ACCOUNT_CODES.TRADE_DEBTORS : ACCOUNT_CODES.TRADE_CREDITORS;
  const accounts = await listAccountMeta();
  const control = accounts.find((a) => a.code === controlCode);
  if (!control) {
    throw new Error(`Account ${controlCode} not found in chart of accounts.`);
  }

  const named =
    kind === "debtor" && party.account
      ? accounts.find((a) => a.id === party.account!.id.toString()) ?? {
          id: party.account.id.toString(),
          code: party.account.code,
          name: party.account.name,
          accountType: "Asset",
          accountGroup: "Current Assets",
          bsSection: "TradeDebtors",
          plSection: "None",
          cfLink: "None",
          normalBalance: "Debit" as const,
          isActive: true,
        }
      : null;

  const display = named ?? control;

  const activeRange = await getActiveDateRange();
  const fromStr = query.from ?? activeRange.from;
  const toStr = query.to ?? activeRange.to;
  const from = parseIsoDate(fromStr);
  const to = parseIsoDate(toStr);
  if (!from || !to) throw new Error("Invalid date range. Use YYYY-MM-DD.");
  if (from > to) throw new Error("From date must be on or before To date.");

  const dateFilter = { gte: from, lte: to };
  const openingDateFilter = { lt: from };

  function linesForRange(voucherDate: { gte?: Date; lte?: Date; lt?: Date }) {
    return {
      OR: [
        {
          account: { code: controlCode },
          voucher: {
            companyId,
            partyId,
            status: "POSTED" as const,
            voucherDate,
          },
        },
        ...(named
          ? [
              {
                accountId: BigInt(named.id),
                voucher: {
                  companyId,
                  status: "POSTED" as const,
                  voucherDate,
                },
              },
            ]
          : []),
      ],
    };
  }

  const openingLines = await prisma.voucherLine.findMany({
    where: linesForRange(openingDateFilter),
    select: { debit: true, credit: true },
  });

  let openingDr = 0;
  let openingCr = 0;
  for (const line of openingLines) {
    openingDr += toCents(line.debit.toString()) ?? 0;
    openingCr += toCents(line.credit.toString()) ?? 0;
  }
  const opening = { dr: openingDr, cr: openingCr };
  let run = opening.dr - opening.cr;

  const periodLines = await prisma.voucherLine.findMany({
    where: linesForRange(dateFilter),
    include: {
      account: { select: { code: true } },
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          voucherType: true,
          voucherDate: true,
          referenceNo: true,
          narration: true,
        },
      },
    },
    orderBy: [{ id: "asc" }],
  });

  periodLines.sort((a, b) => {
    const dateCmp = a.voucher.voucherDate.getTime() - b.voucher.voucherDate.getTime();
    if (dateCmp !== 0) return dateCmp;
    const noCmp = a.voucher.voucherNo.localeCompare(b.voucher.voucherNo);
    if (noCmp !== 0) return noCmp;
    return Number(a.id - b.id);
  });

  const transactions: PartyLedgerTxnDTO[] = [];
  let periodDr = 0;
  let periodCr = 0;

  for (const line of periodLines) {
    const debit = toCents(line.debit.toString()) ?? 0;
    const credit = toCents(line.credit.toString()) ?? 0;
    periodDr += debit;
    periodCr += credit;
    run += debit - credit;
    transactions.push({
      date: line.voucher.voucherDate.toISOString().slice(0, 10),
      voucherId: line.voucher.id.toString(),
      voucherNo: line.voucher.voucherNo,
      voucherType: line.voucher.voucherType as VoucherTypeValue,
      accountCode: line.account.code,
      referenceNo: line.voucher.referenceNo,
      narration: line.lineNarration ?? line.voucher.narration,
      debit: centsToDecimalString(debit),
      credit: centsToDecimalString(credit),
      runningBalance: moneyFromCents(Math.abs(run)),
      runningSide: sideFromSigned(run),
    });
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
      code: display.code,
      name: display.name,
      normalBalance: display.normalBalance,
      controlCode: control.code,
      controlName: control.name,
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
