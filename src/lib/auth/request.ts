import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  type SessionPayload,
  verifySessionToken,
} from "@/lib/auth/session";

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Authentication required.", 401);
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new AuthError("Admin access required.", 403);
  }
  return session;
}

export function actorName(session: SessionPayload | null | undefined): string {
  const name = session?.username?.trim();
  return name || "system";
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
