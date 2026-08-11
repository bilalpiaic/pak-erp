import { NextResponse } from "next/server";

import { postVoucher } from "@/lib/vouchers/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const voucher = await postVoucher(id);
    return NextResponse.json({ voucher });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post voucher.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft") ||
          message.includes("not balanced") ||
          message.includes("Inactive") ||
          message.includes("required") ||
          message.includes("zero-value")
        ? 400
        : 500;
    console.error("POST /api/vouchers/[id]/post", error);
    return NextResponse.json({ error: message }, { status });
  }
}
