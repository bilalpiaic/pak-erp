import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_ACCOUNTS, SEED_COMPANY, SEED_FISCAL_YEAR } from "./seed-data";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    console.log("Seeding GarmentLoop ERP (COA only — no demo parties/vouchers)…");

    // Clear in dependency order for idempotent re-seed.
    await prisma.auditLog.deleteMany();
    await prisma.voucherAttachment.deleteMany();
    await prisma.voucherLine.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.party.deleteMany();
    await prisma.account.deleteMany();
    await prisma.fiscalYear.deleteMany();
    await prisma.company.deleteMany();

    const company = await prisma.company.create({
      data: {
        ...SEED_COMPANY,
        // Neutral shell company — not demo trading data
        name: "My Company",
        address: null,
        ntn: null,
        strn: null,
        phone: null,
        email: null,
      },
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
