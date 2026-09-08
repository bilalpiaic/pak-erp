export const STOCK_ADJUSTMENT_REASONS = ["OPENING", "GAIN", "LOSS", "COUNT"] as const;
export type StockAdjustmentReasonValue = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export const STOCK_ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReasonValue, string> = {
  OPENING: "Opening stock",
  GAIN: "Stock gain",
  LOSS: "Stock loss",
  COUNT: "Stock count / adjustment",
};

export type StockAdjustmentLineInput = {
  itemId: string;
  direction: "IN" | "OUT";
  quantity: string | number;
  unitCost?: string | number | null;
};

export type StockAdjustmentInput = {
  adjustmentDate: string;
  reason: StockAdjustmentReasonValue;
  narration?: string | null;
  lines: StockAdjustmentLineInput[];
};

export type StockAdjustmentLineDTO = {
  id: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  sku?: string | null;
  direction: "IN" | "OUT";
  quantity: string;
  unitCost: string;
  amount: string;
};

export type StockAdjustmentDTO = {
  id: string;
  companyId: string;
  voucherId: string | null;
  voucherNo: string | null;
  adjustmentNo: string;
  adjustmentDate: string;
  reason: StockAdjustmentReasonValue;
  narration: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  createdBy: string | null;
  postedBy: string | null;
  cancelledBy: string | null;
  createdAt: string;
  postedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  totalDebit: string;
  totalCredit: string;
  lines: StockAdjustmentLineDTO[];
};

export type StockAdjustmentListQuery = {
  search?: string;
  status?: string;
  reason?: string;
};
