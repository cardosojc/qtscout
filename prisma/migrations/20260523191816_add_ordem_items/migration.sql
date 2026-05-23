-- CreateEnum
CREATE TYPE "OrdemSection" AS ENUM ('ALCATEIA', 'EXPEDICAO', 'COMUNIDADE', 'CLA');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "section" "OrdemSection";

-- CreateTable
CREATE TABLE "ordem_items" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "section" "OrdemSection",
    "date" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "includedInOsId" TEXT,

    CONSTRAINT "ordem_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordem_items_date_idx" ON "ordem_items"("date");

-- CreateIndex
CREATE INDEX "ordem_items_section_category_date_idx" ON "ordem_items"("section", "category", "date");

-- CreateIndex
CREATE INDEX "ordem_items_includedInOsId_idx" ON "ordem_items"("includedInOsId");

-- AddForeignKey
ALTER TABLE "ordem_items" ADD CONSTRAINT "ordem_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_items" ADD CONSTRAINT "ordem_items_includedInOsId_fkey" FOREIGN KEY ("includedInOsId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
