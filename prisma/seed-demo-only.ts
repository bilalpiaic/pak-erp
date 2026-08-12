/**
 * Safe demo-only reseed for production/Neon.
 * Does NOT wipe live company data — only refreshes isDemo tenants + demo user.
 *
 *   npx tsx prisma/seed-demo-only.ts
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEMO_USER, seedDemoTenant } from "./seed-demo";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString, ssl: process.env.DATABASE_SSL === "0" ? undefined : undefined });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const result = await seedDemoTenant(prisma);
    console.log("Demo tenant refreshed:", result);
    console.log(`Demo login: ${DEMO_USER.username} / ${DEMO_USER.password}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
