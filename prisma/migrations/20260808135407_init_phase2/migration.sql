-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('BPV', 'BRV', 'CPV', 'CRV', 'JV');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('Debit', 'Credit');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'POST', 'CANCEL', 'ACTIVATE', 'DEACTIVATE');

-- CreateTable
CREATE TABLE "companies" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "ntn" VARCHAR(50),
    "strn" VARCHAR(50),
    "phone" VARCHAR(50),
    "email" VARCHAR(150),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'PKR',
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "account_type" VARCHAR(30) NOT NULL,
    "account_group" VARCHAR(100),
    "normal_balance" "NormalBalance" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "voucher_no" VARCHAR(50) NOT NULL,
    "voucher_type" "VoucherType" NOT NULL,
    "voucher_date" DATE NOT NULL,
    "reference_no" VARCHAR(100),
    "party_name" VARCHAR(200),
    "narration" TEXT,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" VARCHAR(100),
    "posted_by" VARCHAR(100),
    "cancelled_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_lines" (
    "id" BIGSERIAL NOT NULL,
    "voucher_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "line_narration" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "actor" VARCHAR(100),
    "action" "AuditAction" NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "record_id" VARCHAR(50) NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_years_company_id_idx" ON "fiscal_years"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_company_id_name_key" ON "fiscal_years"("company_id", "name");

-- CreateIndex
CREATE INDEX "accounts_company_id_idx" ON "accounts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_company_id_code_key" ON "accounts"("company_id", "code");

-- CreateIndex
CREATE INDEX "vouchers_company_id_voucher_date_idx" ON "vouchers"("company_id", "voucher_date");

-- CreateIndex
CREATE INDEX "vouchers_company_id_status_idx" ON "vouchers"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_company_id_voucher_no_key" ON "vouchers"("company_id", "voucher_no");

-- CreateIndex
CREATE INDEX "voucher_lines_voucher_id_idx" ON "voucher_lines"("voucher_id");

-- CreateIndex
CREATE INDEX "voucher_lines_account_id_idx" ON "voucher_lines"("account_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_entity_record_id_idx" ON "audit_logs"("company_id", "entity", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
