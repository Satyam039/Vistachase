-- Security hardening (docs/SECURITY_HARDENING.md). Additive only: one nullable column and three
-- indexes. Nothing is dropped, renamed or rewritten; every existing row keeps NULL, so existing
-- sign-ins keep working. The previous release ignores the column, so a code rollback is safe.
--
-- Named 9b_ (not 10_) because Prisma applies migrations in name order and "10_" would sort before "1_".

-- AlterTable: sign-ins issued before this moment are refused (set on password reset, and when an
-- unverified account is made staff).
ALTER TABLE "User" ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);

-- CreateIndex: trips by account, seats by departure and status, and the unpaid-checkout sweep.
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");
CREATE INDEX "Booking_tourDepartureId_status_idx" ON "Booking"("tourDepartureId", "status");
CREATE INDEX "Booking_status_paymentExpiresAt_idx" ON "Booking"("status", "paymentExpiresAt");
