-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

