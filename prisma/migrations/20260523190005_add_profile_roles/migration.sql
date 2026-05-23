-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
