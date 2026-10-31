-- Booking confirmation email with the PDF itinerary (src/modules/bookings/confirmation-email.ts).
-- Additive only: two nullable columns. confirmationEmailSentAt is claimed atomically before the
-- email goes out, so webhook retries and concurrent confirmations send it once; a failed send
-- clears it and records why in confirmationEmailError, and the jobs runner retries it. The
-- previous release never reads these columns, so a code rollback is safe.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "confirmationEmailError" TEXT;
