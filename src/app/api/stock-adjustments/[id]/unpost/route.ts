import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";
import { unpostStockAdjustment } from "@/lib/stock-adjustments/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const adjustment = await unpostStockAdjustment(id, actorName(session));
    return NextResponse.json({ adjustment });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to unpost stock adjustment.";
    const status = message.includes("not found") ? 404 : message.includes("Only posted") ? 400 : 500;
    console.error("POST /api/stock-adjustments/[id]/unpost", error);
    return NextResponse.json({ error: message }, { status });
  }
}
