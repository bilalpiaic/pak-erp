import { NextResponse } from "next/server";

import { cancelSalesInvoice } from "@/lib/sales-invoices/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoice = await cancelSalesInvoice(id);
    return NextResponse.json({ invoice });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel sales invoice.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only posted")
        ? 400
        : 500;
    console.error("POST /api/sales-invoices/[id]/cancel", error);
    return NextResponse.json({ error: message }, { status });
  }
}
