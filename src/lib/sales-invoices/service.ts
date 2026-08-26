import type { Prisma, SalesInvoice, SalesInvoiceLine } from "@/generated/prisma/client";
import { ACCOUNT_CODES } from "@/lib/accounts/codes";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";
import { adjustPartyOutstanding } from "@/lib/parties/outstanding";
import { nextVoucherNo } from "@/lib/vouchers/service";

import type {
  SalesInvoiceDTO,
  SalesInvoiceInput,
  SalesInvoiceListQuery,
} from "./types";
import {
  parseInvoiceDate,
  validateSalesInvoiceInput,
  type NormalizedInvoiceLine,
} from "./validation";

type InvoiceWithRelations = SalesInvoice & {
  lines: SalesInvoiceLine[];
  voucher: { id: bigint; voucherNo: string; status: string } | null;
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) {
    throw new Error("No company found. Create a company in Settings first.");
  }
  return BigInt(company.id);
}

function decimalString(value: { toString(): string }, scale = 2): string {
  if (scale === 2) {
    const cents = toCents(value.toString());
    return centsToDecimalString(cents ?? 0);
  }
  const n = Number(value.toString());
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(4).replace(/\.?0+$/, "");
  return fixed.includes(".") ? fixed : `${fixed}.0`;
}

function toInvoiceDTO(row: InvoiceWithRelations): SalesInvoiceDTO {
  return serialize({
    id: row.id.toString(),
    companyId: row.companyId.toString(),
    voucherId: row.voucherId?.toString() ?? null,
    voucherNo: row.voucher?.voucherNo ?? null,
    invoiceNo: row.invoiceNo,
    invoiceDate: row.invoiceDate.toISOString().slice(0, 10),
    partyId: row.partyId.toString(),
    partyName: row.partyName,
    partyNtn: row.partyNtn,
    poNumber: row.poNumber,
    narration: row.narration,
    status: row.status,
    totalAmount: decimalString(row.totalAmount),
    createdBy: row.createdBy,
    postedBy: row.postedBy,
    cancelledBy: row.cancelledBy,
    createdAt: row.createdAt.toISOString(),
    postedAt: row.postedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((line) => ({
        id: line.id.toString(),
        lineNo: line.lineNo,
        item: line.item,
        detail: line.detail,
        quantity: decimalString(line.quantity, 4),
        rate: decimalString(line.rate, 4),
        amount: decimalString(line.amount),
      })),
  });
}

const invoiceInclude = {
  lines: { orderBy: { lineNo: "asc" as const } },
  voucher: { select: { id: true, voucherNo: true, status: true } },
};

async function nextInvoiceNo(companyId: bigint): Promise<string> {
  const prisma = getPrisma();
  const latest = await prisma.salesInvoice.findMany({
    where: { companyId },
    select: { invoiceNo: true },
    orderBy: { id: "desc" },
    take: 200,
  });

  let max = 0;
  const prefix = "SI-";
  for (const row of latest) {
    if (!row.invoiceNo.startsWith(prefix)) continue;
    const numeric = Number(row.invoiceNo.slice(prefix.length));
    if (Number.isFinite(numeric)) max = Math.max(max, numeric);
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function resolvePostingAccounts(companyId: bigint) {
  const prisma = getPrisma();
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      code: { in: [ACCOUNT_CODES.TRADE_DEBTORS, ACCOUNT_CODES.SALES_TAXABLE] },
    },
    select: { id: true, code: true, name: true, isActive: true },
  });

  const debtors = accounts.find((a) => a.code === ACCOUNT_CODES.TRADE_DEBTORS);
  const sales = accounts.find((a) => a.code === ACCOUNT_CODES.SALES_TAXABLE);

  if (!debtors || !sales) {
    throw new Error(
      `Required accounts missing: need ${ACCOUNT_CODES.TRADE_DEBTORS} Trade Debtors and ${ACCOUNT_CODES.SALES_TAXABLE} Sales.`,
    );
  }
  if (!debtors.isActive || !sales.isActive) {
    throw new Error(
      `Inactive posting account(s): ${[!debtors.isActive && debtors.code, !sales.isActive && sales.code]
        .filter(Boolean)
        .join(", ")}.`,
    );
  }

  return { debtors, sales };
}

async function loadParty(companyId: bigint, partyId: string) {
  const prisma = getPrisma();
  const party = await prisma.party.findFirst({
    where: { id: BigInt(partyId), companyId },
  });
  if (!party) throw new Error("Party not found.");
  if (!party.isActive) throw new Error("Party is inactive.");
  if (party.partyType === "Creditor") {
    throw new Error("Sales invoices require a Debtor or Both party.");
  }
  return party;
}

function lineNarration(lines: NormalizedInvoiceLine[]): string {
  if (lines.length === 1) {
    const only = lines[0];
    return only.detail ? `${only.item} — ${only.detail}` : only.item;
  }
  return `Sales invoice (${lines.length} lines)`;
}

async function syncVoucherGl(
  tx: Prisma.TransactionClient,
  args: {
    companyId: bigint;
    voucherId: bigint | null;
    invoiceNo: string;
    invoiceDate: Date;
    partyId: bigint;
    partyName: string;
    partyNtn: string | null;
    poNumber: string | null;
    narration: string | null;
    lines: NormalizedInvoiceLine[];
    totalAmount: string;
    debtorsId: bigint;
    salesId: bigint;
  },
): Promise<bigint> {
  const narration =
    args.narration?.trim() ||
    `Sales invoice ${args.invoiceNo} — ${args.partyName}`;
  const detail = lineNarration(args.lines);

  const voucherData = {
    voucherDate: args.invoiceDate,
    referenceNo: args.poNumber,
    partyId: args.partyId,
    partyName: args.partyName,
    partyNtn: args.partyNtn,
    narration,
    lines: {
      create: [
        {
          accountId: args.debtorsId,
          debit: args.totalAmount,
          credit: "0.00",
          lineNarration: detail,
        },
        {
          accountId: args.salesId,
          debit: "0.00",
          credit: args.totalAmount,
          lineNarration: detail,
        },
      ],
    },
  };

  if (args.voucherId) {
    await tx.voucherLine.deleteMany({ where: { voucherId: args.voucherId } });
    await tx.voucher.update({
      where: { id: args.voucherId },
      data: {
        voucherDate: voucherData.voucherDate,
        referenceNo: voucherData.referenceNo,
        partyId: voucherData.partyId,
        partyName: voucherData.partyName,
        partyNtn: voucherData.partyNtn,
        narration: voucherData.narration,
        lines: voucherData.lines,
      },
    });
    return args.voucherId;
  }

  const voucherNo = await nextVoucherNo("SI", args.companyId);
  const voucher = await tx.voucher.create({
    data: {
      companyId: args.companyId,
      voucherNo,
      voucherType: "SI",
      status: "DRAFT",
      createdBy: "system",
      ...voucherData,
      voucherDate: voucherData.voucherDate,
      referenceNo: voucherData.referenceNo,
      partyId: voucherData.partyId,
      partyName: voucherData.partyName,
      partyNtn: voucherData.partyNtn,
      narration: voucherData.narration,
      lines: voucherData.lines,
    },
  });
  return voucher.id;
}

export async function listSalesInvoices(
  query: SalesInvoiceListQuery = {},
): Promise<{ invoices: SalesInvoiceDTO[] }> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const where: Prisma.SalesInvoiceWhereInput = { companyId };

  if (query.status && query.status !== "All") {
    where.status = query.status as Prisma.EnumVoucherStatusFilter["equals"];
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { invoiceNo: { contains: search, mode: "insensitive" } },
      { partyName: { contains: search, mode: "insensitive" } },
      { poNumber: { contains: search, mode: "insensitive" } },
      { narration: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.salesInvoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
  });

  return { invoices: rows.map(toInvoiceDTO) };
}

export async function getSalesInvoice(id: string): Promise<SalesInvoiceDTO | null> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const row = await prisma.salesInvoice.findFirst({
    where: { id: BigInt(id), companyId },
    include: invoiceInclude,
  });
  return row ? toInvoiceDTO(row) : null;
}

export async function nextSalesInvoiceNo(): Promise<string> {
  return nextInvoiceNo(await requireCompanyId());
}

export async function createDraftSalesInvoice(
  input: SalesInvoiceInput,
  actor = "system",
): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const validation = validateSalesInvoiceInput(input, { requireLines: false });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }

  const party = await loadParty(companyId, input.partyId);
  const invoiceDate = parseInvoiceDate(input.invoiceDate)!;
  const invoiceNo = await nextInvoiceNo(companyId);
  const totalAmount = centsToDecimalString(validation.totalAmountCents);
  const { debtors, sales } = await resolvePostingAccounts(companyId);

  const created = await prisma.$transaction(async (tx) => {
    const voucherId =
      validation.lines.length > 0
        ? await syncVoucherGl(tx, {
            companyId,
            voucherId: null,
            invoiceNo,
            invoiceDate,
            partyId: party.id,
            partyName: party.name,
            partyNtn: party.ntn,
            poNumber: input.poNumber?.trim() || null,
            narration: input.narration?.trim() || null,
            lines: validation.lines,
            totalAmount,
            debtorsId: debtors.id,
            salesId: sales.id,
          })
        : null;

    const invoice = await tx.salesInvoice.create({
      data: {
        companyId,
        voucherId,
        invoiceNo,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        poNumber: input.poNumber?.trim() || null,
        narration: input.narration?.trim() || null,
        status: "DRAFT",
        totalAmount,
        createdBy: actor,
        lines: {
          create: validation.lines.map((line, index) => ({
            lineNo: index + 1,
            item: line.item,
            detail: line.detail,
            quantity: line.quantity,
            rate: line.rate,
            amount: line.amount,
          })),
        },
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CREATE",
        entity: "SalesInvoice",
        recordId: invoice.id.toString(),
        newValue: {
          invoiceNo: invoice.invoiceNo,
          status: invoice.status,
          totalAmount,
          partyName: party.name,
        },
      },
    });

    return invoice;
  });

  return toInvoiceDTO(created);
}

export async function updateDraftSalesInvoice(
  id: string,
  input: SalesInvoiceInput,
  actor = "system",
): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const validation = validateSalesInvoiceInput(input, { requireLines: false });
  if (validation.errors.length) {
    throw new Error(validation.errors.join(" "));
  }

  const party = await loadParty(companyId, input.partyId);
  const invoiceDate = parseInvoiceDate(input.invoiceDate)!;
  const totalAmount = centsToDecimalString(validation.totalAmountCents);
  const { debtors, sales } = await resolvePostingAccounts(companyId);

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!before) throw new Error("Sales invoice not found.");
    if (before.status !== "DRAFT") {
      throw new Error(
        "Only draft sales invoices can be edited. Unpost first if this invoice is posted.",
      );
    }

    await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: invoiceId } });

    let voucherId = before.voucherId;
    if (validation.lines.length > 0) {
      voucherId = await syncVoucherGl(tx, {
        companyId,
        voucherId,
        invoiceNo: before.invoiceNo,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        poNumber: input.poNumber?.trim() || null,
        narration: input.narration?.trim() || null,
        lines: validation.lines,
        totalAmount,
        debtorsId: debtors.id,
        salesId: sales.id,
      });
    } else if (voucherId) {
      await tx.voucherLine.deleteMany({ where: { voucherId } });
      await tx.voucher.update({
        where: { id: voucherId },
        data: {
          partyId: party.id,
          partyName: party.name,
          partyNtn: party.ntn,
          referenceNo: input.poNumber?.trim() || null,
          narration: input.narration?.trim() || null,
          voucherDate: invoiceDate,
        },
      });
    }

    const invoice = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        voucherId,
        invoiceDate,
        partyId: party.id,
        partyName: party.name,
        partyNtn: party.ntn,
        poNumber: input.poNumber?.trim() || null,
        narration: input.narration?.trim() || null,
        totalAmount,
        lines: {
          create: validation.lines.map((line, index) => ({
            lineNo: index + 1,
            item: line.item,
            detail: line.detail,
            quantity: line.quantity,
            rate: line.rate,
            amount: line.amount,
          })),
        },
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UPDATE",
        entity: "SalesInvoice",
        recordId: invoice.id.toString(),
        oldValue: { status: before.status, totalAmount: before.totalAmount.toString() },
        newValue: { status: invoice.status, totalAmount },
      },
    });

    return invoice;
  });

  return toInvoiceDTO(updated);
}

export async function postSalesInvoice(id: string, actor = "system"): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const posted = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new Error("Only draft sales invoices can be posted.");
    }

    const input: SalesInvoiceInput = {
      invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
      partyId: invoice.partyId.toString(),
      poNumber: invoice.poNumber,
      narration: invoice.narration,
      lines: invoice.lines.map((line) => ({
        item: line.item,
        detail: line.detail,
        quantity: line.quantity.toString(),
        rate: line.rate.toString(),
        amount: line.amount.toString(),
      })),
    };

    const validation = validateSalesInvoiceInput(input, { requireLines: true });
    if (validation.errors.length) {
      throw new Error(validation.errors.join(" "));
    }

    const { debtors, sales } = await resolvePostingAccounts(companyId);
    const totalAmount = centsToDecimalString(validation.totalAmountCents);

    const voucherId = await syncVoucherGl(tx, {
      companyId,
      voucherId: invoice.voucherId,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      partyId: invoice.partyId,
      partyName: invoice.partyName,
      partyNtn: invoice.partyNtn,
      poNumber: invoice.poNumber,
      narration: invoice.narration,
      lines: validation.lines,
      totalAmount,
      debtorsId: debtors.id,
      salesId: sales.id,
    });

    const voucher = await tx.voucher.findFirst({
      where: { id: voucherId, companyId },
      include: { lines: true },
    });
    if (!voucher || voucher.status !== "DRAFT") {
      throw new Error("Linked voucher is not available for posting.");
    }

    await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedBy: actor,
      },
    });

    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: validation.totalAmountCents,
    });

    await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        voucherId,
        status: "POSTED",
        totalAmount,
        postedAt: new Date(),
        postedBy: actor,
        lines: undefined,
      },
    });

    // Replace lines with validated ones in case they drifted
    await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: invoiceId } });
    await tx.salesInvoiceLine.createMany({
      data: validation.lines.map((line, index) => ({
        salesInvoiceId: invoiceId,
        lineNo: index + 1,
        item: line.item,
        detail: line.detail,
        quantity: line.quantity,
        rate: line.rate,
        amount: line.amount,
      })),
    });

    const finalRow = await tx.salesInvoice.findFirst({
      where: { id: invoiceId },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "POST",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "DRAFT" },
        newValue: {
          status: "POSTED",
          totalAmount,
          voucherNo: voucher.voucherNo,
          posting: `Dr ${ACCOUNT_CODES.TRADE_DEBTORS} / Cr ${ACCOUNT_CODES.SALES_TAXABLE}`,
        },
      },
    });

    return finalRow!;
  });

  return toInvoiceDTO(posted);
}

export async function cancelSalesInvoice(id: string, actor = "system"): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const cancelled = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "POSTED") {
      throw new Error("Only posted sales invoices can be cancelled.");
    }

    if (invoice.voucherId) {
      const voucher = await tx.voucher.findFirst({
        where: { id: invoice.voucherId, companyId },
      });
      if (voucher && voucher.status === "POSTED") {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledBy: actor,
          },
        });
      }
    }

    const amountCents = toCents(invoice.totalAmount.toString()) ?? 0;
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: -amountCents,
    });

    const updated = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: actor,
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "CANCEL",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: { status: "POSTED" },
        newValue: { status: "CANCELLED" },
      },
    });

    return updated;
  });

  return toInvoiceDTO(cancelled);
}

/** Return a posted sales invoice (and its SI voucher) to DRAFT so it can be edited. */
export async function unpostSalesInvoice(id: string, actor = "system"): Promise<SalesInvoiceDTO> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const unposted = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "POSTED") {
      throw new Error("Only posted sales invoices can be unposted.");
    }

    if (invoice.voucherId) {
      const voucher = await tx.voucher.findFirst({
        where: { id: invoice.voucherId, companyId },
      });
      if (voucher && voucher.status === "POSTED") {
        await tx.voucher.update({
          where: { id: voucher.id },
          data: {
            status: "DRAFT",
            postedAt: null,
            postedBy: null,
          },
        });
      } else if (voucher && voucher.status !== "DRAFT") {
        throw new Error("Linked voucher cannot be returned to draft.");
      }
    }

    const amountCents = toCents(invoice.totalAmount.toString()) ?? 0;
    await adjustPartyOutstanding(tx, {
      partyId: invoice.partyId,
      companyId,
      deltaCents: -amountCents,
    });

    const updated = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "DRAFT",
        postedAt: null,
        postedBy: null,
      },
      include: invoiceInclude,
    });

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "UNPOST",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: {
          status: "POSTED",
          invoiceNo: invoice.invoiceNo,
          totalAmount: invoice.totalAmount.toString(),
        },
        newValue: { status: "DRAFT", invoiceNo: updated.invoiceNo },
      },
    });

    return updated;
  });

  return toInvoiceDTO(unposted);
}

/** Permanently delete a draft sales invoice and its linked SI voucher. */
export async function deleteDraftSalesInvoice(id: string, actor = "system"): Promise<void> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const invoiceId = BigInt(id);

  const { storageKeys } = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: invoiceInclude,
    });
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status !== "DRAFT") {
      throw new Error(
        "Only draft sales invoices can be deleted. Unpost first if this invoice is posted.",
      );
    }

    const voucherId = invoice.voucherId;
    const attachments = voucherId
      ? await tx.voucherAttachment.findMany({
          where: { voucherId },
          select: { storageKey: true },
        })
      : [];
    const storageKeys = attachments.map((row) => row.storageKey);

    await tx.salesInvoice.delete({ where: { id: invoiceId } });
    if (voucherId) {
      await tx.voucher.delete({ where: { id: voucherId } });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        actor,
        action: "DELETE",
        entity: "SalesInvoice",
        recordId: invoiceId.toString(),
        oldValue: {
          invoiceNo: invoice.invoiceNo,
          status: invoice.status,
          voucherNo: invoice.voucher?.voucherNo ?? null,
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

export async function createAndPostSalesInvoice(
  input: SalesInvoiceInput,
  actor = "system",
): Promise<SalesInvoiceDTO> {
  const draft = await createDraftSalesInvoice(input, actor);
  return postSalesInvoice(draft.id, actor);
}
