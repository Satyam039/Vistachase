-- Deposit payments (docs/DEPOSITS.md). Additive only: two new enum types, five Booking columns,
-- one Payment column and one index. Every existing booking reads as paymentPlan FULL and every
-- existing payment as kind FULL (the defaults), which is what they are, so nothing changes for
-- them. The previous release ignores the new columns, so a code rollback is safe.
--
-- Named 9c_ (not 10_) because Prisma applies migrations in name order and "10_" would sort before "1_".

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('FULL', 'DEPOSIT', 'BALANCE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
ADD COLUMN "depositAmount" INTEGER,
ADD COLUMN "balanceDueAt" TIMESTAMP(3),
ADD COLUMN "balancePaidAt" TIMESTAMP(3),
ADD COLUMN "balanceReminderStage" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "kind" "PaymentKind" NOT NULL DEFAULT 'FULL';

-- CreateIndex
CREATE INDEX "Booking_paymentPlan_status_idx" ON "Booking"("paymentPlan", "status");
