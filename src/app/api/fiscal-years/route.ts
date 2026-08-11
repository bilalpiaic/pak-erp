import { NextResponse } from "next/server";

import {
  createNextFiscalYear,
  getActiveFiscalYear,
  listFiscalYears,
} from "@/lib/fiscal-years/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [fiscalYears, active] = await Promise.all([
      listFiscalYears(),
      getActiveFiscalYear(),
    ]);
    return NextResponse.json({
      fiscalYears,
      activeFiscalYearId: active?.id ?? null,
      activeFiscalYear: active,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load fiscal years.";
    const status = message.includes("No company") ? 404 : 500;
    console.error("GET /api/fiscal-years", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST() {
  try {
    const fiscalYear = await createNextFiscalYear();
    return NextResponse.json({ fiscalYear }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create fiscal year.";
    const status = message.includes("already exists")
      ? 409
      : message.includes("No company")
        ? 404
        : 500;
    console.error("POST /api/fiscal-years", error);
    return NextResponse.json({ error: message }, { status });
  }
}
