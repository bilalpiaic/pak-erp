import { NextResponse } from "next/server";

import { authErrorResponse, getSession } from "@/lib/auth/request";
import { ensureSeedAdmin } from "@/lib/users/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureSeedAdmin();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        role: session.role,
        isDemo: session.isDemo,
      },
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    console.error("GET /api/auth/me", error);
    return NextResponse.json({ error: "Failed to load session." }, { status: 500 });
  }
}
