-- Partner coupons (affiliate account → Coupons) and "Where does it apply" (SHARED, PRIVATE, SHUTTLE).
-- Additive. Existing codes: appliesTo empty = everywhere, affiliateId null = a Vista Chase code.
-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "PromoCode_affiliateId_idx" ON "PromoCode"("affiliateId");

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

