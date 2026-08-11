import { NextResponse } from "next/server";

import { listAttachments, uploadAttachment } from "@/lib/attachments/service";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const attachments = await listAttachments(id);
    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list attachments.";
    console.error("GET /api/vouchers/[id]/attachments", error);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field is required." }, { status: 400 });
    }
    const attachment = await uploadAttachment(id, file);
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload attachment.";
    console.error("POST /api/vouchers/[id]/attachments", error);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("Unsupported") ||
            message.includes("exceeds") ||
            message.includes("empty") ||
            message.includes("required") ||
            message.includes("cancelled") ||
            message.includes("Cannot")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
