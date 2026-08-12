import { NextResponse } from "next/server";

import { AuthError, authErrorResponse } from "@/lib/auth/request";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { authenticateUser, ensureSeedAdmin } from "@/lib/users/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureSeedAdmin();
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!username || !password) {
      throw new AuthError("Username and password are required.", 400);
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      throw new AuthError("Invalid username or password.", 401);
    }

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    console.error("POST /api/auth/login", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
