import type { FiscalYear } from "@/generated/prisma/client";
import { cookies } from "next/headers";

import { DEFAULT_FY_START, todayIso } from "@/lib/accounting/dates";
import { getPrimaryCompany } from "@/lib/company/service";
import type { FiscalYearDTO } from "@/lib/company/types";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import { ACTIVE_FY_COOKIE } from "./constants";
import {
  buildFiscalPeriod,
  dateRangeForFiscalYear,
  fiscalStartCalendarYear,
} from "./period";

export function toFiscalYearDTO(fy: FiscalYear): FiscalYearDTO {
  return serialize({
    id: fy.id.toString(),
    name: fy.name,
    startDate: fy.startDate.toISOString().slice(0, 10),
    endDate: fy.endDate.toISOString().slice(0, 10),
    isOpen: fy.isOpen,
  });
}

async function requireCompanyId(): Promise<{ companyId: bigint; fiscalYearStart: number }> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return { companyId: BigInt(company.id), fiscalYearStart: company.fiscalYearStart };
}

export async function listFiscalYears(): Promise<FiscalYearDTO[]> {
  const { companyId } = await requireCompanyId();
  const prisma = getPrisma();
  const rows = await prisma.fiscalYear.findMany({
    where: { companyId },
    orderBy: { startDate: "desc" },
  });
  return rows.map(toFiscalYearDTO);
}

export async function getFiscalYearById(id: string): Promise<FiscalYearDTO | null> {
  const { companyId } = await requireCompanyId();
  const prisma = getPrisma();
  const row = await prisma.fiscalYear.findFirst({
    where: { id: BigInt(id), companyId },
  });
  return row ? toFiscalYearDTO(row) : null;
}

export async function ensureCurrentFiscalYear(
  companyId: bigint,
  fiscalYearStart: number,
): Promise<FiscalYearDTO> {
  const prisma = getPrisma();
  const startYear = fiscalStartCalendarYear(fiscalYearStart);
  const period = buildFiscalPeriod(fiscalYearStart, startYear);

  const existing = await prisma.fiscalYear.findFirst({
    where: {
      companyId,
      startDate: period.startDate,
    },
  });
  if (existing) return toFiscalYearDTO(existing);

  const created = await prisma.fiscalYear.create({
    data: {
      companyId,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      isOpen: true,
    },
  });
  return toFiscalYearDTO(created);
}

/** Create the next fiscal year after the latest one (or current period if none). */
export async function createNextFiscalYear(): Promise<FiscalYearDTO> {
  const { companyId, fiscalYearStart } = await requireCompanyId();
  const prisma = getPrisma();

  const latest = await prisma.fiscalYear.findFirst({
    where: { companyId },
    orderBy: { startDate: "desc" },
  });

  let startYear: number;
  if (latest) {
    startYear = latest.startDate.getUTCFullYear() + 1;
  } else {
    startYear = fiscalStartCalendarYear(fiscalYearStart);
  }

  const period = buildFiscalPeriod(fiscalYearStart, startYear);

  const clash = await prisma.fiscalYear.findFirst({
    where: { companyId, OR: [{ name: period.name }, { startDate: period.startDate }] },
  });
  if (clash) {
    throw new Error(`${period.name} already exists.`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const fy = await tx.fiscalYear.create({
      data: {
        companyId,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        isOpen: true,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor: "system",
        action: "CREATE",
        entity: "FiscalYear",
        recordId: fy.id.toString(),
        newValue: {
          name: fy.name,
          startDate: period.startDate.toISOString().slice(0, 10),
          endDate: period.endDate.toISOString().slice(0, 10),
          isOpen: true,
        },
      },
    });

    return fy;
  });

  return toFiscalYearDTO(created);
}

export async function setFiscalYearOpen(
  id: string,
  isOpen: boolean,
): Promise<FiscalYearDTO> {
  const { companyId } = await requireCompanyId();
  const prisma = getPrisma();
  const fyId = BigInt(id);

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.fiscalYear.findFirst({
      where: { id: fyId, companyId },
    });
    if (!before) throw new Error("Fiscal year not found.");

    const fy = await tx.fiscalYear.update({
      where: { id: fyId },
      data: { isOpen },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor: "system",
        action: isOpen ? "ACTIVATE" : "DEACTIVATE",
        entity: "FiscalYear",
        recordId: fy.id.toString(),
        oldValue: { isOpen: before.isOpen },
        newValue: { isOpen },
      },
    });

    return fy;
  });

  return toFiscalYearDTO(updated);
}

/** Resolve the user's selected FY (cookie) or fall back to latest open / latest overall. */
export async function resolveActiveFiscalYear(
  preferredId?: string | null,
): Promise<FiscalYearDTO | null> {
  const years = await listFiscalYears();
  if (!years.length) return null;

  if (preferredId) {
    const match = years.find((y) => y.id === preferredId);
    if (match) return match;
  }

  const open = years.find((y) => y.isOpen);
  return open ?? years[0] ?? null;
}

export async function readPreferredFiscalYearId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(ACTIVE_FY_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function getActiveFiscalYear(): Promise<FiscalYearDTO | null> {
  const preferred = await readPreferredFiscalYearId();
  return resolveActiveFiscalYear(preferred);
}

export async function getActiveDateRange(): Promise<{
  from: string;
  to: string;
  fiscalYear: FiscalYearDTO | null;
}> {
  const fiscalYear = await getActiveFiscalYear();
  if (!fiscalYear) {
    return { from: DEFAULT_FY_START, to: todayIso(), fiscalYear: null };
  }
  return { ...dateRangeForFiscalYear(fiscalYear), fiscalYear };
}
