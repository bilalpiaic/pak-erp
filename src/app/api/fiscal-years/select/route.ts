import { NextResponse } from "next/server";

import {
  ACTIVE_FY_COOKIE,
  ACTIVE_FY_COOKIE_MAX_AGE,
} from "@/lib/fiscal-years/constants";
import { getFiscalYearById } from "@/lib/fiscal-years/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string | null };

    if (!body.id) {
      const response = NextResponse.json({
        activeFiscalYearId: null,
        activeFiscalYear: null,
      });
      response.cookies.set(ACTIVE_FY_COOKIE, "", {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const fiscalYear = await getFiscalYearById(body.id);
    if (!fiscalYear) {
      return NextResponse.json({ error: "Fiscal year not found." }, { status: 404 });
    }

    const response = NextResponse.json({
      activeFiscalYearId: fiscalYear.id,
      activeFiscalYear: fiscalYear,
    });
    response.cookies.set(ACTIVE_FY_COOKIE, fiscalYear.id, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: ACTIVE_FY_COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to select fiscal year.";
    console.error("POST /api/fiscal-years/select", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
