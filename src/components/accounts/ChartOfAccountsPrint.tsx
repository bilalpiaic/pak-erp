import { Fragment } from "react";

import { PrintLetterhead } from "@/components/print/PrintLetterhead";
import { PrintSheet } from "@/components/print/PrintSheet";
import { PrintSignatures } from "@/components/print/PrintSignatures";
import { PrintThead } from "@/components/print/PrintThead";
import {
  CF_LINK_LABELS,
  statementHeadLabel,
  type CfLink,
} from "@/lib/accounts/report-links";
import type { AccountGroupSection } from "@/lib/accounts/types";

type ChartOfAccountsPrintProps = {
  groups: AccountGroupSection[];
  filters?: string | null;
};

function cfLabel(value: string): string {
  if (!value || value === "None") return "—";
  return CF_LINK_LABELS[value as CfLink] ?? value;
}

export function ChartOfAccountsPrint({ groups, filters }: ChartOfAccountsPrintProps) {
  const count = groups.reduce((sum, section) => sum + section.accounts.length, 0);

  return (
    <PrintSheet orientation="landscape">
      <table className="print-table">
        <PrintThead
          colSpan={7}
          banner={
            <PrintLetterhead
              title="Chart of Accounts"
              subtitle={filters || `${count} accounts`}
              extra={filters ? `${count} accounts` : null}
            />
          }
        >
          <th>Code</th>
          <th>Account name</th>
          <th>Group</th>
          <th>Type</th>
          <th>Statement head</th>
          <th>CF link</th>
          <th>Status</th>
        </PrintThead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={7}>No accounts match the current filters.</td>
            </tr>
          ) : (
            groups.map((section) => (
              <Fragment key={section.group}>
                <tr className="section-head">
                  <td colSpan={7}>
                    {section.group} ({section.accounts.length})
                  </td>
                </tr>
                {section.accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.code}</td>
                    <td>{account.name}</td>
                    <td>{account.accountGroup}</td>
                    <td>{account.accountType}</td>
                    <td>
                      {statementHeadLabel({
                        accountType: account.accountType,
                        bsSection: account.bsSection,
                        plSection: account.plSection,
                      })}
                    </td>
                    <td>{cfLabel(account.cfLink)}</td>
                    <td>{account.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
      <PrintSignatures columns={[{ label: "Prepared by" }, { label: "Reviewed by" }]} />
    </PrintSheet>
  );
}
