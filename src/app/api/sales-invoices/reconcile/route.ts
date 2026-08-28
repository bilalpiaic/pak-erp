import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";
import {
  deleteOrphanSiVouchers,
  reconcileSalesInvoiceVouchers,
} from "@/lib/sales-invoices/reconcile";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const result = await reconcileSalesInvoiceVouchers({ dryRun: true });
    return NextResponse.json(result);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to audit sales invoices.";
    console.error("GET /api/sales-invoices/reconcile", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const actor = actorName(session);
    let body: { deleteOrphans?: boolean; voucherIds?: string[] } = {};
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = ((await request.json()) as typeof body) ?? {};
      } catch {
        body = {};
      }
    }

    const result = body.deleteOrphans
      ? await deleteOrphanSiVouchers({ voucherIds: body.voucherIds }, actor)
      : await reconcileSalesInvoiceVouchers({ dryRun: false }, actor);
    return NextResponse.json(result);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to reconcile sales invoices.";
    const status =
      message.includes("orphan") ||
      message.includes("linked to a sales invoice") ||
      message.includes("Reconcile SI vouchers")
        ? 400
        : 500;
    console.error("POST /api/sales-invoices/reconcile", error);
    return NextResponse.json({ error: message }, { status });
  }
}
