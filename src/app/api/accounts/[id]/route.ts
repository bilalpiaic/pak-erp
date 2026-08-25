import { NextResponse } from "next/server";

import {
  deleteAccount,
  getAccount,
  setAccountActive,
  updateAccount,
  validateAccountInput,
} from "@/lib/accounts/service";
import type { AccountInput } from "@/lib/accounts/types";
import { actorName, authErrorResponse, requireAdmin } from "@/lib/auth/request";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const account = await getAccount(id);
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load account.";
    console.error("GET /api/accounts/[id]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const actor = actorName(session);
    const { id } = await context.params;
    const body = (await request.json()) as AccountInput & {
      isActive?: boolean;
      toggleActiveOnly?: boolean;
    };

    if (body.toggleActiveOnly && typeof body.isActive === "boolean") {
      const account = await setAccountActive(id, body.isActive, actor);
      return NextResponse.json({ account });
    }

    const errors = validateAccountInput(body, { requireCode: true });
    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const account = await updateAccount(id, body, actor);
    return NextResponse.json({ account });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to update account.";
    const status = message.includes("not found")
      ? 404
      : message.includes("cannot be changed")
        ? 400
        : 500;
    console.error("PATCH /api/accounts/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    await deleteAccount(id, actorName(session));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to delete account.";
    const status = message.includes("not found")
      ? 404
      : message.includes("cannot be deleted") || message.includes("required")
        ? 400
        : 500;
    console.error("DELETE /api/accounts/[id]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
