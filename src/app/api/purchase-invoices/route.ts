import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireSession } from "@/lib/auth/request";
import {
  createAndPostPurchaseInvoice,
  createDraftPurchaseInvoice,
  listPurchaseInvoices,
  nextPurchaseInvoiceNo,
} from "@/lib/purchase-invoices/service";
import type { PurchaseInvoiceInput, PurchaseInvoiceListQuery } from "@/lib/purchase-invoices/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("nextNumber") === "1" || searchParams.get("nextNumber") === "true") {
      const invoiceNo = await nextPurchaseInvoiceNo();
      return NextResponse.json({ invoiceNo });
    }
    const query: PurchaseInvoiceListQuery = {
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    };
    const data = await listPurchaseInvoices(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list purchase invoices.";
    console.error("GET /api/purchase-invoices", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const actor = actorName(session);
    const body = (await request.json()) as PurchaseInvoiceInput & { post?: boolean };
    const invoice = body.post
      ? await createAndPostPurchaseInvoice(body, actor)
      : await createDraftPurchaseInvoice(body, actor);
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to create purchase invoice.";
    const status =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("inactive") ||
      message.includes("Creditor") ||
      message.includes("Insufficient")
        ? 400
        : 500;
    console.error("POST /api/purchase-invoices", error);
    return NextResponse.json({ error: message }, { status });
  }
}
