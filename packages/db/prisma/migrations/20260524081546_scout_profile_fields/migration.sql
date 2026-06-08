-- Reshape scouts table: split name, add associate number + contacts, switch
-- section enum to OrdemSection. No existing scout rows, so we drop the old
-- column types in place.

ALTER TABLE "scouts" DROP COLUMN "name";
ALTER TABLE "scouts" DROP COLUMN "section";

ALTER TABLE "scouts" ADD COLUMN "firstName" TEXT NOT NULL;
ALTER TABLE "scouts" ADD COLUMN "lastName" TEXT NOT NULL;
ALTER TABLE "scouts" ADD COLUMN "numeroAssociado" TEXT;
ALTER TABLE "scouts" ADD COLUMN "section" "OrdemSection" NOT NULL;
ALTER TABLE "scouts" ADD COLUMN "email" TEXT;
ALTER TABLE "scouts" ADD COLUMN "phone" TEXT;
ALTER TABLE "scouts" ADD COLUMN "encarregadoNome" TEXT;
ALTER TABLE "scouts" ADD COLUMN "encarregadoContacto" TEXT;

CREATE UNIQUE INDEX "scouts_numeroAssociado_key" ON "scouts"("numeroAssociado");

DROP TYPE "ScoutSection";
