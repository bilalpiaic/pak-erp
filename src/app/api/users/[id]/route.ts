import { NextResponse } from "next/server";

import { authErrorResponse, requireAdmin } from "@/lib/auth/request";
import { deleteUser, getUser, setUserActive, updateUser } from "@/lib/users/service";
import type { UserInput } from "@/lib/users/types";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await getUser(id);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to load user.";
    console.error("GET /api/users/[id]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = (await request.json()) as UserInput & {
      isActive?: boolean;
      toggleActive?: boolean;
    };

    if (body.toggleActive === true || (body.isActive !== undefined && Object.keys(body).length === 1)) {
      const existing = await getUser(id);
      if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });
      const user = await setUserActive(id, body.isActive ?? !existing.isActive);
      return NextResponse.json({ user });
    }

    const user = await updateUser(id, body);
    return NextResponse.json({ user });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to update user.";
    console.error("PATCH /api/users/[id]", error);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("required") ||
            message.includes("Invalid") ||
            message.includes("already exists") ||
            message.includes("must be") ||
            message.includes("at least") ||
            message.includes("Cannot remove") ||
            message.includes("last active")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await deleteUser(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to delete user.";
    console.error("DELETE /api/users/[id]", error);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("Cannot") ||
            message.includes("cannot") ||
            message.includes("last active")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
