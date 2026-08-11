import { NextResponse } from "next/server";

import { getVoucher, updateDraftVoucher } from "@/lib/vouchers/service";
import type { VoucherInput } from "@/lib/vouchers/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const voucher = await getVoucher(id);
    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
    }
    return NextResponse.json({ voucher });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load voucher.";
    console.error("GET /api/vouchers/[id]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as VoucherInput;
    const voucher = await updateDraftVoucher(id, body);
    return NextResponse.json({ voucher });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update voucher.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft") || message.includes("required")
        ? 400
        : 500;
    console.error("PATCH /api/vouchers/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
