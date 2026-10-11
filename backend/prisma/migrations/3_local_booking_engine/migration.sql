-- First-party booking engine (additive only: no column is dropped, renamed or narrowed).
-- Every new column is nullable or has a default, so the previous release keeps working against
-- the migrated database. Back up before applying in production (docs/BOOKING_ENGINE.md).

-- CreateEnum
CREATE TYPE "InventorySource" AS ENUM ('LOCAL', 'EXTERNAL', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "ExternalSyncStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'RETRYABLE_FAILURE', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "externalSyncStatus" "ExternalSyncStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "lastSyncAttemptAt" TIMESTAMP(3),
ADD COLUMN     "paymentExpiresAt" TIMESTAMP(3),
ADD COLUMN     "priceSnapshot" JSONB;

-- AlterTable
ALTER TABLE "ReservationHold" ADD COLUMN     "bookingId" TEXT;

-- AlterTable
ALTER TABLE "TourDeparture" ADD COLUMN     "inventorySource" "InventorySource" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "inventoryVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingSyncTask" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "SyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "externalRef" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSyncTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingSyncTask_idempotencyKey_key" ON "BookingSyncTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BookingSyncTask_status_nextAttemptAt_idx" ON "BookingSyncTask"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BookingSyncTask_bookingId_idx" ON "BookingSyncTask"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationHold_bookingId_key" ON "ReservationHold"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingSyncTask" ADD CONSTRAINT "BookingSyncTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Seats can never go negative or exceed the departure's capacity. NOT VALID: enforced for every
-- new insert and update, without scanning or rejecting existing rows; validate it separately with
--   ALTER TABLE "TourDeparture" VALIDATE CONSTRAINT "TourDeparture_capacity_check";
-- after the read-only consistency check in docs/BOOKING_ENGINE.md.
ALTER TABLE "TourDeparture" ADD CONSTRAINT "TourDeparture_capacity_check"
  CHECK ("capacityBooked" >= 0 AND "capacityHeld" >= 0 AND "capacityBooked" + "capacityHeld" <= "capacityTotal") NOT VALID;
