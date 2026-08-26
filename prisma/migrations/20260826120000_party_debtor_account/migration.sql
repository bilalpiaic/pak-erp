-- Named debtor COA (sub-ledger) link on parties.
ALTER TABLE "parties" ADD COLUMN "account_id" BIGINT;

CREATE UNIQUE INDEX "parties_account_id_key" ON "parties"("account_id");

ALTER TABLE "parties"
  ADD CONSTRAINT "parties_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
