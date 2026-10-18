-- Webflow blog sync (docs/SEO_PORTAL.md, "Webflow sync"). Additive only: four new nullable columns
-- on SeoPage and a unique index on the Webflow item id. Nothing is dropped, renamed or rewritten and
-- every existing row keeps NULL, so the site renders exactly as before. The previous release ignores
-- these columns, so a code rollback is safe.
--
-- Named 9a_ (not 10_) because Prisma applies migrations in name order and "10_" would sort before "1_".

-- AlterTable
ALTER TABLE "SeoPage" ADD COLUMN     "webflowItemId" TEXT,
ADD COLUMN     "webflowSyncedAt" TIMESTAMP(3),
ADD COLUMN     "webflowHash" TEXT,
ADD COLUMN     "webflowOfflineAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "SeoPage_webflowItemId_key" ON "SeoPage"("webflowItemId");
