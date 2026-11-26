-- Shuttle departures 1-2 (sunrise product, 03:15 and 04:15 from Banff): CAD 135 per person
-- (owner, 2026-11-26). Adults, children and infants pay the same fare. scripts/seed-departures.ts
-- already creates new dates at 135; this moves the dates already on sale (created at 130) to it.
-- Bookings keep the price they were made at (Booking.priceSnapshot). Data updates only: future
-- departures of this one product and its "From" price.

UPDATE "TourDeparture" d
SET "price" = 13500, "childPrice" = 13500, "infantPrice" = 13500
FROM "Tour" t
WHERE t."id" = d."tourId"
  AND t."slug" = 'sunrise-shuttle-to-moraine-lake-and-lake-louise'
  AND d."date" >= CURRENT_DATE;

UPDATE "Tour" SET "basePrice" = 13500 WHERE "slug" = 'sunrise-shuttle-to-moraine-lake-and-lake-louise';
