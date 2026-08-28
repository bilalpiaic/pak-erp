import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";
import { reconcileSalesInvoiceVouchers } from "@/lib/sales-invoices/reconcile";

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

export async function POST() {
  try {
    const session = await requireAdmin();
    const result = await reconcileSalesInvoiceVouchers({ dryRun: false }, actorName(session));
    return NextResponse.json(result);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to reconcile sales invoices.";
    console.error("POST /api/sales-invoices/reconcile", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
