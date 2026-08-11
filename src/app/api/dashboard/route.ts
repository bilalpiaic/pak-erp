import { NextResponse } from "next/server";

import { getDashboard } from "@/lib/dashboard/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getDashboard();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard.";
    console.error("GET /api/dashboard", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
