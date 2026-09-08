import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireSession } from "@/lib/auth/request";
import { createItem, listItems } from "@/lib/items/service";
import type { ItemInput, ItemListQuery } from "@/lib/items/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query: ItemListQuery = {
      search: searchParams.get("search") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      active: (searchParams.get("active") as ItemListQuery["active"]) ?? "all",
    };
    const data = await listItems(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list items.";
    console.error("GET /api/items", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as ItemInput;
    const item = await createItem(body, actorName(session));
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to create item.";
    const status =
      message.includes("required") ||
      message.includes("Invalid") ||
      message.includes("already exists") ||
      message.includes("must")
        ? 400
        : 500;
    console.error("POST /api/items", error);
    return NextResponse.json({ error: message }, { status });
  }
}
