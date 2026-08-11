import { NextResponse } from "next/server";

import { createParty, listParties } from "@/lib/parties/service";
import type { PartyInput, PartyListQuery } from "@/lib/parties/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query: PartyListQuery = {
      search: searchParams.get("search") ?? undefined,
      partyType: searchParams.get("type") ?? undefined,
      active: (searchParams.get("active") as PartyListQuery["active"]) ?? "all",
    };
    const data = await listParties(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list parties.";
    console.error("GET /api/parties", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PartyInput;
    const party = await createParty(body);
    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create party.";
    console.error("POST /api/parties", error);
    const status =
      message.includes("required") ||
      message.includes("Invalid") ||
      message.includes("already exists") ||
      message.includes("must be")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
