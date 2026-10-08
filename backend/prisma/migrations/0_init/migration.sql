-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'DISPATCHER', 'CUSTOMER', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'REFUNDED', 'COMPLETED', 'PAID_UNSYNCED');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONVERTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_SERVICE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PLANNED', 'READY', 'DISPATCHED', 'BOARDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DELAYED');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TourCategory" AS ENUM ('SHARED', 'PRIVATE', 'SHUTTLE', 'MULTIDAY', 'TICKET');

-- CreateEnum
CREATE TYPE "TourBookingMode" AS ENUM ('BOKUN', 'ENQUIRY');

-- CreateEnum
CREATE TYPE "TourPriceUnit" AS ENUM ('PERSON', 'GROUP');

-- CreateEnum
CREATE TYPE "DepartureStatus" AS ENUM ('ACTIVE', 'FULL', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL DEFAULT 'Alberta',
    "region" TEXT NOT NULL DEFAULT 'Canadian Rockies',
    "description" TEXT NOT NULL,
    "heroImage" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bokunId" TEXT,
    "title" TEXT NOT NULL,
    "category" "TourCategory" NOT NULL DEFAULT 'SHARED',
    "durationHours" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inclusions" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "whatToBring" JSONB NOT NULL,
    "featuredImage" TEXT NOT NULL,
    "galleryImages" JSONB NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "minGroupSize" INTEGER NOT NULL DEFAULT 1,
    "maxGroupSize" INTEGER NOT NULL DEFAULT 14,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "bookingMode" "TourBookingMode" NOT NULL DEFAULT 'BOKUN',
    "priceUnit" "TourPriceUnit" NOT NULL DEFAULT 'PERSON',
    "facts" JSONB NOT NULL DEFAULT '[]',
    "tabs" JSONB NOT NULL DEFAULT '[]',
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "crossSells" JSONB NOT NULL DEFAULT '[]',
    "vehicleOptions" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "destinationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleRoute" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "isReturn" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ShuttleRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShuttleStop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "instructions" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShuttleStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourDeparture" (
    "id" TEXT NOT NULL,
    "tourId" TEXT,
    "shuttleRouteId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "returnTime" TIMESTAMP(3),
    "capacityTotal" INTEGER NOT NULL DEFAULT 14,
    "capacityBooked" INTEGER NOT NULL DEFAULT 0,
    "capacityHeld" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "DepartureStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationHold" (
    "id" TEXT NOT NULL,
    "holdToken" TEXT NOT NULL,
    "tourDepartureId" TEXT NOT NULL,
    "seatsCount" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "bookingReference" TEXT NOT NULL,
    "affiliateId" TEXT,
    "bokunBookingId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "tourDepartureId" TEXT NOT NULL,
    "pickupStopId" TEXT,
    "pickupCustomText" TEXT,
    "pickupTime" TEXT,
    "adultsCount" INTEGER NOT NULL DEFAULT 1,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "infantsCount" INTEGER NOT NULL DEFAULT 0,
    "totalSeats" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "addOnsTotal" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "specialRequests" TEXT,
    "voucherCode" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "trackingToken" TEXT,
    "trackingTokenExpiresAt" TIMESTAMP(3),
    "isBoarded" BOOLEAN NOT NULL DEFAULT false,
    "boardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddOn" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BookingAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "provider" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "bookingId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VAN_14',
    "capacity" INTEGER NOT NULL DEFAULT 14,
    "licensePlate" TEXT NOT NULL,
    "vinNumber" TEXT,
    "trackingDeviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseClass" TEXT NOT NULL DEFAULT 'Class 4',
    "bio" TEXT,
    "photoUrl" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3),
    "tourDepartureId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunBooking" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "pickupOrder" INTEGER NOT NULL DEFAULT 0,
    "isBoarded" BOOLEAN NOT NULL DEFAULT false,
    "boardedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "RunBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingSession" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePosition" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppNotification" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'T_60_TRACKING',
    "phone" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BokunSyncLog" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BokunSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'tours',
    "altText" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HOTEL',
    "website" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "bokunChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "tourSlug" TEXT,
    "guests" INTEGER,
    "date" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Destination_slug_idx" ON "Destination"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_slug_key" ON "Tour"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_bokunId_key" ON "Tour"("bokunId");

-- CreateIndex
CREATE INDEX "Tour_slug_idx" ON "Tour"("slug");

-- CreateIndex
CREATE INDEX "Tour_bokunId_idx" ON "Tour"("bokunId");

-- CreateIndex
CREATE INDEX "Tour_category_idx" ON "Tour"("category");

-- CreateIndex
CREATE INDEX "Tour_destinationId_idx" ON "Tour"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleRoute_slug_key" ON "ShuttleRoute"("slug");

-- CreateIndex
CREATE INDEX "ShuttleRoute_slug_idx" ON "ShuttleRoute"("slug");

-- CreateIndex
CREATE INDEX "ShuttleStop_town_idx" ON "ShuttleStop"("town");

-- CreateIndex
CREATE INDEX "TourDeparture_date_idx" ON "TourDeparture"("date");

-- CreateIndex
CREATE INDEX "TourDeparture_tourId_idx" ON "TourDeparture"("tourId");

-- CreateIndex
CREATE INDEX "TourDeparture_shuttleRouteId_idx" ON "TourDeparture"("shuttleRouteId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationHold_holdToken_key" ON "ReservationHold"("holdToken");

-- CreateIndex
CREATE INDEX "ReservationHold_holdToken_idx" ON "ReservationHold"("holdToken");

-- CreateIndex
CREATE INDEX "ReservationHold_expiresAt_idx" ON "ReservationHold"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingReference_key" ON "Booking"("bookingReference");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bokunBookingId_key" ON "Booking"("bokunBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_voucherCode_key" ON "Booking"("voucherCode");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_trackingToken_key" ON "Booking"("trackingToken");

-- CreateIndex
CREATE INDEX "Booking_bookingReference_idx" ON "Booking"("bookingReference");

-- CreateIndex
CREATE INDEX "Booking_affiliateId_idx" ON "Booking"("affiliateId");

-- CreateIndex
CREATE INDEX "Booking_bokunBookingId_idx" ON "Booking"("bokunBookingId");

-- CreateIndex
CREATE INDEX "Booking_trackingToken_idx" ON "Booking"("trackingToken");

-- CreateIndex
CREATE INDEX "Booking_customerEmail_idx" ON "Booking"("customerEmail");

-- CreateIndex
CREATE INDEX "Booking_voucherCode_idx" ON "Booking"("voucherCode");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_tourId_idx" ON "Review"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_licensePlate_key" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_trackingDeviceId_key" ON "Vehicle"("trackingDeviceId");

-- CreateIndex
CREATE INDEX "Vehicle_licensePlate_idx" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE INDEX "Driver_email_idx" ON "Driver"("email");

-- CreateIndex
CREATE INDEX "OperationRun_date_idx" ON "OperationRun"("date");

-- CreateIndex
CREATE INDEX "OperationRun_status_idx" ON "OperationRun"("status");

-- CreateIndex
CREATE INDEX "OperationRun_tourDepartureId_idx" ON "OperationRun"("tourDepartureId");

-- CreateIndex
CREATE INDEX "RunBooking_runId_idx" ON "RunBooking"("runId");

-- CreateIndex
CREATE INDEX "RunBooking_bookingId_idx" ON "RunBooking"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "RunBooking_runId_bookingId_key" ON "RunBooking"("runId", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSession_runId_key" ON "TrackingSession"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSession_token_key" ON "TrackingSession"("token");

-- CreateIndex
CREATE INDEX "TrackingSession_token_idx" ON "TrackingSession"("token");

-- CreateIndex
CREATE INDEX "VehiclePosition_vehicleId_timestamp_idx" ON "VehiclePosition"("vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "WhatsAppNotification_bookingId_idx" ON "WhatsAppNotification"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppNotification_bookingId_type_key" ON "WhatsAppNotification"("bookingId", "type");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_createdAt_idx" ON "Enquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourDeparture" ADD CONSTRAINT "TourDeparture_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourDeparture" ADD CONSTRAINT "TourDeparture_shuttleRouteId_fkey" FOREIGN KEY ("shuttleRouteId") REFERENCES "ShuttleRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHold" ADD CONSTRAINT "ReservationHold_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "ShuttleStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRun" ADD CONSTRAINT "OperationRun_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRun" ADD CONSTRAINT "OperationRun_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRun" ADD CONSTRAINT "OperationRun_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunBooking" ADD CONSTRAINT "RunBooking_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OperationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunBooking" ADD CONSTRAINT "RunBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OperationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePosition" ADD CONSTRAINT "VehiclePosition_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppNotification" ADD CONSTRAINT "WhatsAppNotification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

