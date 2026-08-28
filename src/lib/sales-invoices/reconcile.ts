import type { Prisma, SalesInvoice, SalesInvoiceLine, Voucher, VoucherLine } from "@/generated/prisma/client";
import { centsToDecimalString, toCents } from "@/lib/accounting/money";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { adjustPartyOutstanding } from "@/lib/parties/outstanding";

import { resolvePostingAccounts, syncVoucherGl } from "./service";
import type { NormalizedInvoiceLine } from "./validation";
import type {
  SiReconcileIssue,
  SiReconcileResult,
} from "./reconcile-types";

export type { SiReconcileIssue, SiReconcileIssueKind, SiReconcileResult } from "./reconcile-types";

type InvoiceRow = SalesInvoice & {
  lines: SalesInvoiceLine[];
  voucher: (Voucher & { lines: VoucherLine[] }) | null;
};

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found. Create a company in Settings first.");
  return BigInt(company.id);
}

function money(value: { toString(): string } | string | null | undefined): string {
  return centsToDecimalString(toCents(value?.toString() ?? "0") ?? 0);
}

function voucherDebit(voucher: { lines: VoucherLine[] } | null): string {
  if (!voucher) return "0.00";
  const cents = voucher.lines.reduce((sum, line) => sum + (toCents(line.debit.toString()) ?? 0), 0);
  return centsToDecimalString(cents);
}

function toNormalizedLines(invoice: InvoiceRow): NormalizedInvoiceLine[] {
  return invoice.lines
    .slice()
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((line) => ({
      item: line.item,
      detail: line.detail,
      quantity: line.quantity.toString(),
      rate: line.rate.toString(),
      amount: money(line.amount),
      amountCents: toCents(line.amount.toString()) ?? 0,
    }));
}

function collectIssues(invoice: InvoiceRow, voucher: (Voucher & { lines: VoucherLine[] }) | null): SiReconcileIssue[] {
  const issues: SiReconcileIssue[] = [];
  const base = {
    invoiceId: invoice.id.toString(),
    invoiceNo: invoice.invoiceNo,
    voucherId: voucher?.id.toString(),
    voucherNo: voucher?.voucherNo,
  };

  if (!voucher) {
    if (invoice.status !== "DRAFT" || invoice.voucherId) {
      issues.push({
        ...base,
        kind: "missing_voucher",
        detail: `Invoice ${invoice.invoiceNo} (${invoice.status}) has no linked SI voucher.`,
      });
    }
    return issues;
  }

  if (voucher.voucherType !== "SI") {
    issues.push({
      ...base,
      kind: "type_mismatch",
      detail: `Linked voucher ${voucher.voucherNo} is ${voucher.voucherType}, expected SI.`,
    });
  }
  if (voucher.status !== invoice.status) {
    issues.push({
      ...base,
      kind: "status_mismatch",
      detail: `Invoice is ${invoice.status} but SI voucher ${voucher.voucherNo} is ${voucher.status}.`,
    });
  }
  const invAmt = money(invoice.totalAmount);
  const vAmt = voucherDebit(voucher);
  if (invoice.status !== "DRAFT" && invAmt !== vAmt) {
    issues.push({
      ...base,
      kind: "amount_mismatch",
      detail: `Invoice ${invoice.invoiceNo} amount ${invAmt} vs SI voucher ${vAmt}.`,
    });
  }
  if (voucher.partyId && voucher.partyId !== invoice.partyId) {
    issues.push({
      ...base,
      kind: "party_mismatch",
      detail: `SI voucher party does not match invoice ${invoice.invoiceNo}.`,
    });
  }
  if (invoice.voucherId && invoice.voucherId !== voucher.id) {
    issues.push({
      ...base,
      kind: "link_mismatch",
      detail: `Invoice voucher_id does not match SI voucher ${voucher.voucherNo}.`,
    });
  }
  return issues;
}

async function applyVoucherStatus(
  tx: Prisma.TransactionClient,
  voucherId: bigint,
  status: SalesInvoice["status"],
  invoice: InvoiceRow,
): Promise<void> {
  if (status === "POSTED") {
    await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "POSTED",
        postedAt: invoice.postedAt ?? new Date(),
        postedBy: invoice.postedBy ?? "reconcile",
        cancelledAt: null,
        cancelledBy: null,
      },
    });
    return;
  }
  if (status === "CANCELLED") {
    await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: "CANCELLED",
        cancelledAt: invoice.cancelledAt ?? new Date(),
        cancelledBy: invoice.cancelledBy ?? "reconcile",
      },
    });
    return;
  }
  await tx.voucher.update({
    where: { id: voucherId },
    data: {
      status: "DRAFT",
      postedAt: null,
      postedBy: null,
      cancelledAt: null,
      cancelledBy: null,
    },
  });
}

/** Audit (and optionally repair) sales invoices against their SI vouchers. */
export async function reconcileSalesInvoiceVouchers(
  options: { dryRun?: boolean } = {},
  actor = "system",
): Promise<SiReconcileResult> {
  const dryRun = Boolean(options.dryRun);
  const prisma = getPrisma();
  const companyId = await requireCompanyId();

  const [invoices, siVouchers] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { companyId },
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        voucher: { include: { lines: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.voucher.findMany({
      where: { companyId, voucherType: "SI" },
      include: { lines: true, salesInvoice: { select: { id: true, invoiceNo: true } } },
      orderBy: { id: "asc" },
    }),
  ]);

  const issues: SiReconcileIssue[] = [];
  const linkedVoucherIds = new Set<string>();
  const invoiceByNo = new Map(invoices.map((row) => [row.invoiceNo.toLowerCase(), row]));

  for (const invoice of invoices) {
    issues.push(...collectIssues(invoice, invoice.voucher));
    if (invoice.voucher) linkedVoucherIds.add(invoice.voucher.id.toString());
  }

  for (const voucher of siVouchers) {
    if (voucher.salesInvoice) {
      linkedVoucherIds.add(voucher.id.toString());
      continue;
    }
    const match = invoiceByNo.get(voucher.voucherNo.toLowerCase());
    if (match && !match.voucherId) {
      issues.push({
        kind: "link_mismatch",
        invoiceId: match.id.toString(),
        invoiceNo: match.invoiceNo,
        voucherId: voucher.id.toString(),
        voucherNo: voucher.voucherNo,
        detail: `SI voucher ${voucher.voucherNo} is unlinked but matches invoice ${match.invoiceNo}.`,
      });
      continue;
    }
    issues.push({
      kind: "orphan_voucher",
      voucherId: voucher.id.toString(),
      voucherNo: voucher.voucherNo,
      detail: `SI voucher ${voucher.voucherNo} has no sales invoice.`,
    });
  }

  if (dryRun) {
    return {
      dryRun: true,
      invoiceCount: invoices.length,
      siVoucherCount: siVouchers.length,
      issues,
      repaired: 0,
      skipped: issues.length,
      deleted: 0,
    };
  }

  let repaired = 0;
  let skipped = 0;
  const { debtors, sales } = await resolvePostingAccounts(companyId);

  for (const invoice of invoices) {
    const before = collectIssues(invoice, invoice.voucher);
    const matchByNo =
      !invoice.voucherId && invoiceByNo
        ? siVouchers.find(
            (v) =>
              !v.salesInvoice && v.voucherNo.toLowerCase() === invoice.invoiceNo.toLowerCase(),
          )
        : null;

    if (before.length === 0 && !matchByNo) continue;
    if (invoice.lines.length === 0 && invoice.status !== "DRAFT") {
      skipped += 1;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        let voucherId = invoice.voucherId ?? matchByNo?.id ?? null;
        const lines = toNormalizedLines(invoice);
        const totalAmount = money(invoice.totalAmount);

        if (lines.length > 0) {
          voucherId = await syncVoucherGl(tx, {
            companyId,
            voucherId,
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate,
            partyId: invoice.partyId,
            partyName: invoice.partyName,
            partyNtn: invoice.partyNtn,
            poNumber: invoice.poNumber,
            narration: invoice.narration,
            lines,
            totalAmount,
            debtorsId: debtors.id,
            salesId: sales.id,
          });
        } else if (!voucherId) {
          return;
        }

        if (voucherId) {
          await applyVoucherStatus(tx, voucherId, invoice.status, invoice);
          if (invoice.voucherId !== voucherId) {
            await tx.salesInvoice.update({
              where: { id: invoice.id },
              data: { voucherId },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            companyId,
            actor,
            action: "UPDATE",
            entity: "SalesInvoice",
            recordId: invoice.id.toString(),
            oldValue: {
              voucherId: invoice.voucherId?.toString() ?? null,
              voucherStatus: invoice.voucher?.status ?? null,
            },
            newValue: {
              voucherId: voucherId?.toString() ?? null,
              issues: before.map((issue) => issue.kind),
            },
          },
        });
      });
      repaired += 1;
    } catch (error) {
      skipped += 1;
      issues.push({
        kind: "missing_voucher",
        invoiceId: invoice.id.toString(),
        invoiceNo: invoice.invoiceNo,
        detail: error instanceof Error ? error.message : "Failed to repair invoice.",
      });
    }
  }

  const remaining = await auditOnly();
  return {
    dryRun: false,
    invoiceCount: invoices.length,
    siVoucherCount: siVouchers.length,
    issues: remaining.issues,
    repaired,
    skipped,
    deleted: 0,
  };

  async function auditOnly(): Promise<{ issues: SiReconcileIssue[] }> {
    const [freshInvoices, freshVouchers] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { companyId },
        include: {
          lines: { orderBy: { lineNo: "asc" } },
          voucher: { include: { lines: true } },
        },
      }),
      prisma.voucher.findMany({
        where: { companyId, voucherType: "SI" },
        include: { salesInvoice: { select: { id: true } } },
      }),
    ]);
    const next: SiReconcileIssue[] = [];
    for (const invoice of freshInvoices) {
      next.push(...collectIssues(invoice, invoice.voucher));
    }
    for (const voucher of freshVouchers) {
      if (!voucher.salesInvoice) {
        next.push({
          kind: "orphan_voucher",
          voucherId: voucher.id.toString(),
          voucherNo: voucher.voucherNo,
          detail: `SI voucher ${voucher.voucherNo} has no sales invoice.`,
        });
      }
    }
    return { issues: next };
  }
}

function parseVoucherIds(ids: string[]): bigint[] {
  try {
    return ids.map((id) => BigInt(id));
  } catch {
    throw new Error(
      "One or more vouchers are not orphan SI vouchers (they may be linked to a sales invoice).",
    );
  }
}

function matchesUnlinkedInvoice(
  voucherNo: string,
  invoiceByNo: Map<string, { voucherId: bigint | null }>,
): boolean {
  const match = invoiceByNo.get(voucherNo.toLowerCase());
  return Boolean(match && !match.voucherId);
}

/** Permanently delete SI vouchers that have no sales invoice. Posted orphans reverse party outstanding. */
export async function deleteOrphanSiVouchers(
  options: { voucherIds?: string[] } = {},
  actor = "system",
): Promise<SiReconcileResult> {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const requested = (options.voucherIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);

  const invoices = await prisma.salesInvoice.findMany({
    where: { companyId },
    select: { invoiceNo: true, voucherId: true },
  });
  const invoiceByNo = new Map(
    invoices.map((row) => [row.invoiceNo.toLowerCase(), row]),
  );

  const unlinked = await prisma.voucher.findMany({
    where: {
      companyId,
      voucherType: "SI",
      salesInvoice: { is: null },
      ...(requested.length ? { id: { in: parseVoucherIds(requested) } } : {}),
    },
    include: {
      lines: true,
      attachments: { select: { storageKey: true } },
      salesInvoice: { select: { id: true } },
    },
  });

  if (requested.length) {
    const found = new Set(unlinked.map((row) => row.id.toString()));
    const missing = requested.filter((id) => !found.has(id));
    if (missing.length) {
      throw new Error(
        "One or more vouchers are not orphan SI vouchers (they may be linked to a sales invoice).",
      );
    }
    if (unlinked.some((row) => matchesUnlinkedInvoice(row.voucherNo, invoiceByNo))) {
      throw new Error(
        "Those SI vouchers match a sales invoice by number. Use Reconcile SI vouchers instead of deleting them.",
      );
    }
  }

  const orphans = unlinked.filter(
    (row) => !row.salesInvoice && !matchesUnlinkedInvoice(row.voucherNo, invoiceByNo),
  );

  let deleted = 0;
  const storageKeys: string[] = [];

  for (const voucher of orphans) {
    if (voucher.salesInvoice) continue;
    await prisma.$transaction(async (tx) => {
      if (voucher.status === "POSTED" && voucher.partyId) {
        const debitCents = voucher.lines.reduce(
          (sum, line) => sum + (toCents(line.debit.toString()) ?? 0),
          0,
        );
        if (debitCents) {
          await adjustPartyOutstanding(tx, {
            partyId: voucher.partyId,
            companyId,
            deltaCents: -debitCents,
          });
        }
      }

      await tx.voucher.delete({ where: { id: voucher.id } });
      await tx.auditLog.create({
        data: {
          companyId,
          actor,
          action: "DELETE",
          entity: "Voucher",
          recordId: voucher.id.toString(),
          oldValue: {
            voucherNo: voucher.voucherNo,
            voucherType: voucher.voucherType,
            status: voucher.status,
            orphan: true,
          },
        },
      });
    });
    storageKeys.push(...voucher.attachments.map((row) => row.storageKey));
    deleted += 1;
  }

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

  const remaining = await reconcileSalesInvoiceVouchers({ dryRun: true });
  return {
    ...remaining,
    dryRun: false,
    repaired: 0,
    skipped: remaining.issues.length,
    deleted,
  };
}
