import { put, del } from "@vercel/blob";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
} from "@/lib/attachments/constants";

export { ALLOWED_ATTACHMENT_EXTENSIONS, ATTACHMENT_MAX_BYTES };

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // browsers sometimes send this; gate by extension
]);

export type StoredFile = {
  storageKey: string;
  storageUrl: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
};

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

export function validateAttachmentFile(file: File): string | null {
  if (!file || !file.name?.trim()) return "File is required.";
  if (file.size <= 0) return "File is empty.";
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return "File exceeds the 10 MB limit.";
  }
  const ext = extensionOf(file.name);
  if (
    !ALLOWED_ATTACHMENT_EXTENSIONS.includes(
      ext as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
    )
  ) {
    return `Unsupported file type. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`;
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    // Still allow if extension is valid (Excel/DOC often mislabeled).
    if (file.type !== "" && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      // reject clearly wrong types like video/*
      if (
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/") ||
        file.type.startsWith("font/")
      ) {
        return "Unsupported MIME type.";
      }
    }
  }
  return null;
}

function localUploadDir(): string {
  return path.join(process.cwd(), ".data", "uploads");
}

/**
 * Store an uploaded file in Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise fall back to local `.data/uploads` (dev / cloud agent).
 */
export async function storeAttachment(
  voucherId: string,
  file: File,
): Promise<StoredFile> {
  const fileName = file.name.trim().replace(/[\\/]/g, "_");
  const mimeType = file.type || "application/octet-stream";
  const sizeBytes = file.size;
  const key = `vouchers/${voucherId}/${randomUUID()}-${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buffer, {
      access: "public",
      contentType: mimeType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      storageKey: key,
      storageUrl: blob.url,
      sizeBytes,
      mimeType,
      fileName,
    };
  }

  const dir = path.join(localUploadDir(), "vouchers", voucherId);
  await mkdir(dir, { recursive: true });
  const diskName = `${randomUUID()}-${fileName}`;
  const diskPath = path.join(dir, diskName);
  await writeFile(diskPath, buffer);
  const storageKey = `local:vouchers/${voucherId}/${diskName}`;
  const storageUrl = `/api/uploads/vouchers/${voucherId}/${encodeURIComponent(diskName)}`;

  return {
    storageKey,
    storageUrl,
    sizeBytes,
    mimeType,
    fileName,
  };
}

export async function deleteStoredAttachment(storageKey: string): Promise<void> {
  if (storageKey.startsWith("local:")) {
    const relative = storageKey.slice("local:".length);
    const diskPath = path.join(localUploadDir(), relative);
    try {
      await unlink(diskPath);
    } catch {
      // ignore missing file
    }
    return;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // Blob delete by pathname may need full URL; ignore if already gone
    }
  }
}
