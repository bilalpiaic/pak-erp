export const VOUCHER_TYPES = ["BPV", "BRV", "CPV", "CRV", "JV"] as const;
export type VoucherTypeValue = (typeof VOUCHER_TYPES)[number];

export const VOUCHER_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type VoucherStatusValue = (typeof VOUCHER_STATUSES)[number];

export const VOUCHER_TYPE_LABELS: Record<VoucherTypeValue, string> = {
  BPV: "Bank Payment Voucher",
  BRV: "Bank Receipt Voucher",
  CPV: "Cash Payment Voucher",
  CRV: "Cash Receipt Voucher",
  JV: "Journal Voucher",
};

export type VoucherLineInput = {
  accountId: string;
  debit?: string | number;
  credit?: string | number;
  lineNarration?: string | null;
};

export type VoucherInput = {
  voucherType: VoucherTypeValue;
  voucherDate: string; // YYYY-MM-DD
  referenceNo?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  partyNtn?: string | null;
  whtApplicable?: boolean;
  narration?: string | null;
  lines: VoucherLineInput[];
};

export type VoucherLineDTO = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  lineNarration: string | null;
};

export type VoucherDTO = {
  id: string;
  companyId: string;
  voucherNo: string;
  voucherType: VoucherTypeValue;
  voucherDate: string;
  referenceNo: string | null;
  partyId: string | null;
  partyName: string | null;
  partyNtn: string | null;
  whtApplicable: boolean;
  narration: string | null;
  status: VoucherStatusValue;
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  createdBy: string | null;
  postedBy: string | null;
  cancelledBy: string | null;
  createdAt: string;
  postedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  lines: VoucherLineDTO[];
};

export type VoucherListQuery = {
  search?: string;
  voucherType?: string;
  status?: string;
};
