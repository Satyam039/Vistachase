-- Staff follow-up flags on bookings (additive only: two new enums and one new table; nothing is
-- dropped, renamed or rewritten). The previous release ignores the table, so a code rollback is
-- safe. Back up before applying in production (the deploy does this when a migration is pending).

-- CreateEnum
CREATE TYPE "BookingFlagType" AS ENUM ('PAYMENT_AMOUNT_MISMATCH', 'LATE_PAYMENT', 'REFUND_DUE', 'PAYMENT_DUE', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingFlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "BookingFlag" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "BookingFlagType" NOT NULL,
    "status" "BookingFlagStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT NOT NULL,
    "amountCents" INTEGER,
    "createdById" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingFlag_status_type_idx" ON "BookingFlag"("status", "type");

-- CreateIndex
CREATE INDEX "BookingFlag_bookingId_idx" ON "BookingFlag"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingFlag" ADD CONSTRAINT "BookingFlag_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: payments already flagged in the audit log (amount mismatch, paid after expiry) become
-- open flags, so nothing flagged before this release is lost. Ids are derived from the audit row,
-- so the statement is safe to re-run.
INSERT INTO "BookingFlag" ("id", "bookingId", "type", "status", "note", "createdAt")
SELECT 'flag_' || md5(a."id"), a."entityId", a."action"::"BookingFlagType", 'OPEN',
       COALESCE(a."details"->>'note', a."action"), a."createdAt"
FROM "AuditLog" a
JOIN "Booking" b ON b."id" = a."entityId"
WHERE a."entityType" = 'Booking' AND a."action" IN ('PAYMENT_AMOUNT_MISMATCH', 'LATE_PAYMENT')
ON CONFLICT ("id") DO NOTHING;
