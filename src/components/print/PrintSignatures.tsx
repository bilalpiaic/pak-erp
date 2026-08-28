"use client";

import { useEffect, useState } from "react";

type PrintSignaturesProps = {
  columns?: Array<{ label: string }>;
  printedNote?: string | null;
};

const DEFAULT_COLUMNS = [
  { label: "Prepared by" },
  { label: "Checked by" },
  { label: "Approved by" },
];

export function PrintSignatures({
  columns = DEFAULT_COLUMNS,
  printedNote,
}: PrintSignaturesProps) {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    if (printedNote) return;
    setStamp(`Printed ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  }, [printedNote]);

  const printed = printedNote ?? stamp ?? "Printed from GarmentLoop ERP";

  return (
    <footer className="print-footer">
      <div
        className="print-signatures"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <div key={col.label} className="print-sign-line">
            {col.label}
          </div>
        ))}
      </div>
      <div className="print-printed-note">{printed}</div>
    </footer>
  );
}
