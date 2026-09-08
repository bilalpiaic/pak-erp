import { NextResponse } from "next/server";

import { getStockValuation } from "@/lib/stock/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getStockValuation(searchParams.get("asOf")?.trim() || undefined);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load stock valuation.";
    console.error("GET /api/stock/valuation", error);
    const status = message.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
