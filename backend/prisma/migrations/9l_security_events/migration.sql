-- Admin → Security (owner, 2026-11-15): who sent each public form (IP + looked-up location) and
-- the IPs/emails an admin blocked. Additive only: two new tables, nothing existing changes, so a
-- code rollback is safe (the previous release never reads them).

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "form" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "email" TEXT,
    "name" TEXT,
    "userAgent" TEXT,
    "path" TEXT,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedSender" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_ip_idx" ON "SecurityEvent"("ip");

-- CreateIndex
CREATE INDEX "SecurityEvent_email_idx" ON "SecurityEvent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedSender_kind_value_key" ON "BlockedSender"("kind", "value");
