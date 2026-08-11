"use client";

import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
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
  company: CompanyDTO | null;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  voucherDate: string;
  referenceNo?: string | null;
  partyName?: string | null;
  partyNtn?: string | null;
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
  partyName,
  partyNtn,
  whtApplicable,
  narration,
  status,
  lines,
  totalDebit,
  totalCredit,
}: VoucherPrintProps) {
  return (
    <div className="voucher-print border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <PrintLetterhead
        company={company}
        title={VOUCHER_TYPE_LABELS[voucherType] ?? voucherType}
        subtitle={status ? `Status: ${status}` : undefined}
      />

      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <div>
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
              Party
            </span>
            <div className="font-semibold">{partyName || "—"}</div>
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

      <table className="data-table w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th>Narration</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
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
                  <div className="font-mono text-xs text-[var(--accent)]">{line.accountCode}</div>
                  <div className="text-xs">{line.accountName}</div>
                </td>
                <td className="text-xs text-[var(--muted)]">{line.lineNarration || "—"}</td>
                <td className="text-right font-mono text-xs">
                  {!line.debit || line.debit === "0" || line.debit === "0.00"
                    ? "—"
                    : formatCurrency(line.debit)}
                </td>
                <td className="text-right font-mono text-xs">
                  {!line.credit || line.credit === "0" || line.credit === "0.00"
                    ? "—"
                    : formatCurrency(line.credit)}
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
            <td className="text-right font-mono text-sm font-semibold">
              {formatCurrency(totalDebit)}
            </td>
            <td className="text-right font-mono text-sm font-semibold">
              {formatCurrency(totalCredit)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 grid gap-8 text-xs text-[var(--muted)] sm:grid-cols-3">
        <div>
          <div className="mb-8 border-b border-[var(--border)] pb-1">Prepared by</div>
        </div>
        <div>
          <div className="mb-8 border-b border-[var(--border)] pb-1">Checked by</div>
        </div>
        <div>
          <div className="mb-8 border-b border-[var(--border)] pb-1">Approved by</div>
        </div>
      </div>
    </div>
  );
}
