"use client";

import { OriginLink } from "@/components/ui/OriginLink";
import type { CompanyDTO } from "@/lib/company/types";
import { formatCurrency } from "@/lib/formatting/money";
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
    <div className="voucher-print border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <div className="mb-4 border-b border-[var(--border)] pb-3">
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
          {VOUCHER_TYPE_LABELS[voucherType] ?? voucherType}
        </div>
        {status ? (
          <div className="mt-1 text-xs text-[var(--muted)]">Status: {status}</div>
        ) : null}
      </div>

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
