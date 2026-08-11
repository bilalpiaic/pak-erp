import { NextResponse } from "next/server";

import {
  createCompany,
  getPrimaryCompanyWithFiscalYear,
  updateCompany,
  validateCompanyInput,
} from "@/lib/company/service";
import type { CompanyInput } from "@/lib/company/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getPrimaryCompanyWithFiscalYear();
    if (!data) {
      return NextResponse.json({ company: null, fiscalYear: null }, { status: 200 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/company", error);
    return NextResponse.json(
      { error: "Failed to load company from database." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompanyInput;
    const errors = validateCompanyInput(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const company = await createCompany(body);
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create company.";
    const status = message.includes("already exists") ? 409 : 500;
    console.error("POST /api/company", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as CompanyInput & { id?: string };
    const errors = validateCompanyInput(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    if (!body.id) {
      return NextResponse.json({ error: "Company id is required." }, { status: 400 });
    }

    const company = await updateCompany(body.id, body);
    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update company.";
    const status = message.includes("not found") ? 404 : 500;
    console.error("PATCH /api/company", error);
    return NextResponse.json({ error: message }, { status });
  }
}
