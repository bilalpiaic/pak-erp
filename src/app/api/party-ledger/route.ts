import { NextResponse } from "next/server";

import {
  getPartyLedger,
  type PartyLedgerKind,
} from "@/lib/party-ledger/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");
    if (!partyId) {
      return NextResponse.json({ error: "partyId is required." }, { status: 400 });
    }

    const kindParam = searchParams.get("kind");
    const kind =
      kindParam === "debtor" || kindParam === "creditor"
        ? (kindParam as PartyLedgerKind)
        : undefined;

    const data = await getPartyLedger({
      partyId,
      kind,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load party ledger.";
    console.error("GET /api/party-ledger", error);
    const status =
      message.includes("required") ||
      message.includes("Invalid") ||
      message.includes("must be") ||
      message.includes("not found") ||
      message.includes("Debtor") ||
      message.includes("Creditor")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
