export const PURCHASE_INVOICE_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type PurchaseInvoiceStatusValue = (typeof PURCHASE_INVOICE_STATUSES)[number];

export type PurchaseInvoiceLineInput = {
  itemId: string;
  detail?: string | null;
  quantity: string | number;
  rate: string | number;
  amount?: string | number | null;
};

export type PurchaseInvoiceInput = {
  invoiceDate: string;
  partyId: string;
  billNo?: string | null;
  narration?: string | null;
  lines: PurchaseInvoiceLineInput[];
};

export type PurchaseInvoiceLineDTO = {
  id: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  sku?: string | null;
  detail: string | null;
  quantity: string;
  rate: string;
  amount: string;
};

export type PurchaseInvoiceDTO = {
  id: string;
  companyId: string;
  voucherId: string | null;
  voucherNo: string | null;
  invoiceNo: string;
  invoiceDate: string;
  partyId: string;
  partyName: string;
  partyNtn: string | null;
  billNo: string | null;
  narration: string | null;
  status: PurchaseInvoiceStatusValue;
  totalAmount: string;
  createdBy: string | null;
  postedBy: string | null;
  cancelledBy: string | null;
  createdAt: string;
  postedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  lines: PurchaseInvoiceLineDTO[];
};

export type PurchaseInvoiceListQuery = {
  search?: string;
  status?: string;
};
