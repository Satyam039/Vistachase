-- Private day tours' prices and group size from the owner's doc (Pricing, 2026-10-29): per vehicle,
-- up to 14 guests. Banff & Yoho Discovery (banff-private-tour) CAD 1,799 and Columbia Icefield
-- Adventure (icefields-jasper-private-tour) CAD 1,599 from June 1 to October 10; both CAD 1,299
-- from October 11 to May 31. scripts/seed-departures.ts creates new dates this way; this moves the
-- dates already on sale. Data only, no schema change. Bookings keep the price they were made at
-- (Booking.priceSnapshot).

UPDATE "TourDeparture" d
SET "price" = CASE
    WHEN to_char(d."date", 'MM-DD') BETWEEN '06-01' AND '10-10'
      THEN CASE t."slug" WHEN 'banff-private-tour' THEN 179900 ELSE 159900 END
    ELSE 129900
  END
FROM "Tour" t
WHERE t."id" = d."tourId"
  AND t."slug" IN ('banff-private-tour', 'icefields-jasper-private-tour')
  AND d."date" >= CURRENT_DATE;

-- 14 seats per vehicle. Only dates nobody holds or has booked on the website; a date Bókun's seat
-- sync marked full stays full.
UPDATE "TourDeparture" d
SET "capacityBooked" = CASE WHEN d."capacityBooked" > 0 THEN 14 ELSE 0 END,
    "capacityTotal" = 14
FROM "Tour" t
WHERE t."id" = d."tourId"
  AND t."slug" IN ('banff-private-tour', 'icefields-jasper-private-tour')
  AND d."date" >= CURRENT_DATE
  AND d."capacityTotal" < 14
  AND d."capacityHeld" = 0
  AND NOT EXISTS (
    SELECT 1 FROM "Booking" b
    WHERE b."tourDepartureId" = d."id"
      AND b."status" IN ('CONFIRMED', 'COMPLETED', 'PENDING_PAYMENT', 'PAID_UNSYNCED')
  );

UPDATE "Tour"
SET "maxGroupSize" = 14, "basePrice" = 129900
WHERE "slug" IN ('banff-private-tour', 'icefields-jasper-private-tour');
