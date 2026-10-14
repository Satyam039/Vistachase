-- SEO workspace (additive only): three staff roles, a research-status workflow for keywords and
-- the keyword-sheet columns the master sheet needs. Nothing is dropped, renamed or rewritten; the
-- previous release ignores the new columns and roles, so a code rollback is safe.
-- Needs PostgreSQL 12+ (several enum values added in one migration).

-- CreateEnum
CREATE TYPE "SeoResearchStatus" AS ENUM ('UNVERIFIED', 'RESEARCHED', 'VALIDATED', 'MAPPED', 'IMPLEMENTED', 'MONITORED');

-- AlterEnum


ALTER TYPE "Role" ADD VALUE 'SEO_MANAGER';
ALTER TYPE "Role" ADD VALUE 'EDITOR';
ALTER TYPE "Role" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "SeoKeyword" ADD COLUMN     "bookingIntent" INTEGER,
ADD COLUMN     "competitorEvidence" TEXT,
ADD COLUMN     "contentGap" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "market" TEXT NOT NULL DEFAULT 'CA',
ADD COLUMN     "parentTopic" TEXT,
ADD COLUMN     "recommendedAction" TEXT,
ADD COLUMN     "ref" SERIAL NOT NULL,
ADD COLUMN     "researchStatus" "SeoResearchStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_ref_key" ON "SeoKeyword"("ref");

-- CreateIndex
CREATE INDEX "SeoKeyword_researchStatus_idx" ON "SeoKeyword"("researchStatus");


-- Keywords already verified against a tool start as validated.
UPDATE "SeoKeyword" SET "researchStatus" = 'VALIDATED' WHERE "validationStatus" = 'VERIFIED';
