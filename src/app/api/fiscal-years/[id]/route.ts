import { NextResponse } from "next/server";

import { setFiscalYearOpen } from "@/lib/fiscal-years/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { isOpen?: boolean };

    if (typeof body.isOpen !== "boolean") {
      return NextResponse.json(
        { error: "isOpen (boolean) is required." },
        { status: 400 },
      );
    }

    const fiscalYear = await setFiscalYearOpen(id, body.isOpen);
    return NextResponse.json({ fiscalYear });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update fiscal year.";
    const status = message.includes("not found") ? 404 : 500;
    console.error("PATCH /api/fiscal-years/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
