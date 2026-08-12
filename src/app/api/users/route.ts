import { NextResponse } from "next/server";

import { authErrorResponse, requireAdmin } from "@/lib/auth/request";
import { createUser, listUsers } from "@/lib/users/service";
import type { UserInput, UserListQuery } from "@/lib/users/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const query: UserListQuery = {
      search: searchParams.get("search") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      active: (searchParams.get("active") as UserListQuery["active"]) ?? "all",
    };
    const data = await listUsers(query);
    return NextResponse.json(data);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to list users.";
    console.error("GET /api/users", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as UserInput;
    const user = await createUser(body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to create user.";
    console.error("POST /api/users", error);
    const status =
      message.includes("required") ||
      message.includes("Invalid") ||
      message.includes("already exists") ||
      message.includes("must be") ||
      message.includes("at least")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
