import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    const [companies, accounts, vouchers] = await Promise.all([
      prisma.company.count(),
      prisma.account.count(),
      prisma.voucher.count(),
    ]);

    return NextResponse.json({
      ok: true,
      database: "up",
      counts: { companies, accounts, vouchers },
    });
  } catch (error) {
    console.error("GET /api/health", error);
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        error: error instanceof Error ? error.message : "Database unavailable",
      },
      { status: 503 },
    );
  }
}
