import { NextResponse } from "next/server";

import { getReport, REPORT_TYPES, type ReportType } from "@/lib/reports/service";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{ type: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const { type } = await params;
    if (!REPORT_TYPES.includes(type as ReportType)) {
      return NextResponse.json({ error: "Unknown report type." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const data = await getReport(type as ReportType, {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load report.";
    console.error("GET /api/reports/[type]", error);
    const status =
      message.includes("Invalid") || message.includes("must be") || message.includes("Unknown")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
