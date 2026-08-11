import { NextResponse } from "next/server";

import {
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
    const { id } = await context.params;
    const body = (await request.json()) as SalesInvoiceInput;
    const invoice = await updateDraftSalesInvoice(id, body);
    return NextResponse.json({ invoice });
  } catch (error) {
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
