import { NextResponse } from "next/server";

import { cancelVoucher } from "@/lib/vouchers/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const voucher = await cancelVoucher(id);
    return NextResponse.json({ voucher });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel voucher.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only posted")
        ? 400
        : 500;
    console.error("POST /api/vouchers/[id]/cancel", error);
    return NextResponse.json({ error: message }, { status });
  }
}
