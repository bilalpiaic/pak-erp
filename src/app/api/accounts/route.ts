import { NextResponse } from "next/server";

import {
  createAccount,
  listAccounts,
  validateAccountInput,
} from "@/lib/accounts/service";
import type { AccountInput, AccountListQuery } from "@/lib/accounts/types";
import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query: AccountListQuery = {
      search: searchParams.get("search") ?? undefined,
      accountType: searchParams.get("type") ?? undefined,
      active: (searchParams.get("active") as AccountListQuery["active"]) ?? "all",
    };

    const data = await listAccounts(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list accounts.";
    console.error("GET /api/accounts", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as AccountInput;
    const errors = validateAccountInput(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const account = await createAccount(body, actorName(session));
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to create account.";
    const status = message.includes("already exists")
      ? 409
      : message.includes("No company")
        ? 400
        : 500;
    console.error("POST /api/accounts", error);
    return NextResponse.json({ error: message }, { status });
  }
}
