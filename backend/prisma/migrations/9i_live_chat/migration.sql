-- Live chat between guests and staff ("Chat with a live agent" in the AI concierge,
-- src/modules/support/live-chat.ts). Additive only: two new tables, nothing existing changes, so a
-- code rollback is safe (the previous release never reads them).

-- CreateTable
CREATE TABLE "LiveChat" (
    "id" TEXT NOT NULL,
    "guestTokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "language" TEXT,
    "page" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "agentId" TEXT,
    "agentName" TEXT,
    "enquiryId" TEXT,
    "lastGuestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAgentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveChat_status_createdAt_idx" ON "LiveChat"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_chatId_createdAt_idx" ON "LiveChatMessage"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "LiveChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
