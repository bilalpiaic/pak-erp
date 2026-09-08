-- AlterEnum
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'PI';
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'STJ';

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('Fabric', 'Trim', 'FinishedGoods', 'Other');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('OPENING', 'PURCHASE', 'SALE', 'ADJUSTMENT', 'PURCHASE_RETURN', 'SALE_RETURN');

-- CreateEnum
CREATE TYPE "StockMoveDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockSourceDocument" AS ENUM ('SalesInvoice', 'PurchaseInvoice', 'StockAdjustment');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('OPENING', 'GAIN', 'LOSS', 'COUNT');

-- CreateTable
CREATE TABLE "items" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "track_stock" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_sale_rate" DECIMAL(18,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "item_id" BIGINT NOT NULL,
    "move_date" DATE NOT NULL,
    "direction" "StockMoveDirection" NOT NULL,
    "move_type" "StockMoveType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "value_cents" INTEGER NOT NULL,
    "voucher_id" BIGINT NOT NULL,
    "source_document" "StockSourceDocument" NOT NULL,
    "source_document_id" BIGINT NOT NULL,
    "source_line_no" INTEGER NOT NULL,
    "party_id" BIGINT,
    "narration" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "voucher_id" BIGINT,
    "invoice_no" VARCHAR(50) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "party_id" BIGINT NOT NULL,
    "party_name" VARCHAR(200) NOT NULL,
    "party_ntn" VARCHAR(50),
    "bill_no" VARCHAR(100),
    "narration" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "created_by" VARCHAR(100),
    "posted_by" VARCHAR(100),
    "cancelled_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" BIGSERIAL NOT NULL,
    "purchase_invoice_id" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_id" BIGINT NOT NULL,
    "item_name" VARCHAR(200) NOT NULL,
    "detail" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "voucher_id" BIGINT,
    "adjustment_no" VARCHAR(50) NOT NULL,
    "adjustment_date" DATE NOT NULL,
    "reason" "StockAdjustmentReason" NOT NULL,
    "narration" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" VARCHAR(100),
    "posted_by" VARCHAR(100),
    "cancelled_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_lines" (
    "id" BIGSERIAL NOT NULL,
    "stock_adjustment_id" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_id" BIGINT NOT NULL,
    "item_name" VARCHAR(200) NOT NULL,
    "direction" "StockMoveDirection" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sales_invoice_lines" ADD COLUMN "item_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "items_company_id_sku_key" ON "items"("company_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "items_company_id_name_key" ON "items"("company_id", "name");

-- CreateIndex
CREATE INDEX "items_company_id_is_active_idx" ON "items"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "items_company_id_category_idx" ON "items"("company_id", "category");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_item_id_move_date_idx" ON "stock_movements"("company_id", "item_id", "move_date");

-- CreateIndex
CREATE INDEX "stock_movements_voucher_id_idx" ON "stock_movements"("voucher_id");

-- CreateIndex
CREATE INDEX "stock_movements_source_document_source_document_id_idx" ON "stock_movements"("source_document", "source_document_id");

-- CreateIndex
CREATE INDEX "stock_movements_party_id_idx" ON "stock_movements"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_voucher_id_key" ON "purchase_invoices"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_company_id_invoice_no_key" ON "purchase_invoices"("company_id", "invoice_no");

-- CreateIndex
CREATE INDEX "purchase_invoices_company_id_invoice_date_idx" ON "purchase_invoices"("company_id", "invoice_date");

-- CreateIndex
CREATE INDEX "purchase_invoices_company_id_status_idx" ON "purchase_invoices"("company_id", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_party_id_idx" ON "purchase_invoices"("party_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_purchase_invoice_id_idx" ON "purchase_invoice_lines"("purchase_invoice_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_item_id_idx" ON "purchase_invoice_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_voucher_id_key" ON "stock_adjustments"("voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_company_id_adjustment_no_key" ON "stock_adjustments"("company_id", "adjustment_no");

-- CreateIndex
CREATE INDEX "stock_adjustments_company_id_adjustment_date_idx" ON "stock_adjustments"("company_id", "adjustment_date");

-- CreateIndex
CREATE INDEX "stock_adjustments_company_id_status_idx" ON "stock_adjustments"("company_id", "status");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_stock_adjustment_id_idx" ON "stock_adjustment_lines"("stock_adjustment_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_item_id_idx" ON "stock_adjustment_lines"("item_id");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_item_id_idx" ON "sales_invoice_lines"("item_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_stock_adjustment_id_fkey" FOREIGN KEY ("stock_adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed Cost of Goods Sold on every existing company (idempotent).
INSERT INTO "accounts" (
  "company_id", "code", "name", "account_type", "account_group",
  "bs_section", "pl_section", "cf_link", "normal_balance", "is_active",
  "created_at", "updated_at"
)
SELECT
  c.id,
  '5004',
  'Cost of Goods Sold',
  'Expense',
  'COGS',
  'None',
  'Cogs',
  'None',
  'Debit',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "accounts" a WHERE a.company_id = c.id AND a.code = '5004'
);
