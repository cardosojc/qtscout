-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "signature" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "signedById" TEXT,
                        ADD COLUMN "signedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
