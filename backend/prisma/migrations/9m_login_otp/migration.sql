-- AlterTable
ALTER TABLE "User" ADD COLUMN "loginOtp" TEXT,
ADD COLUMN "loginOtpExpiry" TIMESTAMP(3),
ADD COLUMN "pendingEmail" TEXT,
ADD COLUMN "emailChangeToken" TEXT,
ADD COLUMN "emailChangeExpiry" TIMESTAMP(3);
