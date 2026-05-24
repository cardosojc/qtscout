-- Per-scout milestone record for noites de campo badges (25/50/75/100/200).
CREATE TABLE "scout_nights_badges" (
    "id" TEXT NOT NULL,
    "scoutId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scout_nights_badges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scout_nights_badges_scoutId_count_key" ON "scout_nights_badges"("scoutId", "count");
CREATE INDEX "scout_nights_badges_awardedAt_idx" ON "scout_nights_badges"("awardedAt");

ALTER TABLE "scout_nights_badges"
  ADD CONSTRAINT "scout_nights_badges_scoutId_fkey"
  FOREIGN KEY ("scoutId") REFERENCES "scouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
