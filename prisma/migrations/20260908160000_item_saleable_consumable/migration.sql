-- Replace Fabric / Trim / FinishedGoods / Other with Saleable / Consumable.
CREATE TYPE "ItemCategory_new" AS ENUM ('Saleable', 'Consumable');

ALTER TABLE "items" ALTER COLUMN "category" TYPE "ItemCategory_new"
USING (
  CASE
    WHEN "category"::text = 'FinishedGoods' THEN 'Saleable'::"ItemCategory_new"
    ELSE 'Consumable'::"ItemCategory_new"
  END
);

DROP TYPE "ItemCategory";
ALTER TYPE "ItemCategory_new" RENAME TO "ItemCategory";
