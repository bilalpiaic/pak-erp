import type { Company, FiscalYear } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import type { CompanyDTO, CompanyInput, FiscalYearDTO } from "./types";

function toCompanyDTO(company: Company): CompanyDTO {
  return serialize({
    id: company.id.toString(),
    name: company.name,
    address: company.address,
    ntn: company.ntn,
    strn: company.strn,
    phone: company.phone,
    email: company.email,
    currency: company.currency,
    fiscalYearStart: company.fiscalYearStart,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  });
}

function toFiscalYearDTO(fy: FiscalYear): FiscalYearDTO {
  return serialize({
    id: fy.id.toString(),
    name: fy.name,
    startDate: fy.startDate.toISOString().slice(0, 10),
    endDate: fy.endDate.toISOString().slice(0, 10),
    isOpen: fy.isOpen,
  });
}

export async function getPrimaryCompany(): Promise<CompanyDTO | null> {
  const prisma = getPrisma();
  const company = await prisma.company.findFirst({
    orderBy: { id: "asc" },
  });
  return company ? toCompanyDTO(company) : null;
}

export async function getPrimaryCompanyWithFiscalYear(): Promise<{
  company: CompanyDTO;
  fiscalYear: FiscalYearDTO | null;
} | null> {
  const prisma = getPrisma();
  const company = await prisma.company.findFirst({
    orderBy: { id: "asc" },
    include: {
      fiscalYears: {
        where: { isOpen: true },
        orderBy: { startDate: "desc" },
        take: 1,
      },
    },
  });

  if (!company) return null;

  return {
    company: toCompanyDTO(company),
    fiscalYear: company.fiscalYears[0]
      ? toFiscalYearDTO(company.fiscalYears[0])
      : null,
  };
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function validateCompanyInput(input: CompanyInput): string[] {
  const errors: string[] = [];

  if (!input.name?.trim()) {
    errors.push("Company name is required.");
  } else if (input.name.trim().length > 200) {
    errors.push("Company name must be 200 characters or fewer.");
  }

  if (input.currency && input.currency.trim().length > 10) {
    errors.push("Currency must be 10 characters or fewer.");
  }

  if (
    input.fiscalYearStart !== undefined &&
    (input.fiscalYearStart < 1 || input.fiscalYearStart > 12)
  ) {
    errors.push("Fiscal year start month must be between 1 and 12.");
  }

  if (input.email) {
    const email = input.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Email address is invalid.");
    }
  }

  return errors;
}

export async function createCompany(input: CompanyInput): Promise<CompanyDTO> {
  const prisma = getPrisma();
  const existing = await prisma.company.findFirst();
  if (existing) {
    throw new Error("A company already exists. Update the existing company instead.");
  }

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name: input.name.trim(),
        address: normalizeOptional(input.address),
        ntn: normalizeOptional(input.ntn),
        strn: normalizeOptional(input.strn),
        phone: normalizeOptional(input.phone),
        email: normalizeOptional(input.email),
        currency: (input.currency ?? "PKR").trim() || "PKR",
        fiscalYearStart: input.fiscalYearStart ?? 7,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: created.id,
        actor: "system",
        action: "CREATE",
        entity: "Company",
        recordId: created.id.toString(),
        newValue: {
          name: created.name,
          currency: created.currency,
        },
      },
    });

    return created;
  });

  return toCompanyDTO(company);
}

export async function updateCompany(
  id: string,
  input: CompanyInput,
): Promise<CompanyDTO> {
  const prisma = getPrisma();
  const companyId = BigInt(id);

  const company = await prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({ where: { id: companyId } });
    if (!before) {
      throw new Error("Company not found.");
    }

    const updated = await tx.company.update({
      where: { id: companyId },
      data: {
        name: input.name.trim(),
        address: normalizeOptional(input.address),
        ntn: normalizeOptional(input.ntn),
        strn: normalizeOptional(input.strn),
        phone: normalizeOptional(input.phone),
        email: normalizeOptional(input.email),
        currency: (input.currency ?? before.currency).trim() || "PKR",
        fiscalYearStart: input.fiscalYearStart ?? before.fiscalYearStart,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: updated.id,
        actor: "system",
        action: "UPDATE",
        entity: "Company",
        recordId: updated.id.toString(),
        oldValue: {
          name: before.name,
          address: before.address,
          ntn: before.ntn,
          strn: before.strn,
          phone: before.phone,
          email: before.email,
          currency: before.currency,
          fiscalYearStart: before.fiscalYearStart,
        },
        newValue: {
          name: updated.name,
          address: updated.address,
          ntn: updated.ntn,
          strn: updated.strn,
          phone: updated.phone,
          email: updated.email,
          currency: updated.currency,
          fiscalYearStart: updated.fiscalYearStart,
        },
      },
    });

    return updated;
  });

  return toCompanyDTO(company);
}
