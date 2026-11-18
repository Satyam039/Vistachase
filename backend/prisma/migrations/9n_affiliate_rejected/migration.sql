-- Partner applications staff turn down (additive: a new enum value, no data changes).
ALTER TYPE "AffiliateStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
