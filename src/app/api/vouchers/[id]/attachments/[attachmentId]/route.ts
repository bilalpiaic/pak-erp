import { NextResponse } from "next/server";

import { deleteAttachment } from "@/lib/attachments/service";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const { id, attachmentId } = await params;
    await deleteAttachment(id, attachmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete attachment.";
    console.error("DELETE /api/vouchers/[id]/attachments/[attachmentId]", error);
    const status =
      message.includes("not found")
        ? 404
        : message.includes("only be removed") || message.includes("draft")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
