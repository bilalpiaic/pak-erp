export type SiReconcileIssueKind =
  | "missing_voucher"
  | "orphan_voucher"
  | "status_mismatch"
  | "amount_mismatch"
  | "party_mismatch"
  | "type_mismatch"
  | "link_mismatch";

export type SiReconcileIssue = {
  kind: SiReconcileIssueKind;
  invoiceId?: string;
  invoiceNo?: string;
  voucherId?: string;
  voucherNo?: string;
  detail: string;
};

export type SiReconcileResult = {
  dryRun: boolean;
  invoiceCount: number;
  siVoucherCount: number;
  issues: SiReconcileIssue[];
  repaired: number;
  skipped: number;
  deleted: number;
};
