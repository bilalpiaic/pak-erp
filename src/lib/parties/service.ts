import type { Party } from "@/generated/prisma/client";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import {
  PARTY_TYPES,
  type PartyDTO,
  type PartyInput,
  type PartyListQuery,
  type PartyTypeValue,
} from "./types";

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

function toPartyDTO(party: Party): PartyDTO {
  return serialize({
    id: party.id.toString(),
    companyId: party.companyId.toString(),
    name: party.name,
    ntn: party.ntn,
    partyType: party.partyType as PartyTypeValue,
    phone: party.phone,
    email: party.email,
    address: party.address,
    isActive: party.isActive,
    outstandingDays: party.outstandingDays,
    outstandingAmount: centsToDecimalString(
      toCents(party.outstandingAmount?.toString() ?? "0") ?? 0,
    ),
    whtStatus: party.whtStatus,
    createdAt: party.createdAt.toISOString(),
    updatedAt: party.updatedAt.toISOString(),
  });
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function validatePartyInput(input: PartyInput): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push("Party name is required.");
  else if (input.name.trim().length > 200) errors.push("Party name must be 200 characters or fewer.");
  if (!PARTY_TYPES.includes(input.partyType)) errors.push("Invalid party type.");
  if (input.ntn && input.ntn.trim().length > 50) errors.push("NTN must be 50 characters or fewer.");
  if (
    input.outstandingDays != null &&
    (!Number.isFinite(input.outstandingDays) || input.outstandingDays < 0)
  ) {
    errors.push("Outstanding days must be a non-negative number.");
  }
  if (
    input.outstandingAmount != null &&
    input.outstandingAmount !== "" &&
    toCents(input.outstandingAmount) === null
  ) {
    errors.push("Outstanding amount is invalid.");
  }
  return errors;
}

export async function listParties(query: PartyListQuery = {}): Promise<{ parties: PartyDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const search = query.search?.trim();
  const type =
    query.partyType && PARTY_TYPES.includes(query.partyType as PartyTypeValue)
      ? (query.partyType as PartyTypeValue)
      : undefined;

  const parties = await prisma.party.findMany({
    where: {
      companyId,
      ...(query.active === "active" ? { isActive: true } : {}),
      ...(query.active === "inactive" ? { isActive: false } : {}),
      ...(type
        ? {
            OR: [{ partyType: type }, { partyType: "Both" }],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { ntn: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }],
  });

  return { parties: parties.map(toPartyDTO) };
}

export async function getParty(id: string): Promise<PartyDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const party = await prisma.party.findFirst({
    where: { id: BigInt(id), companyId },
  });
  return party ? toPartyDTO(party) : null;
}

export async function createParty(input: PartyInput): Promise<PartyDTO> {
  const errors = validatePartyInput(input);
  if (errors.length) throw new Error(errors.join(" "));

  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const amountCents = toCents(input.outstandingAmount ?? "0") ?? 0;

  try {
    const party = await prisma.party.create({
      data: {
        companyId,
        name: input.name.trim(),
        ntn: normalizeOptional(input.ntn),
        partyType: input.partyType,
        phone: normalizeOptional(input.phone),
        email: normalizeOptional(input.email),
        address: normalizeOptional(input.address),
        isActive: input.isActive ?? true,
        outstandingDays: input.outstandingDays ?? null,
        outstandingAmount: centsToDecimalString(amountCents),
        whtStatus: normalizeOptional(input.whtStatus),
      },
    });
    return toPartyDTO(party);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("A party with this name already exists.");
    }
    throw error;
  }
}

export async function updateParty(id: string, input: PartyInput): Promise<PartyDTO> {
  const errors = validatePartyInput(input);
  if (errors.length) throw new Error(errors.join(" "));

  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const existing = await prisma.party.findFirst({ where: { id: BigInt(id), companyId } });
  if (!existing) throw new Error("Party not found.");

  const amountCents = toCents(input.outstandingAmount ?? "0") ?? 0;

  try {
    const party = await prisma.party.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        ntn: normalizeOptional(input.ntn),
        partyType: input.partyType,
        phone: normalizeOptional(input.phone),
        email: normalizeOptional(input.email),
        address: normalizeOptional(input.address),
        isActive: input.isActive ?? existing.isActive,
        outstandingDays: input.outstandingDays ?? null,
        outstandingAmount: centsToDecimalString(amountCents),
        whtStatus: normalizeOptional(input.whtStatus),
      },
    });
    return toPartyDTO(party);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new Error("A party with this name already exists.");
    }
    throw error;
  }
}

export async function setPartyActive(id: string, isActive: boolean): Promise<PartyDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const existing = await prisma.party.findFirst({ where: { id: BigInt(id), companyId } });
  if (!existing) throw new Error("Party not found.");
  const party = await prisma.party.update({
    where: { id: existing.id },
    data: { isActive },
  });
  return toPartyDTO(party);
}
