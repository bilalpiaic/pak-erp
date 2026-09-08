import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireSession } from "@/lib/auth/request";
import { postPurchaseInvoice } from "@/lib/purchase-invoices/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const invoice = await postPurchaseInvoice(id, actorName(session));
    return NextResponse.json({ invoice });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to post purchase invoice.";
    const status =
      message.includes("not found")
        ? 404
        : message.includes("Only draft") ||
            message.includes("required") ||
            message.includes("Insufficient") ||
            message.includes("later") ||
            message.includes("saleable") ||
            message.includes("consumable")
          ? 400
          : 500;
    console.error("POST /api/purchase-invoices/[id]/post", error);
    return NextResponse.json({ error: message }, { status });
  }
}
