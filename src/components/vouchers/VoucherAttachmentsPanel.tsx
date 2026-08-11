"use client";

import { useRef, useState, useTransition } from "react";

import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
} from "@/lib/attachments/constants";
import type { VoucherAttachmentDTO } from "@/lib/vouchers/types";

type VoucherAttachmentsPanelProps = {
  voucherId: string | null;
  status: string | null;
  initialAttachments?: VoucherAttachmentDTO[];
  /** When true, hide upload/delete controls */
  readOnly?: boolean;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function VoucherAttachmentsPanel({
  voucherId,
  status,
  initialAttachments = [],
  readOnly = false,
}: VoucherAttachmentsPanelProps) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload = Boolean(voucherId) && status !== "CANCELLED" && !readOnly;
  const canDelete = Boolean(voucherId) && status === "DRAFT" && !readOnly;
  const accept = ALLOWED_ATTACHMENT_EXTENSIONS.join(",");

  function refresh() {
    if (!voucherId) return;
    startTransition(async () => {
      try {
        const response = await fetch(`/api/vouchers/${voucherId}/attachments`);
        const data = (await response.json()) as {
          attachments?: VoucherAttachmentDTO[];
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Failed to load attachments.");
          return;
        }
        setAttachments(data.attachments ?? []);
        setError(null);
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  async function onFileChange(fileList: FileList | null) {
    if (!voucherId || !fileList?.length) return;
    setError(null);
    setMessage(null);

    const file = fileList[0];
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setError("File exceeds the 10 MB limit.");
      return;
    }

    const body = new FormData();
    body.append("file", file);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/vouchers/${voucherId}/attachments`, {
          method: "POST",
          body,
        });
        const data = (await response.json()) as {
          attachment?: VoucherAttachmentDTO;
          error?: string;
        };
        if (!response.ok || !data.attachment) {
          setError(data.error ?? "Upload failed.");
          return;
        }
        setAttachments((prev) => [data.attachment!, ...prev]);
        setMessage(`Attached ${data.attachment.fileName}`);
        if (inputRef.current) inputRef.current.value = "";
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  async function remove(attachmentId: string) {
    if (!voucherId) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/vouchers/${voucherId}/attachments/${attachmentId}`,
          { method: "DELETE" },
        );
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Delete failed.");
          return;
        }
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        setMessage("Attachment removed.");
      } catch {
        setError("Unable to reach the server.");
      }
    });
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Attachments</h3>
          <p className="text-[11px] text-[var(--muted)]">
            PDF, JPG, PNG, DOC/DOCX, CSV, Excel · max 10 MB
          </p>
        </div>
        {voucherId ? (
          <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>
            Refresh
          </button>
        ) : null}
      </div>

      {!voucherId ? (
        <p className="text-sm text-[var(--muted)]">
          Save the voucher first, then attach supporting documents.
        </p>
      ) : (
        <>
          {canUpload ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                disabled={pending}
                onChange={(e) => onFileChange(e.target.files)}
                className="field-input max-w-md"
              />
              {pending ? (
                <span className="text-[11px] text-[var(--muted)]">Working…</span>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mb-2 border border-red-200 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-2 text-sm text-[var(--success)]">{message}</p>
          ) : null}

          {attachments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No attachments yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border border-[var(--border)]">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <a
                      href={file.storageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {file.fileName}
                    </a>
                    <div className="text-[11px] text-[var(--muted)]">
                      {formatBytes(file.sizeBytes)} · {file.mimeType || "file"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={file.storageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary px-2 py-1"
                    >
                      Open
                    </a>
                    {canDelete ? (
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1"
                        disabled={pending}
                        onClick={() => remove(file.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
