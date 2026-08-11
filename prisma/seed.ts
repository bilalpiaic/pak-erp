import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  SEED_ACCOUNTS,
  SEED_COMPANY,
  SEED_FISCAL_YEAR,
  SEED_PARTIES,
  SEED_VOUCHERS,
} from "./seed-data";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    console.log("Seeding GarmentLoop ERP…");

    // Clear in dependency order for idempotent re-seed.
    await prisma.auditLog.deleteMany();
    await prisma.voucherLine.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.party.deleteMany();
    await prisma.account.deleteMany();
    await prisma.fiscalYear.deleteMany();
    await prisma.company.deleteMany();

    const company = await prisma.company.create({
      data: SEED_COMPANY,
    });

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

    await prisma.party.createMany({
      data: SEED_PARTIES.map((party) => ({
        companyId: company.id,
        name: party.name,
        ntn: party.ntn,
        partyType: party.partyType,
        outstandingDays: party.outstandingDays,
        outstandingAmount: party.outstandingAmount,
        whtStatus: party.whtStatus,
        isActive: true,
      })),
    });

    const parties = await prisma.party.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true, ntn: true },
    });
    const partyByName = new Map(parties.map((p) => [p.name, p]));

    const accounts = await prisma.account.findMany({
      where: { companyId: company.id },
      select: { id: true, code: true },
    });
    const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));

    for (const voucher of SEED_VOUCHERS) {
      const lines = voucher.lines.map((line) => {
        const accountId = accountIdByCode.get(line.accountCode);
        if (!accountId) {
          throw new Error(`Unknown account code in seed: ${line.accountCode}`);
        }
        return {
          accountId,
          lineNarration: line.lineNarration,
          debit: line.debit,
          credit: line.credit,
        };
      });

      const party = voucher.partyName ? partyByName.get(voucher.partyName) : null;
      const whtApplicable = voucher.lines.some((l) => l.accountCode === "2005");

      const created = await prisma.voucher.create({
        data: {
          companyId: company.id,
          voucherNo: voucher.voucherNo,
          voucherType: voucher.voucherType,
          voucherDate: new Date(voucher.voucherDate),
          referenceNo: voucher.referenceNo,
          partyId: party?.id ?? null,
          partyName: voucher.partyName,
          partyNtn: party?.ntn ?? null,
          whtApplicable,
          narration: voucher.narration,
          status: voucher.status,
          createdBy: "seed",
          postedBy: voucher.status === "POSTED" ? "seed" : null,
          postedAt: voucher.status === "POSTED" ? new Date(voucher.voucherDate) : null,
          lines: {
            create: lines,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId: company.id,
          actor: "seed",
          action: voucher.status === "POSTED" ? "POST" : "CREATE",
          entity: "Voucher",
          recordId: created.id.toString(),
          newValue: {
            voucherNo: voucher.voucherNo,
            status: voucher.status,
          },
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        actor: "seed",
        action: "CREATE",
        entity: "Company",
        recordId: company.id.toString(),
        newValue: { name: company.name },
      },
    });

    const counts = {
      companies: await prisma.company.count(),
      fiscalYears: await prisma.fiscalYear.count(),
      accounts: await prisma.account.count(),
      parties: await prisma.party.count(),
      vouchers: await prisma.voucher.count(),
      voucherLines: await prisma.voucherLine.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log("Seed complete:", counts);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
