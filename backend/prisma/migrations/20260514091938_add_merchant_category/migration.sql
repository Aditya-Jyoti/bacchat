-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "merchantKey" TEXT;

-- CreateTable
CREATE TABLE "merchant_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_categories_userId_merchantKey_key" ON "merchant_categories"("userId", "merchantKey");

-- CreateIndex
CREATE INDEX "transactions_userId_merchantKey_idx" ON "transactions"("userId", "merchantKey");

-- AddForeignKey
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "budget_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
