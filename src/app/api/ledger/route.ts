import { NextResponse } from "next/server";

import { getLedger, listLedgerAccounts } from "@/lib/ledger/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("accounts") === "1") {
      const accounts = await listLedgerAccounts();
      return NextResponse.json({ accounts });
    }

    const data = await getLedger({
      accountCode: searchParams.get("account") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load ledger.";
    console.error("GET /api/ledger", error);
    const status =
      message.includes("Invalid") ||
      message.includes("must be") ||
      message.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
