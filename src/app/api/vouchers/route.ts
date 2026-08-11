import { NextResponse } from "next/server";

import {
  createAndPostVoucher,
  createDraftVoucher,
  listVouchers,
  nextVoucherNo,
} from "@/lib/vouchers/service";
import type { VoucherInput, VoucherListQuery, VoucherTypeValue } from "@/lib/vouchers/types";
import { VOUCHER_TYPES } from "@/lib/vouchers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("nextNumber")) {
      const type = searchParams.get("nextNumber") as VoucherTypeValue;
      if (!VOUCHER_TYPES.includes(type)) {
        return NextResponse.json({ error: "Invalid voucher type." }, { status: 400 });
      }
      const voucherNo = await nextVoucherNo(type);
      return NextResponse.json({ voucherNo });
    }

    const query: VoucherListQuery = {
      search: searchParams.get("search") ?? undefined,
      voucherType: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    };
    const data = await listVouchers(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list vouchers.";
    console.error("GET /api/vouchers", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VoucherInput & { post?: boolean };
    const voucher = body.post
      ? await createAndPostVoucher(body)
      : await createDraftVoucher(body);
    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create voucher.";
    const status =
      message.includes("not balanced") ||
      message.includes("required") ||
      message.includes("invalid") ||
      message.includes("Inactive")
        ? 400
        : 500;
    console.error("POST /api/vouchers", error);
    return NextResponse.json({ error: message }, { status });
  }
}
