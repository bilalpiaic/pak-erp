import type {
  Prisma,
  Voucher,
  VoucherAttachment,
  VoucherLine,
  VoucherType,
} from "@/generated/prisma/client";
import { centsToDecimalString, isBalanced, sumCents, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

import {
  VOUCHER_TYPES,
  type VoucherDTO,
  type VoucherInput,
  type VoucherListQuery,
  type VoucherTypeValue,
} from "./types";
import { parseVoucherDate, validateVoucherInput } from "./validation";

type VoucherWithLines = Voucher & {
  lines: Array<
    VoucherLine & {
      account: { id: bigint; code: string; name: string; isActive: boolean };
    }
  >;
  attachments: VoucherAttachment[];
  salesInvoice?: { id: bigint; invoiceNo: string } | null;
};

function decimalString(value: { toString(): string }): string {
  const cents = toCents(value.toString());
  return centsToDecimalString(cents ?? 0);
}

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) {
    throw new Error("No company found. Create a company in Settings first.");
  }
  return BigInt(company.id);
}

function toVoucherDTO(voucher: VoucherWithLines): VoucherDTO {
  const totalDebitCents = sumCents(voucher.lines.map((l) => l.debit.toString()));
  const totalCreditCents = sumCents(voucher.lines.map((l) => l.credit.toString()));

  return serialize({
    id: voucher.id.toString(),
    companyId: voucher.companyId.toString(),
    voucherNo: voucher.voucherNo,
    voucherType: voucher.voucherType as VoucherTypeValue,
    voucherDate: voucher.voucherDate.toISOString().slice(0, 10),
    referenceNo: voucher.referenceNo,
    partyId: voucher.partyId?.toString() ?? null,
    partyName: voucher.partyName,
    partyNtn: voucher.partyNtn,
    whtApplicable: voucher.whtApplicable,
    narration: voucher.narration,
    status: voucher.status,
    totalDebit: centsToDecimalString(totalDebitCents),
    totalCredit: centsToDecimalString(totalCreditCents),
    balanced: isBalanced(totalDebitCents, totalCreditCents),
    createdBy: voucher.createdBy,
    postedBy: voucher.postedBy,
    cancelledBy: voucher.cancelledBy,
    createdAt: voucher.createdAt.toISOString(),
    postedAt: voucher.postedAt?.toISOString() ?? null,
    cancelledAt: voucher.cancelledAt?.toISOString() ?? null,
    updatedAt: voucher.updatedAt.toISOString(),
    lines: voucher.lines.map((line) => ({
      id: line.id.toString(),
      accountId: line.accountId.toString(),
      accountCode: line.account.code,
      accountName: line.account.name,
      debit: decimalString(line.debit),
      credit: decimalString(line.credit),
      lineNarration: line.lineNarration,
    })),
    attachments: (voucher.attachments ?? []).map((row) => ({
      id: row.id.toString(),
      voucherId: row.voucherId.toString(),
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      storageUrl: row.storageUrl,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

const voucherInclude = {
  lines: {
    include: {
      account: {
        select: { id: true, code: true, name: true, isActive: true },
      },
    },
    orderBy: { id: "asc" as const },
  },
  attachments: {
    orderBy: { createdAt: "desc" as const },
  },
  salesInvoice: {
    select: { id: true, invoiceNo: true },
  },
};

export async function listVouchers(
  query: VoucherListQuery = {},
): Promise<{ vouchers: VoucherDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const where: Prisma.VoucherWhereInput = { companyId };

  if (query.voucherType && query.voucherType !== "All") {
    if (!(VOUCHER_TYPES as readonly string[]).includes(query.voucherType)) {
      throw new Error("Invalid voucher type filter.");
    }
    where.voucherType = query.voucherType as VoucherType;
  } else {
    // Sales invoices are managed under /sales-invoices
    where.voucherType = { not: "SI" };
  }

  if (query.status && query.status !== "All") {
    where.status = query.status as Prisma.EnumVoucherStatusFilter["equals"];
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { voucherNo: { contains: search, mode: "insensitive" } },
      { partyName: { contains: search, mode: "insensitive" } },
      { referenceNo: { contains: search, mode: "insensitive" } },
      { narration: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.voucher.findMany({
    where,
    include: voucherInclude,
    orderBy: [{ voucherDate: "desc" }, { id: "desc" }],
  });

  return { vouchers: rows.map(toVoucherDTO) };
}

export async function getVoucher(id: string): Promise<VoucherDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucher = await prisma.voucher.findFirst({
    where: { id: BigInt(id), companyId },
    include: voucherInclude,
  });
  return voucher ? toVoucherDTO(voucher) : null;
}

export async function nextVoucherNo(
  voucherType: VoucherTypeValue,
  companyId?: bigint,
): Promise<string> {
  const prisma = getPrisma();
  const resolvedCompanyId = companyId ?? (await requireCompanyId());

  const latest = await prisma.voucher.findMany({
    where: { companyId: resolvedCompanyId, voucherType },
    select: { voucherNo: true },
    orderBy: { id: "desc" },
    take: 200,
  });

  let max = 0;
  const prefix = `${voucherType}-`;
  for (const row of latest) {
    if (!row.voucherNo.startsWith(prefix)) continue;
    const numeric = Number(row.voucherNo.slice(prefix.length));
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }

  return `${voucherType}-${String(max + 1).padStart(3, "0")}`;
}

async function assertAccountsUsable(
  companyId: bigint,
  accountIds: bigint[],
  requireActive: boolean,
): Promise<void> {
  const prisma = getPrisma();
  const uniqueIds = Array.from(new Set(accountIds.map((id) => id.toString()))).map(
    (id) => BigInt(id),
  );

  const accounts = await prisma.account.findMany({
    where: { companyId, id: { in: uniqueIds } },
    select: { id: true, code: true, isActive: true },
  });

  if (accounts.length !== uniqueIds.length) {
    throw new Error("One or more accounts were not found for this company.");
  }

  if (requireActive) {
    const inactive = accounts.filter((account) => !account.isActive);
    if (inactive.length) {
      throw new Error(
        `Inactive account(s) cannot be posted: ${inactive.map((a) => a.code).join(", ")}.`,
      );
    }
  }
}

function assertManualVoucher(voucher: {
  voucherType: string;
  salesInvoice?: { id: bigint } | null;
}): void {
  if (voucher.voucherType === "SI" || voucher.salesInvoice) {
    throw new Error(
      "Sales invoices must be unposted or deleted from Sales Invoices so the invoice and ledger stay in sync.",
    );
  }
}

export async function createDraftVoucher(
  input: VoucherInput,
  actor = "system",
): Promise<VoucherDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const validation = validateVoucherInput(input, {
    requireBalanced: false,
    requireLines: false,
  });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }

  if (validation.lines.length) {
    await assertAccountsUsable(
      companyId,
      validation.lines.map((l) => l.accountId),
      false,
    );
  }

  const voucherDate = parseVoucherDate(input.voucherDate)!;
  const voucherNo = await nextVoucherNo(input.voucherType, companyId);

  const created = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo,
        voucherType: input.voucherType,
        voucherDate,
        referenceNo: input.referenceNo?.trim() || null,
        partyId: input.partyId ? BigInt(input.partyId) : null,
        partyName: input.partyName?.trim() || null,
        partyNtn: input.partyNtn?.trim() || null,
        whtApplicable: Boolean(input.whtApplicable),
        narration: input.narration?.trim() || null,
        status: "DRAFT",
        createdBy: actor,
        lines: {
          create: validation.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            lineNarration: line.lineNarration,
          })),
        },
      },
      include: voucherInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CREATE",
        entity: "Voucher",
        recordId: voucher.id.toString(),
        newValue: {
          voucherNo: voucher.voucherNo,
          status: voucher.status,
          totalDebit: centsToDecimalString(validation.totalDebitCents),
          totalCredit: centsToDecimalString(validation.totalCreditCents),
        },
      },
    });

    return voucher;
  });

  return toVoucherDTO(created);
}

export async function updateDraftVoucher(
  id: string,
  input: VoucherInput,
  actor = "system",
): Promise<VoucherDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucherId = BigInt(id);

  const validation = validateVoucherInput(input, {
    requireBalanced: false,
    requireLines: false,
  });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }

  if (validation.lines.length) {
    await assertAccountsUsable(
      companyId,
      validation.lines.map((l) => l.accountId),
      false,
    );
  }

  const voucherDate = parseVoucherDate(input.voucherDate)!;

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: voucherInclude,
    });
    if (!before) throw new Error("Voucher not found.");
    if (before.status !== "DRAFT") {
      throw new Error("Only draft vouchers can be edited. Unpost first if this voucher is posted.");
    }
    assertManualVoucher(before);

    await tx.voucherLine.deleteMany({ where: { voucherId } });

    const voucher = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        voucherType: input.voucherType,
        voucherDate,
        referenceNo: input.referenceNo?.trim() || null,
        partyId: input.partyId ? BigInt(input.partyId) : null,
        partyName: input.partyName?.trim() || null,
        partyNtn: input.partyNtn?.trim() || null,
        whtApplicable: Boolean(input.whtApplicable),
        narration: input.narration?.trim() || null,
        lines: {
          create: validation.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            lineNarration: line.lineNarration,
          })),
        },
      },
      include: voucherInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UPDATE",
        entity: "Voucher",
        recordId: voucher.id.toString(),
        oldValue: { status: before.status, voucherNo: before.voucherNo },
        newValue: {
          status: voucher.status,
          voucherNo: voucher.voucherNo,
          totalDebit: centsToDecimalString(validation.totalDebitCents),
          totalCredit: centsToDecimalString(validation.totalCreditCents),
        },
      },
    });

    return voucher;
  });

  return toVoucherDTO(updated);
}

export async function postVoucher(id: string, actor = "system"): Promise<VoucherDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucherId = BigInt(id);

  const posted = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: voucherInclude,
    });
    if (!voucher) throw new Error("Voucher not found.");
    if (voucher.status !== "DRAFT") {
      throw new Error("Only draft vouchers can be posted.");
    }

    const input: VoucherInput = {
      voucherType: voucher.voucherType as VoucherTypeValue,
      voucherDate: voucher.voucherDate.toISOString().slice(0, 10),
      referenceNo: voucher.referenceNo,
      partyName: voucher.partyName,
      narration: voucher.narration,
      lines: voucher.lines.map((line) => ({
        accountId: line.accountId.toString(),
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        lineNarration: line.lineNarration,
      })),
    };

    const validation = validateVoucherInput(input, {
      requireBalanced: true,
      requireLines: true,
    });
    if (validation.errors.length) {
      throw new Error(validation.errors.join(" "));
    }

    await assertAccountsUsable(
      companyId,
      validation.lines.map((l) => l.accountId),
      true,
    );

    const updated = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "POSTED",
        postedBy: actor,
        postedAt: new Date(),
      },
      include: voucherInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "POST",
        entity: "Voucher",
        recordId: updated.id.toString(),
        oldValue: { status: "DRAFT" },
        newValue: {
          status: "POSTED",
          voucherNo: updated.voucherNo,
          totalDebit: centsToDecimalString(validation.totalDebitCents),
          totalCredit: centsToDecimalString(validation.totalCreditCents),
        },
      },
    });

    return updated;
  });

  return toVoucherDTO(posted);
}

export async function cancelVoucher(id: string, actor = "system"): Promise<VoucherDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucherId = BigInt(id);

  const cancelled = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: voucherInclude,
    });
    if (!voucher) throw new Error("Voucher not found.");
    assertManualVoucher(voucher);
    if (voucher.status !== "POSTED") {
      throw new Error("Only posted vouchers can be cancelled.");
    }

    const updated = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "CANCELLED",
        cancelledBy: actor,
        cancelledAt: new Date(),
      },
      include: voucherInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CANCEL",
        entity: "Voucher",
        recordId: updated.id.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "CANCELLED", voucherNo: updated.voucherNo },
      },
    });

    return updated;
  });

  return toVoucherDTO(cancelled);
}

/** Create draft then immediately post in one flow (used by UI Post button). */
export async function createAndPostVoucher(
  input: VoucherInput,
  actor = "system",
): Promise<VoucherDTO> {
  const validation = validateVoucherInput(input, {
    requireBalanced: true,
    requireLines: true,
  });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }
  const draft = await createDraftVoucher(input, actor);
  return postVoucher(draft.id, actor);
}

/** Return a posted voucher to DRAFT so it can be edited. Does not rewrite posted history in place. */
export async function unpostVoucher(id: string, actor = "system"): Promise<VoucherDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucherId = BigInt(id);

  const unposted = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: voucherInclude,
    });
    if (!voucher) throw new Error("Voucher not found.");
    assertManualVoucher(voucher);
    if (voucher.status !== "POSTED") {
      throw new Error("Only posted vouchers can be unposted.");
    }

    const updated = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "DRAFT",
        postedBy: null,
        postedAt: null,
      },
      include: voucherInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UNPOST",
        entity: "Voucher",
        recordId: updated.id.toString(),
        oldValue: { status: "POSTED", voucherNo: voucher.voucherNo },
        newValue: { status: "DRAFT", voucherNo: updated.voucherNo },
      },
    });

    return updated;
  });

  return toVoucherDTO(unposted);
}

/** Permanently delete a draft voucher (and attachments). Posted documents must be unposted first. */
export async function deleteDraftVoucher(id: string, actor = "system"): Promise<void> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucherId = BigInt(id);

  const { storageKeys } = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: voucherInclude,
    });
    if (!voucher) throw new Error("Voucher not found.");
    assertManualVoucher(voucher);
    if (voucher.status !== "DRAFT") {
      throw new Error("Only draft vouchers can be deleted. Unpost first if this voucher is posted.");
    }

    const storageKeys = voucher.attachments.map((row) => row.storageKey);

    await tx.voucher.delete({ where: { id: voucherId } });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "DELETE",
        entity: "Voucher",
        recordId: voucherId.toString(),
        oldValue: {
          voucherNo: voucher.voucherNo,
          status: voucher.status,
          voucherType: voucher.voucherType,
        },
      },
    });

    return { storageKeys };
  });

  const { deleteStoredAttachment } = await import("@/lib/attachments/storage");
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await deleteStoredAttachment(key);
      } catch {
        // DB row is already gone; leftover files are non-fatal.
      }
    }),
  );
}
