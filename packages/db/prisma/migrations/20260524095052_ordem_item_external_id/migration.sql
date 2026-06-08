-- Adds an external identifier so SIIE re-imports can upsert by source ID.
ALTER TABLE "ordem_items" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "ordem_items_externalId_key" ON "ordem_items"("externalId");
