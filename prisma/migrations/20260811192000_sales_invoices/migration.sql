-- AlterEnum
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'SI';

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "voucher_id" BIGINT,
    "invoice_no" VARCHAR(50) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "party_id" BIGINT NOT NULL,
    "party_name" VARCHAR(200) NOT NULL,
    "party_ntn" VARCHAR(50),
    "po_number" VARCHAR(100),
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

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" BIGSERIAL NOT NULL,
    "sales_invoice_id" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item" VARCHAR(200) NOT NULL,
    "detail" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_voucher_id_key" ON "sales_invoices"("voucher_id");

-- CreateIndex
CREATE INDEX "sales_invoices_company_id_invoice_date_idx" ON "sales_invoices"("company_id", "invoice_date");

-- CreateIndex
CREATE INDEX "sales_invoices_company_id_status_idx" ON "sales_invoices"("company_id", "status");

-- CreateIndex
CREATE INDEX "sales_invoices_party_id_idx" ON "sales_invoices"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_company_id_invoice_no_key" ON "sales_invoices"("company_id", "invoice_no");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_sales_invoice_id_idx" ON "sales_invoice_lines"("sales_invoice_id");

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
