"use client";

type PrintButtonProps = {
  label?: string;
  disabled?: boolean;
  className?: string;
};

/** Shared browser print trigger used across forms, lists, and reports. */
export function PrintButton({
  label = "Print",
  disabled = false,
  className = "btn-secondary",
}: PrintButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
