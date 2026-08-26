import { NextResponse } from "next/server";

import { authErrorResponse, requireSession } from "@/lib/auth/request";
import { ensurePartyDebtorAccount } from "@/lib/parties/service";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    await requireSession();
    const { id } = await params;
    const data = await ensurePartyDebtorAccount(id);
    return NextResponse.json(data);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message =
      error instanceof Error ? error.message : "Failed to ensure debtor account.";
    console.error("POST /api/parties/[id]/debtor-account", error);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("only created")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
