-- Snapshot of noites de campo accumulated before the system started
-- tracking activity participation. Manually entered per scout.
ALTER TABLE "scouts" ADD COLUMN "noitesCampoInicial" INTEGER NOT NULL DEFAULT 0;
