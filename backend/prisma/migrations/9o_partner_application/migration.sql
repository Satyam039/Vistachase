-- Partner application form answers and encrypted payout (wire) details. Additive, nullable.
ALTER TABLE "Affiliate" ADD COLUMN "application" JSONB,
ADD COLUMN "payoutDetails" TEXT;
