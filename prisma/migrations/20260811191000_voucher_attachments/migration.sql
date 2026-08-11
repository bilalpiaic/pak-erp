-- CreateTable
CREATE TABLE "voucher_attachments" (
    "id" BIGSERIAL NOT NULL,
    "voucher_id" BIGINT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "storage_url" TEXT NOT NULL,
    "uploaded_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voucher_attachments_voucher_id_idx" ON "voucher_attachments"("voucher_id");

-- AddForeignKey
ALTER TABLE "voucher_attachments" ADD CONSTRAINT "voucher_attachments_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
