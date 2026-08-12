-- AlterTable companies: demo tenant flag
ALTER TABLE "companies" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable users: demo login flag
ALTER TABLE "users" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "companies_is_demo_idx" ON "companies"("is_demo");

-- CreateIndex
CREATE INDEX "users_is_demo_idx" ON "users"("is_demo");
