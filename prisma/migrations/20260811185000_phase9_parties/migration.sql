-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('Debtor', 'Creditor', 'Both');

-- CreateTable
CREATE TABLE "parties" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "ntn" VARCHAR(50),
    "party_type" "PartyType" NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(150),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "outstanding_days" INTEGER,
    "outstanding_amount" DECIMAL(18,2) DEFAULT 0.00,
    "wht_status" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "vouchers"
  ADD COLUMN "party_id" BIGINT,
  ADD COLUMN "party_ntn" VARCHAR(50),
  ADD COLUMN "wht_applicable" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "parties_company_id_party_type_idx" ON "parties"("company_id", "party_type");

-- CreateIndex
CREATE UNIQUE INDEX "parties_company_id_name_key" ON "parties"("company_id", "name");

-- CreateIndex
CREATE INDEX "vouchers_party_id_idx" ON "vouchers"("party_id");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
