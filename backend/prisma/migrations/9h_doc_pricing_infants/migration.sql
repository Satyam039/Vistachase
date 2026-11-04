-- Owner's "Update Vista Chase web" doc, pricing table (2026-11-04).
--
-- 1. Infants (0-5) can now have their own fare. TourDeparture.infantPrice (cents): set = infants pay
--    it and take a seat; null = infants ride free on a lap (shuttles, private vehicles), as before.
-- 2. Prices for the dates already on sale (scripts/seed-departures.ts creates new dates the same way).
--    Summer = June 1 to October 10. Bookings keep the price they were made at (Booking.priceSnapshot).
-- 3. Bókun product IDs from the doc for the four day tours (prisma/catalog/product-map.json).

ALTER TABLE "TourDeparture" ADD COLUMN IF NOT EXISTS "infantPrice" INTEGER;

-- Banff & Yoho Discovery (shared): adult 220, youth 220, infant 170, all year.
UPDATE "TourDeparture" d
SET "price" = 22000, "childPrice" = 22000, "infantPrice" = 17000
FROM "Tour" t
WHERE t."id" = d."tourId" AND t."slug" = 'banff-highlights-tour' AND d."date" >= CURRENT_DATE;

-- Columbia Icefield Adventure (shared): summer 320 / 280 / 170, winter 220 / 220 / 170.
UPDATE "TourDeparture" d
SET "price" = CASE WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10' THEN 32000 ELSE 22000 END,
    "childPrice" = CASE WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10' THEN 28000 ELSE 22000 END,
    "infantPrice" = 17000
FROM "Tour" t
WHERE t."id" = d."tourId" AND t."slug" = 'shared-tours-icefields-jasper' AND d."date" >= CURRENT_DATE;

-- Private day tours, per vehicle: summer 1,750, winter 1,240.
UPDATE "TourDeparture" d
SET "price" = CASE WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10' THEN 175000 ELSE 124000 END
FROM "Tour" t
WHERE t."id" = d."tourId" AND t."slug" IN ('banff-private-tour', 'icefields-jasper-private-tour') AND d."date" >= CURRENT_DATE;

-- Moraine Lake & Lake Louise shuttle, per guest by departure (Banff pickup time): 1-2 = 130,
-- 3-4 = 120, 5-7 = 108.
UPDATE "TourDeparture" d
SET "price" = CASE
    WHEN to_char(d."departureTime", 'HH24:MI') IN ('03:15', '04:15') THEN 13000
    WHEN to_char(d."departureTime", 'HH24:MI') IN ('06:30', '10:15') THEN 12000
    ELSE 10800
  END
FROM "Tour" t
WHERE t."id" = d."tourId"
  AND t."slug" IN ('sunrise-shuttle-to-moraine-lake-and-lake-louise', 'full-day-at-lake-louise-and-moraine-lake')
  AND d."date" >= CURRENT_DATE;

UPDATE "Tour" SET "basePrice" = 22000 WHERE "slug" IN ('banff-highlights-tour', 'shared-tours-icefields-jasper');
UPDATE "Tour" SET "basePrice" = 124000 WHERE "slug" IN ('banff-private-tour', 'icefields-jasper-private-tour');
UPDATE "Tour" SET "basePrice" = 13000 WHERE "slug" = 'sunrise-shuttle-to-moraine-lake-and-lake-louise';
UPDATE "Tour" SET "basePrice" = 10800 WHERE "slug" = 'full-day-at-lake-louise-and-moraine-lake';

-- Bókun IDs (unique): free the ones changing hands first.
UPDATE "Tour" SET "bokunId" = NULL WHERE "bokunId" IN ('796650', '856008', '1115237') OR "slug" IN ('banff-highlights-tour', 'shared-tours-icefields-jasper', 'icefields-jasper-private-tour');
UPDATE "Tour" SET "bokunId" = '796650' WHERE "slug" = 'banff-highlights-tour';
UPDATE "Tour" SET "bokunId" = '856008' WHERE "slug" = 'shared-tours-icefields-jasper';
UPDATE "Tour" SET "bokunId" = '1115237' WHERE "slug" = 'icefields-jasper-private-tour';
