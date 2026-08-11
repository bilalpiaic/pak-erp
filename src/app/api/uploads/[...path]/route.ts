import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ path: string[] }> };

/** Serve locally stored uploads when Vercel Blob is not configured. */
export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const { path: segments } = await params;
    if (!segments?.length) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const relative = segments.map(decodeURIComponent).join("/");
    if (relative.includes("..")) {
      return NextResponse.json({ error: "Invalid path." }, { status: 400 });
    }

    const diskPath = path.join(process.cwd(), ".data", "uploads", relative);
    const data = await readFile(diskPath);
    const fileName = path.basename(diskPath);
    const ext = path.extname(fileName).toLowerCase();
    const mime =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".csv"
              ? "text/csv"
              : "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
