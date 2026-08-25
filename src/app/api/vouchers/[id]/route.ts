import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin, requireSession } from "@/lib/auth/request";
import { deleteDraftVoucher, getVoucher, updateDraftVoucher } from "@/lib/vouchers/service";
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
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await request.json()) as VoucherInput;
    const voucher = await updateDraftVoucher(id, body, actorName(session));
    return NextResponse.json({ voucher });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to update voucher.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft") ||
          message.includes("required") ||
          message.includes("Sales invoices")
        ? 400
        : 500;
    console.error("PATCH /api/vouchers/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    await deleteDraftVoucher(id, actorName(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to delete voucher.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft") || message.includes("Sales invoices")
        ? 400
        : 500;
    console.error("DELETE /api/vouchers/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
