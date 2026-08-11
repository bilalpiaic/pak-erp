import {
  aggregatePostedBalances,
  getDrCr,
  listAccountMeta,
  moneyFromCents,
  signedBalanceCents,
} from "@/lib/accounting/balances";
import { parseIsoDate, todayIso } from "@/lib/accounting/dates";
import { toCents } from "@/lib/accounting/money";
import { getPrimaryCompanyWithFiscalYear } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import type { VoucherTypeValue } from "@/lib/vouchers/types";

export type DashboardKpi = {
  label: string;
  value: string;
  tone: "neutral" | "success" | "danger" | "info" | "warning";
};

export type DashboardRecentVoucher = {
  id: string;
  date: string;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  partyId: string | null;
  partyName: string | null;
  narration: string | null;
  amount: string;
  status: string;
};

export type DashboardResult = {
  companyName: string;
  fiscalYearName: string | null;
  asOf: string;
  kpis: DashboardKpi[];
  recent: DashboardRecentVoucher[];
};

export async function getDashboard(): Promise<DashboardResult> {
  const company = await getPrimaryCompanyWithFiscalYear();
  if (!company) throw new Error("No company found. Create a company in Settings first.");

  const prisma = getPrisma();
  const companyId = BigInt(company.company.id);
  const asOf = todayIso();
  const asOfDate = parseIsoDate(asOf)!;

  const [accounts, balances, vouchers] = await Promise.all([
    listAccountMeta(),
    aggregatePostedBalances({ to: asOf }),
    prisma.voucher.findMany({
      where: { companyId },
      include: { lines: true },
      orderBy: [{ voucherDate: "desc" }, { voucherNo: "desc" }],
      take: 10,
    }),
  ]);

  const signed = (code: string) => {
    const account = accounts.find((a) => a.code === code);
    const bal = getDrCr(balances, code);
    if (!account) return bal.dr - bal.cr;
    return signedBalanceCents(bal, account.normalBalance);
  };

  const totalAssets = accounts
    .filter((a) => a.accountType === "Asset")
    .reduce((s, a) => s + signedBalanceCents(getDrCr(balances, a.code), a.normalBalance), 0);

  const totalLiab = accounts
    .filter((a) => a.accountType === "Liability")
    .reduce((s, a) => s + signedBalanceCents(getDrCr(balances, a.code), a.normalBalance), 0);

  const monthStart = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1));
  const mtdLines = await prisma.voucherLine.findMany({
    where: {
      voucher: {
        companyId,
        status: "POSTED",
        voucherDate: { gte: monthStart, lte: asOfDate },
      },
    },
    include: { account: { select: { code: true, accountType: true } } },
  });

  let revMTD = 0;
  let expMTD = 0;
  for (const line of mtdLines) {
    const debit = toCents(line.debit.toString()) ?? 0;
    const credit = toCents(line.credit.toString()) ?? 0;
    if (line.account.accountType === "Revenue") revMTD += credit - debit;
    if (line.account.accountType === "Expense") expMTD += debit - credit;
  }

  const cashBal = signed("1001") + signed("1002") + signed("1003");
  const netMTD = revMTD - expMTD;

  const kpis: DashboardKpi[] = [
    { label: "Total Assets", value: moneyFromCents(totalAssets), tone: "info" },
    { label: "Total Liabilities", value: moneyFromCents(totalLiab), tone: "danger" },
    { label: "Revenue MTD", value: moneyFromCents(revMTD), tone: "success" },
    { label: "Expenses MTD", value: moneyFromCents(expMTD), tone: "warning" },
    {
      label: "Net Profit MTD",
      value: moneyFromCents(netMTD),
      tone: netMTD >= 0 ? "success" : "danger",
    },
    { label: "Cash & Bank", value: moneyFromCents(cashBal), tone: "info" },
  ];

  const recent: DashboardRecentVoucher[] = vouchers.map((v) => {
    const amountCents = v.lines.reduce(
      (s, l) => s + (toCents(l.debit.toString()) ?? 0),
      0,
    );
    return {
      id: v.id.toString(),
      date: v.voucherDate.toISOString().slice(0, 10),
      voucherNo: v.voucherNo,
      voucherType: v.voucherType as VoucherTypeValue,
      partyId: v.partyId?.toString() ?? null,
      partyName: v.partyName,
      narration: v.narration,
      amount: moneyFromCents(amountCents),
      status: v.status,
    };
  });

  return serialize({
    companyName: company.company.name,
    fiscalYearName: company.fiscalYear?.name ?? null,
    asOf,
    kpis,
    recent,
  });
}
