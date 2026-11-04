-- Prices from the owner's doc (Pricing, 2026-11-04). Adult 16–99, Youth 6–15, Infant 0–5.
-- Adds an infant price per departure: when it is set, infants pay it and take a seat; when it is
-- null (every departure until now), infants travel free on a lap as before. Then moves the dates
-- already on sale to the new prices; scripts/seed-departures.ts creates new dates the same way.
-- Bookings keep the price they were made at (Booking.priceSnapshot). Additive: one new nullable
-- column and data updates of future departures only.

ALTER TABLE "TourDeparture" ADD COLUMN "infantPrice" INTEGER;

-- Banff & Yoho Discovery (shared): CAD 220 adult and youth, 170 infant, all year.
UPDATE "TourDeparture" d
SET "price" = 22000, "childPrice" = 22000, "infantPrice" = 17000
FROM "Tour" t
WHERE t."id" = d."tourId" AND t."slug" = 'banff-highlights-tour' AND d."date" >= CURRENT_DATE;

-- Columbia Icefield Adventure (shared): June 1 – October 10 CAD 320 / 280 / 170, otherwise 220 / 220 / 170.
UPDATE "TourDeparture" d
SET "price" = CASE WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10' THEN 32000 ELSE 22000 END,
    "childPrice" = CASE WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10' THEN 28000 ELSE 22000 END,
    "infantPrice" = 17000
FROM "Tour" t
WHERE t."id" = d."tourId" AND t."slug" = 'shared-tours-icefields-jasper' AND d."date" >= CURRENT_DATE;

-- Private vehicle (Banff & Yoho Discovery, Columbia Icefield Adventure): June 1 – October 10
-- CAD 1,750, otherwise CAD 1,240 per vehicle.
UPDATE "TourDeparture" d
SET "price" = CASE WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10' THEN 175000 ELSE 124000 END
FROM "Tour" t
WHERE t."id" = d."tourId" AND t."slug" IN ('banff-private-tour', 'icefields-jasper-private-tour') AND d."date" >= CURRENT_DATE;

-- Moraine Lake & Lake Louise shuttle, same price for every age, by departure: 1–2 (03:15, 04:15)
-- CAD 130; 3–4 (06:30, 10:15) CAD 120; 5–7 (11:30, 14:00, 16:45) CAD 108. Other times are older
-- dates the doc doesn't list; they keep their price.
UPDATE "TourDeparture" d
SET "price" = p.cents, "childPrice" = p.cents, "infantPrice" = p.cents
FROM "Tour" t,
  (VALUES ('03:15', 13000), ('04:15', 13000), ('06:30', 12000), ('10:15', 12000),
          ('11:30', 10800), ('14:00', 10800), ('16:45', 10800)) AS p(slot, cents)
WHERE t."id" = d."tourId"
  AND t."slug" IN ('sunrise-shuttle-to-moraine-lake-and-lake-louise', 'full-day-at-lake-louise-and-moraine-lake')
  AND to_char(d."departureTime", 'HH24:MI') = p.slot
  AND d."date" >= CURRENT_DATE;

-- "From" prices shown on cards (cents).
UPDATE "Tour" SET "basePrice" = 22000 WHERE "slug" IN ('banff-highlights-tour', 'shared-tours-icefields-jasper');
UPDATE "Tour" SET "basePrice" = 124000 WHERE "slug" IN ('banff-private-tour', 'icefields-jasper-private-tour');
UPDATE "Tour" SET "basePrice" = 13000 WHERE "slug" = 'sunrise-shuttle-to-moraine-lake-and-lake-louise';
UPDATE "Tour" SET "basePrice" = 10800 WHERE "slug" = 'full-day-at-lake-louise-and-moraine-lake';
