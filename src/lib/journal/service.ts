import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import { centsToDecimalString, sumCents, toCents } from "@/lib/accounting/money";
import { DEFAULT_FY_START, parseIsoDate, todayIso } from "@/lib/accounting/dates";
import { ALL_VOUCHER_TYPES, type VoucherTypeValue } from "@/lib/vouchers/types";

export type JournalQuery = {
  from?: string;
  to?: string;
  voucherType?: string;
  search?: string;
};

export type JournalLineDTO = {
  date: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  accountCode: string;
  accountName: string;
  partyName: string | null;
  referenceNo: string | null;
  narration: string | null;
  debit: string;
  credit: string;
};

export type JournalResult = {
  from: string;
  to: string;
  lines: JournalLineDTO[];
  totals: { debit: string; credit: string; balanced: boolean; count: number };
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

export async function getJournal(query: JournalQuery = {}): Promise<JournalResult> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const fromStr = query.from ?? DEFAULT_FY_START;
  const toStr = query.to ?? todayIso();
  const from = parseIsoDate(fromStr);
  const to = parseIsoDate(toStr);
  if (!from || !to) throw new Error("Invalid date range. Use YYYY-MM-DD.");
  if (from > to) throw new Error("From date must be on or before To date.");

  const typeFilter =
    query.voucherType &&
    query.voucherType !== "All" &&
    (ALL_VOUCHER_TYPES as readonly string[]).includes(query.voucherType)
      ? (query.voucherType as VoucherTypeValue)
      : undefined;

  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      status: "POSTED",
      voucherDate: { gte: from, lte: to },
      ...(typeFilter ? { voucherType: typeFilter } : {}),
    },
    include: {
      lines: {
        include: {
          account: { select: { code: true, name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ voucherDate: "asc" }, { voucherNo: "asc" }],
  });

  const search = query.search?.trim().toLowerCase() ?? "";
  const lines: JournalLineDTO[] = [];

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      const narration = line.lineNarration ?? voucher.narration;
      if (search) {
        const hay = [
          voucher.voucherNo,
          line.account.code,
          line.account.name,
          voucher.partyName ?? "",
          voucher.referenceNo ?? "",
          narration ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) continue;
      }

      lines.push({
        date: voucher.voucherDate.toISOString().slice(0, 10),
        voucherId: voucher.id.toString(),
        voucherNo: voucher.voucherNo,
        voucherType: voucher.voucherType as VoucherTypeValue,
        accountCode: line.account.code,
        accountName: line.account.name,
        partyName: voucher.partyName,
        referenceNo: voucher.referenceNo,
        narration,
        debit: centsToDecimalString(toCents(line.debit.toString()) ?? 0),
        credit: centsToDecimalString(toCents(line.credit.toString()) ?? 0),
      });
    }
  }

  const debitCents = sumCents(lines.map((l) => l.debit));
  const creditCents = sumCents(lines.map((l) => l.credit));

  return serialize({
    from: fromStr,
    to: toStr,
    lines,
    totals: {
      debit: centsToDecimalString(debitCents),
      credit: centsToDecimalString(creditCents),
      balanced: debitCents === creditCents,
      count: lines.length,
    },
  });
}
