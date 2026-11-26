-- Partner change requests, partner contracts, and "commission set by staff" (owner, 2026-11-26).
-- Additive only: one nullable column and two new tables.

ALTER TABLE "Affiliate" ADD COLUMN "commissionSetAt" TIMESTAMP(3);

CREATE TABLE "AffiliateChangeRequest" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "bookingReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "staffNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AffiliateChangeRequest_affiliateId_createdAt_idx" ON "AffiliateChangeRequest"("affiliateId", "createdAt");
CREATE INDEX "AffiliateChangeRequest_status_idx" ON "AffiliateChangeRequest"("status");
ALTER TABLE "AffiliateChangeRequest" ADD CONSTRAINT "AffiliateChangeRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AffiliateContract" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL,
    "products" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "ruleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateContract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AffiliateContract_affiliateId_version_key" ON "AffiliateContract"("affiliateId", "version");
ALTER TABLE "AffiliateContract" ADD CONSTRAINT "AffiliateContract_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
