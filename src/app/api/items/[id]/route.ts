import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireAdmin, requireSession } from "@/lib/auth/request";
import { deleteUnusedItem, getItem, setItemActive, updateItem } from "@/lib/items/service";
import type { ItemInput } from "@/lib/items/types";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const item = await getItem(id);
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load item.";
    console.error("GET /api/items/[id]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = (await request.json()) as ItemInput & { isActive?: boolean; toggleActive?: boolean };
    if (body.toggleActive === true || (body.isActive !== undefined && Object.keys(body).length <= 2 && !body.sku)) {
      const existing = await getItem(id);
      if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });
      const item = await setItemActive(id, body.isActive ?? !existing.isActive, actorName(session));
      return NextResponse.json({ item });
    }
    const item = await updateItem(id, body, actorName(session));
    return NextResponse.json({ item });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to update item.";
    const status = message.includes("not found")
      ? 404
      : message.includes("required") || message.includes("already exists") || message.includes("must")
        ? 400
        : 500;
    console.error("PATCH /api/items/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await deleteUnusedItem(id, actorName(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to delete item.";
    const status = message.includes("not found")
      ? 404
      : message.includes("cannot be deleted") || message.includes("used")
        ? 400
        : 500;
    console.error("DELETE /api/items/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
