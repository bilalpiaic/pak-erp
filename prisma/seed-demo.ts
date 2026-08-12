import type { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { SEED_ACCOUNTS, SEED_FISCAL_YEAR } from "./seed-data";

export const DEMO_COMPANY = {
  name: "GarmentLoop Demo Apparel",
  ntn: "1234567-8",
  strn: "32-77-1234-567-89",
  address: "Plot 42, Industrial Estate, Faisalabad, Pakistan",
  phone: "+92-41-8500123",
  email: "demo@garmentloop.example",
  currency: "PKR",
  fiscalYearStart: 7,
  isDemo: true,
};

export const DEMO_USER = {
  username: "demo",
  password: "demo1234",
  displayName: "Demo Viewer",
  role: "USER" as const,
  isActive: true,
  isDemo: true,
};

type DemoPartySeed = {
  name: string;
  ntn?: string;
  partyType: "Debtor" | "Creditor" | "Both";
  phone?: string;
  outstandingDays?: number;
  outstandingAmount: string;
  whtStatus?: string;
};

const DEMO_PARTIES: DemoPartySeed[] = [
  {
    name: "Horizon Textiles Ltd",
    ntn: "2901456-1",
    partyType: "Debtor",
    phone: "+92-42-111-222",
    outstandingDays: 28,
    outstandingAmount: "450000.00",
    whtStatus: "Pending",
  },
  {
    name: "Silk Road Retail",
    ntn: "3344556-2",
    partyType: "Debtor",
    phone: "+92-21-333-444",
    outstandingDays: 12,
    outstandingAmount: "275000.00",
  },
  {
    name: "Cotton Mills Supply Co",
    ntn: "1122334-5",
    partyType: "Creditor",
    phone: "+92-41-555-666",
    outstandingDays: 35,
    outstandingAmount: "320000.00",
    whtStatus: "Deducted",
  },
  {
    name: "Thread & Trim Traders",
    ntn: "7788990-3",
    partyType: "Creditor",
    phone: "+92-42-777-888",
    outstandingDays: 18,
    outstandingAmount: "98000.00",
  },
  {
    name: "Export Hub Pvt Ltd",
    ntn: "5566778-9",
    partyType: "Both",
    phone: "+92-51-999-000",
    outstandingDays: 45,
    outstandingAmount: "610000.00",
    whtStatus: "Pending",
  },
];

/**
 * Wipe only the demo tenant (isDemo=true) and recreate marketing sample data.
 * Live company rows are never touched.
 */
export async function seedDemoTenant(prisma: PrismaClient): Promise<{
  companyId: string;
  parties: number;
  vouchers: number;
  salesInvoices: number;
}> {
  const existingDemo = await prisma.company.findMany({
    where: { isDemo: true },
    select: { id: true },
  });
  const demoIds = existingDemo.map((c) => c.id);

  if (demoIds.length) {
    await prisma.auditLog.deleteMany({ where: { companyId: { in: demoIds } } });
    await prisma.voucherAttachment.deleteMany({
      where: { voucher: { companyId: { in: demoIds } } },
    });
    await prisma.voucherLine.deleteMany({
      where: { voucher: { companyId: { in: demoIds } } },
    });
    await prisma.salesInvoiceLine.deleteMany({
      where: { salesInvoice: { companyId: { in: demoIds } } },
    });
    await prisma.salesInvoice.deleteMany({ where: { companyId: { in: demoIds } } });
    await prisma.voucher.deleteMany({ where: { companyId: { in: demoIds } } });
    await prisma.party.deleteMany({ where: { companyId: { in: demoIds } } });
    await prisma.account.deleteMany({ where: { companyId: { in: demoIds } } });
    await prisma.fiscalYear.deleteMany({ where: { companyId: { in: demoIds } } });
    await prisma.company.deleteMany({ where: { id: { in: demoIds } } });
  }

  await prisma.user.deleteMany({ where: { isDemo: true } });

  const company = await prisma.company.create({ data: DEMO_COMPANY });

  await prisma.fiscalYear.create({
    data: {
      companyId: company.id,
      ...SEED_FISCAL_YEAR,
    },
  });

  await prisma.account.createMany({
    data: SEED_ACCOUNTS.map((account) => ({
      companyId: company.id,
      ...account,
    })),
  });

  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    select: { id: true, code: true },
  });
  const byCode = Object.fromEntries(accounts.map((a) => [a.code, a.id]));

  const partyRows = [];
  for (const p of DEMO_PARTIES) {
    partyRows.push(
      await prisma.party.create({
        data: {
          companyId: company.id,
          name: p.name,
          ntn: p.ntn ?? null,
          partyType: p.partyType,
          phone: p.phone ?? null,
          isActive: true,
          outstandingDays: p.outstandingDays ?? null,
          outstandingAmount: p.outstandingAmount,
          whtStatus: p.whtStatus ?? null,
        },
      }),
    );
  }

  const cash = byCode["1001"];
  const bank = byCode["1002"];
  const debtors = byCode["1010"];
  const creditors = byCode["2001"];
  const capital = byCode["3001"];
  const sales = byCode["4001"];
  const purchases = byCode["5002"];
  const salaries = byCode["6001"];
  const rent = byCode["6002"];

  // Opening capital JV
  const jv1 = await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "JV-2024-0001",
      voucherType: "JV",
      voucherDate: new Date("2024-07-01"),
      narration: "Opening capital introduced (demo)",
      status: "POSTED",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-07-01T10:00:00Z"),
      lines: {
        create: [
          { accountId: bank, debit: "2500000.00", credit: "0.00", lineNarration: "Bank opening" },
          { accountId: cash, debit: "150000.00", credit: "0.00", lineNarration: "Cash opening" },
          { accountId: capital, debit: "0.00", credit: "2650000.00", lineNarration: "Owner capital" },
        ],
      },
    },
  });

  // Purchase on credit
  const debtor = partyRows[0]!;
  const creditor = partyRows[2]!;

  await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "JV-2024-0002",
      voucherType: "JV",
      voucherDate: new Date("2024-07-15"),
      partyId: creditor.id,
      partyName: creditor.name,
      partyNtn: creditor.ntn,
      narration: "Fabric purchase on credit (demo)",
      status: "POSTED",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-07-15T11:00:00Z"),
      lines: {
        create: [
          { accountId: purchases, debit: "850000.00", credit: "0.00", lineNarration: "Greige fabric" },
          {
            accountId: creditors,
            debit: "0.00",
            credit: "850000.00",
            lineNarration: "Payable to supplier",
          },
        ],
      },
    },
  });

  // Bank payment to creditor
  await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "BPV-2024-0001",
      voucherType: "BPV",
      voucherDate: new Date("2024-08-05"),
      partyId: creditor.id,
      partyName: creditor.name,
      partyNtn: creditor.ntn,
      narration: "Partial payment to supplier (demo)",
      status: "POSTED",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-08-05T09:30:00Z"),
      lines: {
        create: [
          { accountId: creditors, debit: "530000.00", credit: "0.00", lineNarration: "Settle payable" },
          { accountId: bank, debit: "0.00", credit: "530000.00", lineNarration: "HBL payment" },
        ],
      },
    },
  });

  // Sales invoice + SI voucher
  const siVoucher = await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "SI-2024-0001",
      voucherType: "SI",
      voucherDate: new Date("2024-08-20"),
      partyId: debtor.id,
      partyName: debtor.name,
      partyNtn: debtor.ntn,
      narration: "Ready-made garment sale (demo)",
      status: "POSTED",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-08-20T14:00:00Z"),
      lines: {
        create: [
          { accountId: debtors, debit: "725000.00", credit: "0.00", lineNarration: "Trade receivable" },
          { accountId: sales, debit: "0.00", credit: "725000.00", lineNarration: "Taxable sales" },
        ],
      },
    },
  });

  await prisma.salesInvoice.create({
    data: {
      companyId: company.id,
      voucherId: siVoucher.id,
      invoiceNo: "SI-2024-0001",
      invoiceDate: new Date("2024-08-20"),
      partyId: debtor.id,
      partyName: debtor.name,
      partyNtn: debtor.ntn,
      poNumber: "PO-HOR-884",
      narration: "Men's denim lot — demo invoice",
      status: "POSTED",
      totalAmount: "725000.00",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-08-20T14:00:00Z"),
      lines: {
        create: [
          {
            lineNo: 1,
            item: "Denim Jeans — Slim Fit",
            detail: "Size assortment M/L/XL",
            quantity: "500.0000",
            rate: "950.0000",
            amount: "475000.00",
          },
          {
            lineNo: 2,
            item: "Chino Trousers",
            detail: "Khaki / Navy mix",
            quantity: "250.0000",
            rate: "1000.0000",
            amount: "250000.00",
          },
        ],
      },
    },
  });

  // Bank receipt from debtor
  await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "BRV-2024-0001",
      voucherType: "BRV",
      voucherDate: new Date("2024-09-02"),
      partyId: debtor.id,
      partyName: debtor.name,
      partyNtn: debtor.ntn,
      narration: "Collection against SI-2024-0001 (demo)",
      status: "POSTED",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-09-02T10:15:00Z"),
      lines: {
        create: [
          { accountId: bank, debit: "400000.00", credit: "0.00", lineNarration: "HBL receipt" },
          { accountId: debtors, debit: "0.00", credit: "400000.00", lineNarration: "Reduce receivable" },
        ],
      },
    },
  });

  // Operating expenses
  await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "CPV-2024-0001",
      voucherType: "CPV",
      voucherDate: new Date("2024-09-10"),
      narration: "Factory salaries & rent (demo)",
      status: "POSTED",
      createdBy: "demo",
      postedBy: "demo",
      postedAt: new Date("2024-09-10T16:00:00Z"),
      lines: {
        create: [
          { accountId: salaries, debit: "185000.00", credit: "0.00", lineNarration: "Payroll" },
          { accountId: rent, debit: "95000.00", credit: "0.00", lineNarration: "Unit rent" },
          { accountId: cash, debit: "0.00", credit: "280000.00", lineNarration: "Cash paid" },
        ],
      },
    },
  });

  // Draft voucher (shows in lists)
  await prisma.voucher.create({
    data: {
      companyId: company.id,
      voucherNo: "JV-2024-0003",
      voucherType: "JV",
      voucherDate: new Date("2024-09-18"),
      narration: "Draft adjustment — marketing sample",
      status: "DRAFT",
      createdBy: "demo",
      lines: {
        create: [
          { accountId: rent, debit: "10000.00", credit: "0.00", lineNarration: "Accrue rent" },
          { accountId: creditors, debit: "0.00", credit: "10000.00", lineNarration: "Accrued payable" },
        ],
      },
    },
  });

  await prisma.user.create({
    data: {
      username: DEMO_USER.username,
      passwordHash: hashPassword(DEMO_USER.password),
      displayName: DEMO_USER.displayName,
      role: DEMO_USER.role,
      isActive: DEMO_USER.isActive,
      isDemo: true,
    },
  });

  void jv1;

  return {
    companyId: company.id.toString(),
    parties: await prisma.party.count({ where: { companyId: company.id } }),
    vouchers: await prisma.voucher.count({ where: { companyId: company.id } }),
    salesInvoices: await prisma.salesInvoice.count({ where: { companyId: company.id } }),
  };
}
