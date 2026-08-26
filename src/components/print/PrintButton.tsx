"use client";

import { printDocument, type PrintOrientation } from "@/lib/print/page";

type PrintButtonProps = {
  label?: string;
  disabled?: boolean;
  className?: string;
  orientation?: PrintOrientation;
};

/** Shared browser print trigger used across forms, lists, and reports. */
export function PrintButton({
  label = "Print",
  disabled = false,
  className = "btn-secondary",
  orientation = "portrait",
}: PrintButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => printDocument(orientation)}
    >
      {label}
    </button>
  );
}
