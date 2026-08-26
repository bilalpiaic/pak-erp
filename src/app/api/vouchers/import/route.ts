import { NextResponse } from "next/server";

import { actorName, authErrorResponse, requireSession } from "@/lib/auth/request";
import {
  importVouchersFromCsv,
  MAX_CSV_BYTES,
} from "@/lib/vouchers/import";
import {
  VOUCHER_IMPORT_SAMPLE_CSV,
  VOUCHER_IMPORT_TEMPLATE_CSV,
} from "@/lib/vouchers/import-sample";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("sample") ?? searchParams.get("kind");
    const csv =
      kind === "template" ? VOUCHER_IMPORT_TEMPLATE_CSV : VOUCHER_IMPORT_SAMPLE_CSV;
    const filename =
      kind === "template" ? "vouchers-import-template.csv" : "vouchers-import-sample.csv";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to download sample.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const actor = actorName(session);
    const contentType = request.headers.get("content-type") ?? "";

    let csvText = "";
    let dryRun = false;
    let postBalanced = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      dryRun = String(form.get("dryRun") ?? "") === "true";
      postBalanced = String(form.get("postBalanced") ?? "") === "true";
      if (file instanceof File) {
        if (file.size > MAX_CSV_BYTES) {
          return NextResponse.json(
            { error: "CSV file exceeds the 2 MB limit." },
            { status: 400 },
          );
        }
        csvText = await file.text();
      }
    } else {
      const body = (await request.json()) as {
        csv?: string;
        dryRun?: boolean;
        postBalanced?: boolean;
      };
      csvText = body.csv ?? "";
      dryRun = Boolean(body.dryRun);
      postBalanced = Boolean(body.postBalanced);
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: "Upload a CSV file or paste CSV text." }, { status: 400 });
    }
    if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
      return NextResponse.json({ error: "CSV file exceeds the 2 MB limit." }, { status: 400 });
    }

    const result = await importVouchersFromCsv(csvText, { dryRun, postBalanced }, actor);
    const status = result.failed && !result.created ? 400 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    const message = error instanceof Error ? error.message : "Failed to import vouchers.";
    console.error("POST /api/vouchers/import", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
