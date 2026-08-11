import { NextResponse } from "next/server";

import { getJournal } from "@/lib/journal/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getJournal({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      voucherType: searchParams.get("type") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load journal.";
    console.error("GET /api/journal", error);
    const status = message.includes("Invalid") || message.includes("must be") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
