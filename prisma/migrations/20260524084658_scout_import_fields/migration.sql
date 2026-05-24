-- Expand Scout model for SIIE import: make section optional, split contact
-- fields, add identification + address + parent fields.

ALTER TABLE "scouts" ALTER COLUMN "section" DROP NOT NULL;

ALTER TABLE "scouts" DROP COLUMN "phone";
ALTER TABLE "scouts" DROP COLUMN "encarregadoContacto";

ALTER TABLE "scouts" ADD COLUMN "sexo" TEXT;
ALTER TABLE "scouts" ADD COLUMN "cc" TEXT;
ALTER TABLE "scouts" ADD COLUMN "nif" TEXT;
ALTER TABLE "scouts" ADD COLUMN "telefone" TEXT;
ALTER TABLE "scouts" ADD COLUMN "telemovel" TEXT;
ALTER TABLE "scouts" ADD COLUMN "morada" TEXT;
ALTER TABLE "scouts" ADD COLUMN "localidade" TEXT;
ALTER TABLE "scouts" ADD COLUMN "codigoPostal" TEXT;
ALTER TABLE "scouts" ADD COLUMN "paiNome" TEXT;
ALTER TABLE "scouts" ADD COLUMN "paiTelefone" TEXT;
ALTER TABLE "scouts" ADD COLUMN "paiEmail" TEXT;
ALTER TABLE "scouts" ADD COLUMN "maeNome" TEXT;
ALTER TABLE "scouts" ADD COLUMN "maeTelefone" TEXT;
ALTER TABLE "scouts" ADD COLUMN "maeEmail" TEXT;
ALTER TABLE "scouts" ADD COLUMN "encarregadoTelefone" TEXT;
ALTER TABLE "scouts" ADD COLUMN "encarregadoEmail" TEXT;
