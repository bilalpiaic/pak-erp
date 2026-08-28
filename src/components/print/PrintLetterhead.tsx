"use client";

import { useCompanyPrintInfo } from "@/components/print/CompanyPrintProvider";
import {
  mergeCompanyPrintInfo,
  type CompanyPrintInfo,
} from "@/lib/print/company";

type PrintLetterheadProps = {
  title: string;
  subtitle?: string | null;
  period?: string | null;
  extra?: string | null;
  company?: CompanyPrintInfo | null;
};

export function PrintLetterhead({
  title,
  subtitle,
  period,
  extra,
  company,
}: PrintLetterheadProps) {
  const ctx = useCompanyPrintInfo();
  const info = mergeCompanyPrintInfo(company, ctx);
  const meta = [
    info?.ntn ? `NTN ${info.ntn}` : null,
    info?.strn ? `STRN ${info.strn}` : null,
    info?.phone ? `Tel ${info.phone}` : null,
    info?.email ?? null,
  ].filter(Boolean);

  return (
    <header className="print-letterhead">
      <div className="print-letterhead-name">{info?.name || "GarmentLoop ERP"}</div>
      {info?.address ? <div className="print-letterhead-meta">{info.address}</div> : null}
      {meta.length > 0 ? (
        <div className="print-letterhead-meta">{meta.join(" · ")}</div>
      ) : null}
      <h1 className="print-letterhead-title">{title}</h1>
      {subtitle ? <div className="print-letterhead-sub">{subtitle}</div> : null}
      {period ? <div className="print-letterhead-period">{period}</div> : null}
      {extra ? <div className="print-letterhead-extra">{extra}</div> : null}
    </header>
  );
}
