import type { VoucherDTO } from "./types";

export type VoucherImportItemResult = {
  voucherKey: string;
  rowStart: number;
  rowEnd: number;
  voucherType: string | null;
  voucherNo: string | null;
  status: "DRAFT" | "POSTED" | null;
  ok: boolean;
  errors: string[];
  voucher?: VoucherDTO;
};

export type VoucherImportResult = {
  dryRun: boolean;
  totalRows: number;
  voucherCount: number;
  created: number;
  posted: number;
  failed: number;
  items: VoucherImportItemResult[];
};
