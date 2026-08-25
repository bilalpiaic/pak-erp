import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireSession } from "@/lib/auth/request";
import {
  createAndPostSalesInvoice,
  createDraftSalesInvoice,
  listSalesInvoices,
  nextSalesInvoiceNo,
} from "@/lib/sales-invoices/service";
import type { SalesInvoiceInput, SalesInvoiceListQuery } from "@/lib/sales-invoices/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("nextNumber") === "1" || searchParams.get("nextNumber") === "true") {
      const invoiceNo = await nextSalesInvoiceNo();
      return NextResponse.json({ invoiceNo });
    }

    const query: SalesInvoiceListQuery = {
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    };
    const data = await listSalesInvoices(query);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list sales invoices.";
    console.error("GET /api/sales-invoices", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const actor = actorName(session);
    const body = (await request.json()) as SalesInvoiceInput & { post?: boolean };
    const invoice = body.post
      ? await createAndPostSalesInvoice(body, actor)
      : await createDraftSalesInvoice(body, actor);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message =
      error instanceof Error ? error.message : "Failed to create sales invoice.";
    const status =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("invalid") ||
      message.includes("Inactive") ||
      message.includes("missing") ||
      message.includes("Debtor")
        ? 400
        : 500;
    console.error("POST /api/sales-invoices", error);
    return NextResponse.json({ error: message }, { status });
  }
}
