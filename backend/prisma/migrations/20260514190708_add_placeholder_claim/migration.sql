-- CreateTable
CREATE TABLE "placeholder_claims" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "placeholderUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placeholder_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "placeholder_claims_placeholderUserId_key" ON "placeholder_claims"("placeholderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "placeholder_claims_code_key" ON "placeholder_claims"("code");

-- AddForeignKey
ALTER TABLE "placeholder_claims" ADD CONSTRAINT "placeholder_claims_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "split_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placeholder_claims" ADD CONSTRAINT "placeholder_claims_placeholderUserId_fkey" FOREIGN KEY ("placeholderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
