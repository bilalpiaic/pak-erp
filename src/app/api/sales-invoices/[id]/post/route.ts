import { NextResponse } from "next/server";

import { postSalesInvoice } from "@/lib/sales-invoices/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoice = await postSalesInvoice(id);
    return NextResponse.json({ invoice });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to post sales invoice.";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only draft") ||
          message.includes("required") ||
          message.includes("must") ||
          message.includes("missing")
        ? 400
        : 500;
    console.error("POST /api/sales-invoices/[id]/post", error);
    return NextResponse.json({ error: message }, { status });
  }
}
