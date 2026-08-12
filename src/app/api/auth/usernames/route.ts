import { NextResponse } from "next/server";

import { listActiveUsernamesForLogin } from "@/lib/users/service";

export const runtime = "nodejs";

/** Public LOV for login username (F5). Returns active usernames only. */
export async function GET() {
  try {
    const users = await listActiveUsernamesForLogin();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/auth/usernames", error);
    return NextResponse.json({ error: "Failed to load usernames." }, { status: 500 });
  }
}
