"use client";

import { PrintAmount } from "@/components/print/PrintAmount";
import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { OriginLink } from "@/components/ui/OriginLink";
import type { CompanyDTO } from "@/lib/company/types";
import { companyPrintInfoFromDto } from "@/lib/print/company";
import { accountLedgerHref, partyLedgerHref } from "@/lib/links";
import {
  VOUCHER_TYPE_LABELS,
  type VoucherStatusValue,
  type VoucherTypeValue,
} from "@/lib/vouchers/types";

export type VoucherPrintLine = {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  lineNarration: string;
};

type VoucherPrintProps = {
  company?: CompanyDTO | null;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  voucherDate: string;
  referenceNo?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  partyNtn?: string | null;
  partyKind?: "debtor" | "creditor";
  whtApplicable?: boolean;
  narration?: string | null;
  status?: VoucherStatusValue | string | null;
  lines: VoucherPrintLine[];
  totalDebit: string;
  totalCredit: string;
};

export function VoucherPrint({
  company,
  voucherNo,
  voucherType,
  voucherDate,
  referenceNo,
  partyId,
  partyName,
  partyNtn,
  partyKind = "debtor",
  whtApplicable,
  narration,
  status,
  lines,
  totalDebit,
  totalCredit,
}: VoucherPrintProps) {
  return (
    <div className="voucher-print print-sheet print-sheet-portrait border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <PrintLetterhead
        company={companyPrintInfoFromDto(company)}
        title={VOUCHER_TYPE_LABELS[voucherType] ?? voucherType}
        subtitle={status ? `Status: ${status}` : null}
        extra={`Voucher ${voucherNo} · ${voucherDate}${referenceNo ? ` · Ref ${referenceNo}` : ""}`}
      />

      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Party
            </span>
            <div className="font-semibold">
              {partyId && partyName ? (
                <OriginLink href={partyLedgerHref(partyId, partyKind)}>{partyName}</OriginLink>
              ) : (
                partyName || "—"
              )}
            </div>
            {partyNtn ? (
              <div className="text-xs text-[var(--muted)]">NTN {partyNtn}</div>
            ) : null}
            {whtApplicable ? (
              <div className="text-xs text-[var(--muted)]">WHT applicable</div>
            ) : null}
          </div>
          {narration ? (
            <div className="text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--foreground)]">Narration: </span>
              {narration}
            </div>
          ) : null}
        </div>
        <div className="space-y-1 sm:text-right">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Voucher No.
            </span>
            <div className="font-semibold">{voucherNo}</div>
          </div>
          <div className="text-xs">
            <span className="text-[var(--muted)]">Date: </span>
            {voucherDate}
          </div>
          {referenceNo ? (
            <div className="text-xs">
              <span className="text-[var(--muted)]">Reference: </span>
              {referenceNo}
            </div>
          ) : null}
        </div>
      </div>

      <table className="print-table data-table w-full border-collapse text-left">
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th>Narration</th>
            <th className="num text-right">Debit</th>
            <th className="num text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-sm text-[var(--muted)]">
                No lines
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`${line.accountCode}-${index}`}>
                <td className="text-xs text-[var(--muted)]">{index + 1}</td>
                <td>
                  {line.accountCode ? (
                    <>
                      <div className="font-mono text-xs text-[var(--accent)]">
                        <OriginLink href={accountLedgerHref(line.accountCode)}>
                          {line.accountCode}
                        </OriginLink>
                      </div>
                      <div className="text-xs">
                        <OriginLink href={accountLedgerHref(line.accountCode)}>
                          {line.accountName}
                        </OriginLink>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-mono text-xs text-[var(--accent)]">
                        {line.accountCode}
                      </div>
                      <div className="text-xs">{line.accountName}</div>
                    </>
                  )}
                </td>
                <td className="text-xs text-[var(--muted)]">{line.lineNarration || "—"}</td>
                <td className="num text-right font-mono text-xs">
                  <PrintAmount value={line.debit} blankZero />
                </td>
                <td className="num text-right font-mono text-xs">
                  <PrintAmount value={line.credit} blankZero />
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="text-right font-semibold">
              Totals
            </td>
            <td className="num text-right font-mono text-sm font-semibold">
              <PrintAmount value={totalDebit} />
            </td>
            <td className="num text-right font-mono text-sm font-semibold">
              <PrintAmount value={totalCredit} />
            </td>
          </tr>
        </tfoot>
      </table>

      <PrintSignatures />
    </div>
  );
}
