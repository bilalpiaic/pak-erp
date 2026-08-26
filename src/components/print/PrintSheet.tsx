import type { ReactNode } from "react";

import type { PrintOrientation } from "@/lib/print/page";

type PrintSheetProps = {
  orientation?: PrintOrientation;
  children: ReactNode;
  className?: string;
};

export function PrintSheet({
  orientation = "portrait",
  children,
  className = "",
}: PrintSheetProps) {
  return (
    <div
      className={`print-sheet print-sheet-${orientation} ${className}`.trim()}
      data-print-orientation={orientation}
    >
      {children}
    </div>
  );
}
