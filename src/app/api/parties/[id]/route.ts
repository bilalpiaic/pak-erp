import { NextResponse } from "next/server";

import { getParty, setPartyActive, updateParty } from "@/lib/parties/service";
import type { PartyInput } from "@/lib/parties/types";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const party = await getParty(id);
    if (!party) return NextResponse.json({ error: "Party not found." }, { status: 404 });
    return NextResponse.json({ party });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load party.";
    console.error("GET /api/parties/[id]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = (await request.json()) as PartyInput & { isActive?: boolean; toggleActive?: boolean };

    if (body.toggleActive === true || (body.isActive !== undefined && Object.keys(body).length === 1)) {
      const existing = await getParty(id);
      if (!existing) return NextResponse.json({ error: "Party not found." }, { status: 404 });
      const party = await setPartyActive(id, body.isActive ?? !existing.isActive);
      return NextResponse.json({ party });
    }

    const party = await updateParty(id, body);
    return NextResponse.json({ party });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update party.";
    console.error("PATCH /api/parties/[id]", error);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("required") ||
            message.includes("Invalid") ||
            message.includes("already exists") ||
            message.includes("must be")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
