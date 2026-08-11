/** Client-safe attachment constraints (no Node / Blob SDK imports). */

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".csv",
  ".xls",
  ".xlsx",
] as const;
