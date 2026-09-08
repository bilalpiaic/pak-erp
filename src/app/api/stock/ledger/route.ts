import { NextResponse } from "next/server";

import { getStockLedger } from "@/lib/stock/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getStockLedger({
      itemId: searchParams.get("itemId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load stock ledger.";
    console.error("GET /api/stock/ledger", error);
    const status = message.includes("Invalid") || message.includes("No items") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
