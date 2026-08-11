export const SALES_INVOICE_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type SalesInvoiceStatusValue = (typeof SALES_INVOICE_STATUSES)[number];

export type SalesInvoiceLineInput = {
  item: string;
  detail?: string | null;
  quantity: string | number;
  rate: string | number;
  amount?: string | number | null;
};

export type SalesInvoiceInput = {
  invoiceDate: string; // YYYY-MM-DD
  partyId: string;
  poNumber?: string | null;
  narration?: string | null;
  lines: SalesInvoiceLineInput[];
};

export type SalesInvoiceLineDTO = {
  id: string;
  lineNo: number;
  item: string;
  detail: string | null;
  quantity: string;
  rate: string;
  amount: string;
};

export type SalesInvoiceDTO = {
  id: string;
  companyId: string;
  voucherId: string | null;
  voucherNo: string | null;
  invoiceNo: string;
  invoiceDate: string;
  partyId: string;
  partyName: string;
  partyNtn: string | null;
  poNumber: string | null;
  narration: string | null;
  status: SalesInvoiceStatusValue;
  totalAmount: string;
  createdBy: string | null;
  postedBy: string | null;
  cancelledBy: string | null;
  createdAt: string;
  postedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  lines: SalesInvoiceLineDTO[];
};

export type SalesInvoiceListQuery = {
  search?: string;
  status?: string;
};
