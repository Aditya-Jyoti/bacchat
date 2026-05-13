-- CreateTable
CREATE TABLE "group_categories" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📦',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_categories_groupId_name_key" ON "group_categories"("groupId", "name");

-- AddForeignKey
ALTER TABLE "group_categories" ADD CONSTRAINT "group_categories_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "split_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_categories" ADD CONSTRAINT "group_categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
