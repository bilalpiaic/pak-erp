-- Account report links: BS / P&L sub-heads and Cash Flow classification

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "bs_section" VARCHAR(40) NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS "pl_section" VARCHAR(40) NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS "cf_link" VARCHAR(40) NOT NULL DEFAULT 'None';

-- Backfill known seed / standard codes
UPDATE "accounts" SET
  "bs_section" = CASE "code"
    WHEN '1001' THEN 'CashAndBank'
    WHEN '1002' THEN 'CashAndBank'
    WHEN '1003' THEN 'CashAndBank'
    WHEN '1010' THEN 'TradeDebtors'
    WHEN '1020' THEN 'Stock'
    WHEN '1030' THEN 'AdvancesPrepayments'
    WHEN '1040' THEN 'AdvancesPrepayments'
    WHEN '1050' THEN 'AdvancesPrepayments'
    WHEN '1201' THEN 'FixedAssetsGross'
    WHEN '1202' THEN 'FixedAssetsGross'
    WHEN '1203' THEN 'FixedAssetsGross'
    WHEN '1204' THEN 'FixedAssetsGross'
    WHEN '1205' THEN 'AccumulatedDepreciation'
    WHEN '2001' THEN 'TradeCreditors'
    WHEN '2002' THEN 'AccruedLiabilities'
    WHEN '2003' THEN 'TaxesPayable'
    WHEN '2004' THEN 'TaxesPayable'
    WHEN '2005' THEN 'TaxesPayable'
    WHEN '2006' THEN 'ShortTermLoans'
    WHEN '2201' THEN 'LongTermFinancing'
    WHEN '3001' THEN 'OwnersCapital'
    WHEN '3002' THEN 'RetainedEarnings'
    WHEN '3003' THEN 'Drawings'
    ELSE "bs_section"
  END,
  "pl_section" = CASE "code"
    WHEN '4001' THEN 'Sales'
    WHEN '4002' THEN 'Sales'
    WHEN '4003' THEN 'OtherIncome'
    WHEN '5001' THEN 'OpeningStock'
    WHEN '5002' THEN 'Purchases'
    WHEN '5003' THEN 'ClosingStock'
    WHEN '6001' THEN 'OperatingExpense'
    WHEN '6002' THEN 'OperatingExpense'
    WHEN '6003' THEN 'OperatingExpense'
    WHEN '6004' THEN 'OperatingExpense'
    WHEN '6005' THEN 'OperatingExpense'
    WHEN '6006' THEN 'OperatingExpense'
    WHEN '6007' THEN 'Depreciation'
    WHEN '7001' THEN 'FinancialCharges'
    WHEN '7002' THEN 'FinancialCharges'
    WHEN '8001' THEN 'IncomeTax'
    WHEN '8002' THEN 'OtherExpense'
    ELSE "pl_section"
  END,
  "cf_link" = CASE "code"
    WHEN '1001' THEN 'CashEquivalent'
    WHEN '1002' THEN 'CashEquivalent'
    WHEN '1003' THEN 'CashEquivalent'
    WHEN '1201' THEN 'InvestingPurchase'
    WHEN '1202' THEN 'InvestingPurchase'
    WHEN '1203' THEN 'InvestingPurchase'
    WHEN '1204' THEN 'InvestingPurchase'
    WHEN '2201' THEN 'FinancingBorrowing'
    WHEN '2006' THEN 'FinancingBorrowing'
    WHEN '3001' THEN 'FinancingCapital'
    WHEN '3003' THEN 'FinancingDrawings'
    WHEN '4001' THEN 'OperatingReceipt'
    WHEN '4002' THEN 'OperatingReceipt'
    WHEN '4003' THEN 'OperatingReceipt'
    WHEN '5002' THEN 'OperatingPayment'
    WHEN '6001' THEN 'OperatingPayment'
    WHEN '6002' THEN 'OperatingPayment'
    WHEN '6003' THEN 'OperatingPayment'
    WHEN '6004' THEN 'OperatingPayment'
    WHEN '6005' THEN 'OperatingPayment'
    WHEN '6006' THEN 'OperatingPayment'
    WHEN '6007' THEN 'NonCashAddBack'
    WHEN '7001' THEN 'OperatingPayment'
    WHEN '7002' THEN 'OperatingPayment'
    WHEN '8001' THEN 'OperatingPayment'
    ELSE 'None'
  END;

CREATE INDEX IF NOT EXISTS "accounts_company_id_bs_section_idx" ON "accounts"("company_id", "bs_section");
CREATE INDEX IF NOT EXISTS "accounts_company_id_pl_section_idx" ON "accounts"("company_id", "pl_section");
CREATE INDEX IF NOT EXISTS "accounts_company_id_cf_link_idx" ON "accounts"("company_id", "cf_link");
