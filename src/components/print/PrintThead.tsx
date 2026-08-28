import type { ReactNode } from "react";

type PrintTheadProps = {
  colSpan: number;
  banner?: ReactNode;
  children: ReactNode;
};

/** Letterhead + column headers in one thead so both repeat on every printed page. */
export function PrintThead({ colSpan, banner, children }: PrintTheadProps) {
  return (
    <thead>
      {banner ? (
        <tr className="print-banner">
          <th colSpan={colSpan}>{banner}</th>
        </tr>
      ) : null}
      <tr>{children}</tr>
    </thead>
  );
}
