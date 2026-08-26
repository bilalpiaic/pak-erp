/** Canonical CSV columns for voucher bulk import (one row per line). */
export const VOUCHER_IMPORT_HEADERS = [
  "voucher_key",
  "voucher_type",
  "voucher_date",
  "voucher_no",
  "reference_no",
  "party_name",
  "party_ntn",
  "wht_applicable",
  "narration",
  "account_code",
  "debit",
  "credit",
  "line_narration",
  "status",
] as const;

export const VOUCHER_IMPORT_TEMPLATE_CSV = `${VOUCHER_IMPORT_HEADERS.join(",")}\n`;

/**
 * Sample file uses seeded COA codes (1001 cash, 1002 HBL, 1010 debtors, 2001 creditors,
 * 4001 sales, 6001 salaries, 6002 rent). Group lines with the same voucher_key.
 * Leave voucher_no blank to auto-allocate. status = DRAFT or POSTED.
 */
export const VOUCHER_IMPORT_SAMPLE_CSV = [
  VOUCHER_IMPORT_HEADERS.join(","),
  "BRV-SAMPLE-1,BRV,2025-03-10,,INV-884,Horizon Textiles Ltd,2901456-1,no,Bank collection against sales,1002,125000.00,0,HBL receipt,POSTED",
  "BRV-SAMPLE-1,BRV,2025-03-10,,INV-884,Horizon Textiles Ltd,2901456-1,no,Bank collection against sales,1010,0,125000.00,Reduce trade debtors,POSTED",
  "CRV-SAMPLE-1,CRV,2025-03-12,,,Walk-in Customer,,no,Cash sale receipt,1001,18000.00,0,Cash in hand,DRAFT",
  "CRV-SAMPLE-1,CRV,2025-03-12,,,Walk-in Customer,,no,Cash sale receipt,4001,0,18000.00,Taxable sales,DRAFT",
  "BPV-SAMPLE-1,BPV,2025-03-18,,PO-441,Cotton Mills Supply Co,1122334-5,yes,Partial payment to supplier,2001,75000.00,0,Settle trade creditors,DRAFT",
  "BPV-SAMPLE-1,BPV,2025-03-18,,PO-441,Cotton Mills Supply Co,1122334-5,yes,Partial payment to supplier,1002,0,75000.00,HBL payment,DRAFT",
  'JV-SAMPLE-1,JV,2025-03-25,,,,,no,Salaries and factory rent (accrual),6001,85000.00,0,Payroll,DRAFT',
  'JV-SAMPLE-1,JV,2025-03-25,,,,,no,Salaries and factory rent (accrual),6002,40000.00,0,Unit rent,DRAFT',
  'JV-SAMPLE-1,JV,2025-03-25,,,,,no,Salaries and factory rent (accrual),2002,0,125000.00,Accrued liabilities,DRAFT',
  "",
].join("\n");
