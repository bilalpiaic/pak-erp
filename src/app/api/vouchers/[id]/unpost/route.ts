import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";
import { unpostVoucher } from "@/lib/vouchers/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const voucher = await unpostVoucher(id, actorName(session));
    return NextResponse.json({ voucher });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to unpost voucher.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only posted") || message.includes("Sales invoices")
        ? 400
        : 500;
    console.error("POST /api/vouchers/[id]/unpost", error);
    return NextResponse.json({ error: message }, { status });
  }
}
