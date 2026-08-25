import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin, requireSession } from "@/lib/auth/request";
import {
  deleteDraftSalesInvoice,
  getSalesInvoice,
  updateDraftSalesInvoice,
} from "@/lib/sales-invoices/service";
import type { SalesInvoiceInput } from "@/lib/sales-invoices/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoice = await getSalesInvoice(id);
    if (!invoice) {
      return NextResponse.json({ error: "Sales invoice not found." }, { status: 404 });
    }
    return NextResponse.json({ invoice });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load sales invoice.";
    console.error("GET /api/sales-invoices/[id]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await request.json()) as SalesInvoiceInput;
    const invoice = await updateDraftSalesInvoice(id, body, actorName(session));
    return NextResponse.json({ invoice });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message =
      error instanceof Error ? error.message : "Failed to update sales invoice.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft") ||
          message.includes("required") ||
          message.includes("must")
        ? 400
        : 500;
    console.error("PATCH /api/sales-invoices/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    await deleteDraftSalesInvoice(id, actorName(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message =
      error instanceof Error ? error.message : "Failed to delete sales invoice.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft")
        ? 400
        : 500;
    console.error("DELETE /api/sales-invoices/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
