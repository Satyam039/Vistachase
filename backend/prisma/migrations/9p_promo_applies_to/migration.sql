-- Admin → Coupons "Where does it apply": SHARED, PRIVATE and/or SHUTTLE. Additive; existing codes
-- get an empty list, which means everywhere (as before).
ALTER TABLE "PromoCode" ADD COLUMN     "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[];
