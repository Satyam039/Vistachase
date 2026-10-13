-- Partner commission ledger (additive only: new enums, new tables and two nullable Affiliate
-- columns; nothing is dropped, renamed or rewritten). The previous release ignores these tables,
-- so a code rollback is safe. Back up before applying in production.

-- CreateEnum
CREATE TYPE "CommissionEntryType" AS ENUM ('EARNED', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "payoutEmail" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "affiliateId" TEXT,
    "tourId" TEXT,
    "category" "TourCategory",
    "percentBps" INTEGER,
    "fixedCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "CommissionEntryType" NOT NULL,
    "basisCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "ruleId" TEXT,
    "ruleSnapshot" JSONB,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "payoutId" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "method" TEXT,
    "reference" TEXT,
    "createdById" TEXT,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "landingPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionRule_affiliateId_idx" ON "CommissionRule"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_entryKey_key" ON "CommissionLedger"("entryKey");

-- CreateIndex
CREATE INDEX "CommissionLedger_affiliateId_status_idx" ON "CommissionLedger"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "CommissionLedger_bookingId_idx" ON "CommissionLedger"("bookingId");

-- CreateIndex
CREATE INDEX "CommissionLedger_payoutId_idx" ON "CommissionLedger"("payoutId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_status_idx" ON "AffiliatePayout"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_createdAt_idx" ON "AffiliateClick"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_visitorHash_createdAt_idx" ON "AffiliateClick"("visitorHash", "createdAt");

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A rule is either a percentage or a fixed amount, never both or neither, and never negative.
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_amount_check"
  CHECK ((("percentBps" IS NULL) <> ("fixedCents" IS NULL))
         AND ("percentBps" IS NULL OR "percentBps" BETWEEN 0 AND 10000)
         AND ("fixedCents" IS NULL OR "fixedCents" >= 0));

-- Earned lines are never negative and reversals never positive.
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_sign_check"
  CHECK (("type" <> 'EARNED' OR "amountCents" >= 0) AND ("type" <> 'REVERSAL' OR "amountCents" <= 0));
