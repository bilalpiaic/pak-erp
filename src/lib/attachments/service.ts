import type { VoucherAttachment } from "@/generated/prisma/client";
import {
  deleteStoredAttachment,
  storeAttachment,
  validateAttachmentFile,
} from "@/lib/attachments/storage";
import { getPrimaryCompany } from "@/lib/company/service";
import { getPrisma } from "@/lib/db/prisma";
import { serialize } from "@/lib/db/serialize";

export type AttachmentDTO = {
  id: string;
  voucherId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  uploadedBy: string | null;
  createdAt: string;
};

function toDTO(row: VoucherAttachment): AttachmentDTO {
  return serialize({
    id: row.id.toString(),
    voucherId: row.voucherId.toString(),
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageUrl: row.storageUrl,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  });
}

async function requireCompanyId(): Promise<bigint> {
  const company = await getPrimaryCompany();
  if (!company) throw new Error("No company found.");
  return BigInt(company.id);
}

async function requireVoucher(voucherId: string) {
  const prisma = getPrisma();
  const companyId = await requireCompanyId();
  const voucher = await prisma.voucher.findFirst({
    where: { id: BigInt(voucherId), companyId },
  });
  if (!voucher) throw new Error("Voucher not found.");
  return voucher;
}

export async function listAttachments(voucherId: string): Promise<AttachmentDTO[]> {
  await requireVoucher(voucherId);
  const prisma = getPrisma();
  const rows = await prisma.voucherAttachment.findMany({
    where: { voucherId: BigInt(voucherId) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function uploadAttachment(
  voucherId: string,
  file: File,
): Promise<AttachmentDTO> {
  const voucher = await requireVoucher(voucherId);
  if (voucher.status === "CANCELLED") {
    throw new Error("Cannot attach files to a cancelled voucher.");
  }

  const validationError = validateAttachmentFile(file);
  if (validationError) throw new Error(validationError);

  const stored = await storeAttachment(voucherId, file);
  const prisma = getPrisma();
  const row = await prisma.voucherAttachment.create({
    data: {
      voucherId: BigInt(voucherId),
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.storageKey,
      storageUrl: stored.storageUrl,
      uploadedBy: "system",
    },
  });
  return toDTO(row);
}

export async function deleteAttachment(
  voucherId: string,
  attachmentId: string,
): Promise<void> {
  const voucher = await requireVoucher(voucherId);
  if (voucher.status !== "DRAFT") {
    throw new Error("Attachments can only be removed from draft vouchers.");
  }

  const prisma = getPrisma();
  const row = await prisma.voucherAttachment.findFirst({
    where: { id: BigInt(attachmentId), voucherId: BigInt(voucherId) },
  });
  if (!row) throw new Error("Attachment not found.");

  await deleteStoredAttachment(row.storageKey);
  await prisma.voucherAttachment.delete({ where: { id: row.id } });
}
