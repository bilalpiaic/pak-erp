import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireSession } from "@/lib/auth/request";
import {
  createAndPostStockAdjustment,
  createDraftStockAdjustment,
  listStockAdjustments,
  nextStockAdjustmentNo,
} from "@/lib/stock-adjustments/service";
import type {
  StockAdjustmentInput,
  StockAdjustmentListQuery,
} from "@/lib/stock-adjustments/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("nextNumber") === "1" || searchParams.get("nextNumber") === "true") {
      const adjustmentNo = await nextStockAdjustmentNo();
      return NextResponse.json({ adjustmentNo });
    }
    const query: StockAdjustmentListQuery = {
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      reason: searchParams.get("reason") ?? undefined,
    };
    const data = await listStockAdjustments(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list stock adjustments.";
    console.error("GET /api/stock-adjustments", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const actor = actorName(session);
    const body = (await request.json()) as StockAdjustmentInput & { post?: boolean };
    const adjustment = body.post
      ? await createAndPostStockAdjustment(body, actor)
      : await createDraftStockAdjustment(body, actor);
    return NextResponse.json({ adjustment }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to create stock adjustment.";
    const status =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("Insufficient") ||
      message.includes("later")
        ? 400
        : 500;
    console.error("POST /api/stock-adjustments", error);
    return NextResponse.json({ error: message }, { status });
  }
}
