import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";
import { unpostSalesInvoice } from "@/lib/sales-invoices/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const invoice = await unpostSalesInvoice(id, actorName(session));
    return NextResponse.json({ invoice });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message =
      error instanceof Error ? error.message : "Failed to unpost sales invoice.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only posted") || message.includes("cannot")
        ? 400
        : 500;
    console.error("POST /api/sales-invoices/[id]/unpost", error);
    return NextResponse.json({ error: message }, { status });
  }
}
