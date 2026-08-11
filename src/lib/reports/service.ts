import {
  aggregatePostedBalances,
  getDrCr,
  listAccountMeta,
  moneyFromCents,
  signedBalanceCents,
  type AccountBalanceMap,
  type AccountMeta,
  type DrCrCents,
} from "@/lib/accounting/balances";
import {
  daysBetween,
  DEFAULT_FY_START,
  parseIsoDate,
  todayIso,
} from "@/lib/accounting/dates";
import { toCents } from "@/lib/accounting/money";
import { getPrimaryCompanyWithFiscalYear } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

export const REPORT_TYPES = [
  "trial-balance",
  "balance-sheet",
  "profit-loss",
  "cash-flow",
  "debtors-aging",
  "creditors-aging",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportQuery = {
  from?: string;
  to?: string;
};

type ReportContext = {
  from: string;
  to: string;
  companyName: string;
  fiscalYearName: string | null;
  accounts: AccountMeta[];
  balTo: AccountBalanceMap;
  period: AccountBalanceMap;
  prev: AccountBalanceMap;
};

function nb(map: AccountBalanceMap, accounts: AccountMeta[], code: string): number {
  const account = accounts.find((a) => a.code === code);
  const bal = getDrCr(map, code);
  if (!account) return bal.dr - bal.cr;
  return signedBalanceCents(bal, account.normalBalance);
}

function creditNet(map: AccountBalanceMap, code: string): number {
  const bal = getDrCr(map, code);
  return Math.max(bal.cr - bal.dr, 0);
}

function debitNet(map: AccountBalanceMap, code: string): number {
  const bal = getDrCr(map, code);
  return Math.max(bal.dr - bal.cr, 0);
}

async function buildContext(query: ReportQuery): Promise<ReportContext> {
  const company = await getPrimaryCompanyWithFiscalYear();
  if (!company) throw new Error("No company found. Create a company in Settings first.");

  const from = query.from ?? company.fiscalYear?.startDate ?? DEFAULT_FY_START;
  const to = query.to ?? todayIso();
  if (!parseIsoDate(from) || !parseIsoDate(to)) {
    throw new Error("Invalid date range. Use YYYY-MM-DD.");
  }
  if (from > to) throw new Error("From date must be on or before To date.");

  const [accounts, balTo, period, prev] = await Promise.all([
    listAccountMeta(),
    aggregatePostedBalances({ to }),
    aggregatePostedBalances({ from, to }),
    aggregatePostedBalances({ before: from }),
  ]);

  return {
    from,
    to,
    companyName: company.company.name,
    fiscalYearName: company.fiscalYear?.name ?? null,
    accounts,
    balTo,
    period,
    prev,
  };
}

function reportHeader(ctx: ReportContext, title: string) {
  return {
    title,
    companyName: ctx.companyName,
    fiscalYearName: ctx.fiscalYearName,
    from: ctx.from,
    to: ctx.to,
  };
}

/* ─── Trial Balance ─── */

export async function getTrialBalance(query: ReportQuery = {}) {
  const ctx = await buildContext(query);
  const rows = ctx.accounts
    .map((account) => {
      const bal = getDrCr(ctx.balTo, account.code);
      const signed = bal.dr - bal.cr;
      // Place net on the side of the actual balance (handles contra / abnormal balances).
      const netDr = signed > 0 ? signed : 0;
      const netCr = signed < 0 ? -signed : 0;
      return {
        code: account.code,
        name: account.name,
        group: account.accountGroup ?? "Ungrouped",
        accountType: account.accountType,
        debit: moneyFromCents(netDr),
        credit: moneyFromCents(netCr),
        debitCents: netDr,
        creditCents: netCr,
        rawDebit: moneyFromCents(bal.dr),
        rawCredit: moneyFromCents(bal.cr),
      };
    })
    .filter((row) => row.debitCents > 0 || row.creditCents > 0);

  const groups = [...new Set(rows.map((r) => r.group))];
  const sections = groups.map((group) => {
    const items = rows.filter((r) => r.group === group);
    const debitCents = items.reduce((s, r) => s + r.debitCents, 0);
    const creditCents = items.reduce((s, r) => s + r.creditCents, 0);
    return {
      group,
      items: items.map((item) => ({
        code: item.code,
        name: item.name,
        group: item.group,
        accountType: item.accountType,
        debit: item.debit,
        credit: item.credit,
        rawDebit: item.rawDebit,
        rawCredit: item.rawCredit,
      })),
      subtotalDebit: moneyFromCents(debitCents),
      subtotalCredit: moneyFromCents(creditCents),
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debitCents, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditCents, 0);

  return serialize({
    ...reportHeader(ctx, "Trial Balance"),
    sections,
    totals: {
      debit: moneyFromCents(totalDebit),
      credit: moneyFromCents(totalCredit),
      balanced: totalDebit === totalCredit,
      difference: moneyFromCents(Math.abs(totalDebit - totalCredit)),
    },
  });
}

/* ─── Balance Sheet ─── */

export async function getBalanceSheet(query: ReportQuery = {}) {
  const ctx = await buildContext(query);
  const m = ctx.balTo;
  const a = ctx.accounts;

  const cash = nb(m, a, "1001") + nb(m, a, "1002") + nb(m, a, "1003");
  const debtors = nb(m, a, "1010");
  const stock = nb(m, a, "1020");
  const advPre = nb(m, a, "1030") + nb(m, a, "1040") + nb(m, a, "1050");
  const fa =
    nb(m, a, "1201") + nb(m, a, "1202") + nb(m, a, "1203") + nb(m, a, "1204");
  const accDep = creditNet(m, "1205");
  const netFA = fa - accDep;
  const currAssets = cash + debtors + stock + advPre;
  const totalAssets = netFA + currAssets;

  const creditors = creditNet(m, "2001");
  const accruals = creditNet(m, "2002");
  const staxP = creditNet(m, "2003");
  const itaxP = creditNet(m, "2004");
  const whtP = creditNet(m, "2005");
  const stLoans = creditNet(m, "2006");
  const ltLoan = creditNet(m, "2201");
  const capital = creditNet(m, "3001");
  const retOB = creditNet(m, "3002");
  const drawings = debitNet(m, "3003");

  const revT = a
    .filter((x) => x.accountType === "Revenue")
    .reduce((s, x) => {
      const bal = getDrCr(m, x.code);
      return s + (bal.cr - bal.dr);
    }, 0);
  const expT = a
    .filter((x) => x.accountType === "Expense")
    .reduce((s, x) => {
      const bal = getDrCr(m, x.code);
      return s + (bal.dr - bal.cr);
    }, 0);
  const netProfit = revT - expT;
  const retained = retOB + netProfit - drawings;
  const totalEquity = capital + retained;
  const currLiab = creditors + accruals + staxP + itaxP + whtP + stLoans;
  const totalLiabEq = totalEquity + ltLoan + currLiab;

  const line = (label: string, cents: number, opts?: { bold?: boolean; indent?: boolean }) => ({
    label,
    amount: moneyFromCents(cents),
    amountCents: cents,
    bold: opts?.bold ?? false,
    indent: opts?.indent ?? false,
  });

  return serialize({
    ...reportHeader(ctx, "Balance Sheet"),
    assets: {
      fixedGross: line("Tangible Fixed Assets (Gross)", fa, { indent: true }),
      accumDep: line("Less: Accumulated Depreciation", -accDep, { indent: true }),
      netFixed: line("Net Fixed Assets", netFA, { bold: true }),
      stock: line("Stock in Trade", stock, { indent: true }),
      debtors: line("Trade Debtors", debtors, { indent: true }),
      advances: line("Advances, Deposits & Prepayments", advPre, { indent: true }),
      cash: line("Cash & Bank Balances", cash, { indent: true }),
      currentTotal: line("Total Current Assets", currAssets, { bold: true }),
      total: line("TOTAL ASSETS", totalAssets, { bold: true }),
    },
    equityLiabilities: {
      capital: line("Owner's Capital", capital, { indent: true }),
      retained: line("Retained Earnings (incl. period P&L)", retained, { indent: true }),
      equityTotal: line("Total Equity", totalEquity, { bold: true }),
      longTerm: line("Long-term Financing", ltLoan, { indent: true }),
      creditors: line("Trade Creditors", creditors, { indent: true }),
      accruals: line("Accrued Liabilities", accruals, { indent: true }),
      taxes: line("Taxes & WHT Payable", staxP + itaxP + whtP, { indent: true }),
      shortLoans: line("Short-term Loans", stLoans, { indent: true }),
      currentTotal: line("Total Current Liabilities", currLiab, { bold: true }),
      total: line("TOTAL EQUITY & LIABILITIES", totalLiabEq, { bold: true }),
    },
    check: {
      balanced: totalAssets === totalLiabEq,
      difference: moneyFromCents(Math.abs(totalAssets - totalLiabEq)),
      netProfit: moneyFromCents(netProfit),
    },
  });
}

/* ─── Profit & Loss ─── */

function pBal(map: AccountBalanceMap, code: string): DrCrCents {
  return getDrCr(map, code);
}

export async function getProfitLoss(query: ReportQuery = {}) {
  const ctx = await buildContext(query);
  const p = ctx.period;

  const salesTax = pBal(p, "4001");
  const salesEx = pBal(p, "4002");
  const otherInc = pBal(p, "4003");
  const grossRev = salesTax.cr - salesTax.dr + (salesEx.cr - salesEx.dr);

  const openStk = pBal(p, "5001");
  const purchases = pBal(p, "5002");
  const closeStk = pBal(p, "5003");
  const openAmt = openStk.dr - openStk.cr;
  const purchAmt = purchases.dr - purchases.cr;
  const closeAmt = closeStk.cr - closeStk.dr;
  const cogs = Math.max(openAmt, 0) + Math.max(purchAmt, 0) - Math.max(closeAmt, 0);
  const grossProfit = grossRev - cogs;

  const salAmt = pBal(p, "6001").dr - pBal(p, "6001").cr;
  const rentAmt = pBal(p, "6002").dr - pBal(p, "6002").cr;
  const utilAmt = pBal(p, "6003").dr - pBal(p, "6003").cr;
  const transAmt = pBal(p, "6004").dr - pBal(p, "6004").cr;
  const adminAmt = pBal(p, "6005").dr - pBal(p, "6005").cr;
  const sellAmt = pBal(p, "6006").dr - pBal(p, "6006").cr;
  const depAmt = pBal(p, "6007").dr - pBal(p, "6007").cr;
  const totalOpex = salAmt + rentAmt + utilAmt + transAmt + adminAmt + sellAmt + depAmt;
  const ebit = grossProfit - totalOpex;
  const oInc = otherInc.cr - otherInc.dr;
  const finChg = debitNet(p, "7001") + debitNet(p, "7002");
  const pbt = ebit + oInc - finChg;
  const taxAmt = debitNet(p, "8001");
  const pat = pbt - taxAmt;

  const row = (label: string, cents: number, opts?: { bold?: boolean; indent?: boolean; header?: boolean }) => ({
    label,
    amount: opts?.header ? null : moneyFromCents(cents),
    amountCents: opts?.header ? null : cents,
    bold: opts?.bold ?? false,
    indent: opts?.indent ?? false,
    header: opts?.header ?? false,
  });

  return serialize({
    ...reportHeader(ctx, "Profit & Loss"),
    lines: [
      row("Net Revenue / Turnover", grossRev, { bold: true }),
      row("Less: Cost of Goods Sold", 0, { header: true }),
      row("Opening Stock", openAmt, { indent: true }),
      row("Add: Purchases", purchAmt, { indent: true }),
      row("Less: Closing Stock", -closeAmt, { indent: true }),
      row("Total Cost of Goods Sold", cogs, { bold: true }),
      row("GROSS PROFIT", grossProfit, { bold: true }),
      row("Operating Expenses", 0, { header: true }),
      row("Salaries & Wages", salAmt, { indent: true }),
      row("Rent Expense", rentAmt, { indent: true }),
      row("Utility Bills", utilAmt, { indent: true }),
      row("Transport", transAmt, { indent: true }),
      row("Administrative Expenses", adminAmt, { indent: true }),
      row("Selling & Distribution", sellAmt, { indent: true }),
      row("Depreciation", depAmt, { indent: true }),
      row("Total Operating Expenses", totalOpex, { bold: true }),
      row("OPERATING PROFIT (EBIT)", ebit, { bold: true }),
      row("Add: Other Income", oInc, { indent: true }),
      row("Less: Financial Charges", -finChg, { indent: true }),
      row("PROFIT BEFORE TAXATION", pbt, { bold: true }),
      row("Less: Income Tax (Current)", -taxAmt, { indent: true }),
      row("PROFIT AFTER TAXATION", pat, { bold: true }),
    ],
    totals: {
      grossRevenue: moneyFromCents(grossRev),
      cogs: moneyFromCents(cogs),
      grossProfit: moneyFromCents(grossProfit),
      operatingProfit: moneyFromCents(ebit),
      profitBeforeTax: moneyFromCents(pbt),
      profitAfterTax: moneyFromCents(pat),
    },
  });
}

/* ─── Cash Flow ─── */

export async function getCashFlow(query: ReportQuery = {}) {
  const ctx = await buildContext(query);
  const p = ctx.period;
  const pp = ctx.prev;

  const depAmt = pBal(p, "6007").dr - pBal(p, "6007").cr;
  const grossRev =
    pBal(p, "4001").cr -
    pBal(p, "4001").dr +
    (pBal(p, "4002").cr - pBal(p, "4002").dr) +
    (pBal(p, "4003").cr - pBal(p, "4003").dr);

  const opExpPaid =
    debitNet(p, "5002") +
    debitNet(p, "6001") +
    debitNet(p, "6002") +
    debitNet(p, "6003") +
    debitNet(p, "6004") +
    debitNet(p, "6005") +
    debitNet(p, "6006");
  const taxPaid = debitNet(p, "8001");
  const netOp = grossRev - opExpPaid + depAmt - taxPaid;

  const faAdds = debitNet(p, "1201") + debitNet(p, "1202");
  const faDisp = creditNet(p, "1201") + creditNet(p, "1202");
  const netInv = faDisp - faAdds;

  const ltLoanPrc = creditNet(p, "2201");
  const ltLoanRep = debitNet(p, "2201");
  const capIntro = creditNet(p, "3001");
  const drawings = debitNet(p, "3003");
  const netFin = ltLoanPrc - ltLoanRep + capIntro - drawings;
  const netChg = netOp + netInv + netFin;

  const openCash =
    pBal(pp, "1001").dr -
    pBal(pp, "1001").cr +
    (pBal(pp, "1002").dr - pBal(pp, "1002").cr) +
    (pBal(pp, "1003").dr - pBal(pp, "1003").cr);
  const closeCash = openCash + netChg;

  const row = (label: string, cents: number, opts?: { bold?: boolean; indent?: boolean; header?: boolean }) => ({
    label,
    amount: opts?.header ? null : moneyFromCents(cents),
    amountCents: opts?.header ? null : cents,
    bold: opts?.bold ?? false,
    indent: opts?.indent ?? false,
    header: opts?.header ?? false,
  });

  return serialize({
    ...reportHeader(ctx, "Cash Flow"),
    lines: [
      row("A. Cash Flows from Operating Activities", 0, { header: true }),
      row("Cash receipts from customers & revenue", grossRev, { indent: true }),
      row("Cash paid to suppliers & employees", -opExpPaid, { indent: true }),
      row("Add back: Depreciation (non-cash)", depAmt, { indent: true }),
      row("Income tax paid", -taxPaid, { indent: true }),
      row("Net Cash from Operating Activities", netOp, { bold: true }),
      row("B. Cash Flows from Investing Activities", 0, { header: true }),
      row("Purchase of fixed assets", -faAdds, { indent: true }),
      row("Proceeds from disposal of assets", faDisp, { indent: true }),
      row("Net Cash from Investing Activities", netInv, { bold: true }),
      row("C. Cash Flows from Financing Activities", 0, { header: true }),
      row("Proceeds from long-term financing", ltLoanPrc, { indent: true }),
      row("Repayment of long-term financing", -ltLoanRep, { indent: true }),
      row("Capital introduced by owner", capIntro, { indent: true }),
      row("Drawings by owner", -drawings, { indent: true }),
      row("Net Cash from Financing Activities", netFin, { bold: true }),
      row("Net Increase / (Decrease) in Cash & Bank", netChg, { bold: true }),
      row("Opening Cash & Bank", openCash, { indent: true }),
      row("Closing Cash & Bank", closeCash, { bold: true }),
    ],
    totals: {
      operating: moneyFromCents(netOp),
      investing: moneyFromCents(netInv),
      financing: moneyFromCents(netFin),
      netChange: moneyFromCents(netChg),
      openingCash: moneyFromCents(openCash),
      closingCash: moneyFromCents(closeCash),
    },
  });
}

/* ─── Aging ─── */

type AgingParty = {
  name: string;
  ntn: string | null;
  outstandingDays: number;
  amountCents: number;
  whtStatus?: "Deducted" | "Pending" | null;
};

function ageBuckets(days: number, amountCents: number) {
  return {
    c0: days <= 30 ? amountCents : 0,
    c31: days > 30 && days <= 60 ? amountCents : 0,
    c61: days > 60 && days <= 90 ? amountCents : 0,
    c91: days > 90 && days <= 120 ? amountCents : 0,
    c120: days > 120 ? amountCents : 0,
  };
}

async function deriveAgingParties(
  kind: "debtors" | "creditors",
  asOf: string,
): Promise<AgingParty[]> {
  const prisma = getPrisma();
  const company = await getPrimaryCompanyWithFiscalYear();
  if (!company) throw new Error("No company found.");
  const companyId = BigInt(company.company.id);

  // Prefer party master outstanding rows (Phase 9).
  const master = await prisma.party.findMany({
    where: {
      companyId,
      isActive: true,
      OR:
        kind === "debtors"
          ? [{ partyType: "Debtor" }, { partyType: "Both" }]
          : [{ partyType: "Creditor" }, { partyType: "Both" }],
      outstandingAmount: { gt: 0 },
    },
    orderBy: { name: "asc" },
  });

  if (master.length > 0) {
    return master.map((p) => ({
      name: p.name,
      ntn: p.ntn,
      outstandingDays: p.outstandingDays ?? 0,
      amountCents: toCents(p.outstandingAmount?.toString() ?? "0") ?? 0,
      whtStatus:
        kind === "creditors"
          ? ((p.whtStatus as "Deducted" | "Pending" | null) ?? "Pending")
          : null,
    }));
  }

  const code = kind === "debtors" ? "1010" : "2001";
  const asOfDate = parseIsoDate(asOf);
  if (!asOfDate) throw new Error("Invalid as-of date.");

  const lines = await prisma.voucherLine.findMany({
    where: {
      account: { companyId, code },
      voucher: { companyId, status: "POSTED", voucherDate: { lte: asOfDate } },
    },
    include: {
      voucher: {
        select: {
          voucherDate: true,
          partyName: true,
          voucherNo: true,
          lines: {
            include: { account: { select: { code: true } } },
          },
        },
      },
    },
  });

  type Acc = {
    name: string;
    ntn: string | null;
    amountCents: number;
    oldestDate: string;
    whtStatus: "Deducted" | "Pending" | null;
  };
  const byParty = new Map<string, Acc>();

  for (const line of lines) {
    const party = (line.voucher.partyName ?? "Unknown").trim() || "Unknown";
    const debit = toCents(line.debit.toString()) ?? 0;
    const credit = toCents(line.credit.toString()) ?? 0;
    const delta = kind === "debtors" ? debit - credit : credit - debit;
    const date = line.voucher.voucherDate.toISOString().slice(0, 10);
    const hasWht = line.voucher.lines.some((l) => l.account.code === "2005");

    const current = byParty.get(party) ?? {
      name: party,
      ntn: null,
      amountCents: 0,
      oldestDate: date,
      whtStatus: kind === "creditors" ? (hasWht ? "Deducted" : "Pending") : null,
    };
    current.amountCents += delta;
    if (date < current.oldestDate) current.oldestDate = date;
    if (kind === "creditors" && hasWht) current.whtStatus = "Deducted";
    byParty.set(party, current);
  }

  return [...byParty.values()]
    .filter((p) => p.amountCents > 0)
    .map((p) => ({
      name: p.name,
      ntn: p.ntn,
      outstandingDays: daysBetween(p.oldestDate, asOf),
      amountCents: p.amountCents,
      whtStatus: p.whtStatus,
    }));
}

function buildAgingPayload(
  ctx: ReportContext,
  title: string,
  parties: AgingParty[],
  includeWht: boolean,
) {
  const rows = parties
    .map((p) => {
      const buckets = ageBuckets(p.outstandingDays, p.amountCents);
      return {
        name: p.name,
        ntn: p.ntn,
        outstandingDays: p.outstandingDays,
        amount: moneyFromCents(p.amountCents),
        amountCents: p.amountCents,
        buckets: {
          current: moneyFromCents(buckets.c0),
          d31: moneyFromCents(buckets.c31),
          d61: moneyFromCents(buckets.c61),
          d91: moneyFromCents(buckets.c91),
          d120: moneyFromCents(buckets.c120),
        },
        bucketCents: buckets,
        whtStatus: p.whtStatus ?? null,
      };
    })
    .sort((a, b) => b.outstandingDays - a.outstandingDays);

  const totals = rows.reduce(
    (s, r) => ({
      total: s.total + r.amountCents,
      c0: s.c0 + r.bucketCents.c0,
      c31: s.c31 + r.bucketCents.c31,
      c61: s.c61 + r.bucketCents.c61,
      c91: s.c91 + r.bucketCents.c91,
      c120: s.c120 + r.bucketCents.c120,
    }),
    { total: 0, c0: 0, c31: 0, c61: 0, c91: 0, c120: 0 },
  );

  const whtPendingCents = includeWht
    ? rows
        .filter((r) => r.whtStatus === "Pending")
        .reduce((s, r) => s + r.amountCents, 0)
    : 0;

  return serialize({
    ...reportHeader(ctx, title),
    parties: rows.map((row) => ({
      name: row.name,
      ntn: row.ntn,
      outstandingDays: row.outstandingDays,
      amount: row.amount,
      buckets: row.buckets,
      whtStatus: row.whtStatus,
    })),
    totals: {
      total: moneyFromCents(totals.total),
      current: moneyFromCents(totals.c0),
      d31: moneyFromCents(totals.c31),
      d61: moneyFromCents(totals.c61),
      d91: moneyFromCents(totals.c91),
      d120: moneyFromCents(totals.c120),
      over90: moneyFromCents(totals.c91 + totals.c120),
    },
    whtPending: includeWht ? moneyFromCents(whtPendingCents) : null,
  });
}

export async function getDebtorsAging(query: ReportQuery = {}) {
  const ctx = await buildContext(query);
  const parties = await deriveAgingParties("debtors", ctx.to);
  return buildAgingPayload(ctx, "Debtors Aging", parties, false);
}

export async function getCreditorsAging(query: ReportQuery = {}) {
  const ctx = await buildContext(query);
  const parties = await deriveAgingParties("creditors", ctx.to);
  return buildAgingPayload(ctx, "Creditors Aging", parties, true);
}

export async function getReport(type: ReportType, query: ReportQuery = {}) {
  switch (type) {
    case "trial-balance":
      return getTrialBalance(query);
    case "balance-sheet":
      return getBalanceSheet(query);
    case "profit-loss":
      return getProfitLoss(query);
    case "cash-flow":
      return getCashFlow(query);
    case "debtors-aging":
      return getDebtorsAging(query);
    case "creditors-aging":
      return getCreditorsAging(query);
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}
