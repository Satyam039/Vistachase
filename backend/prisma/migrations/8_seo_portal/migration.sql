-- SEO portal (/seo, docs/SEO_PORTAL.md). Additive only: new enums and tables, and new nullable or
-- defaulted columns on SeoPage, SeoIssue and SeoSiteSettings. Nothing is dropped, renamed or
-- rewritten, and every new setting is empty/off, so the public site is unchanged after this runs.
-- The previous release ignores the new columns and tables, so a code rollback is safe.

-- CreateEnum
CREATE TYPE "SeoSchemaScope" AS ENUM ('SITE', 'PAGE');

-- CreateEnum
CREATE TYPE "SeoSchemaStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SeoTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "SeoChecklistPhase" AS ENUM ('BEFORE_LAUNCH', 'AFTER_LAUNCH');

-- CreateEnum
CREATE TYPE "SeoChecklistStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "SeoChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SeoIssue" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "SeoPage" ADD COLUMN     "dateModified" TIMESTAMP(3),
ADD COLUMN     "datePublished" TIMESTAMP(3),
ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "draftUpdatedById" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "importSource" TEXT,
ADD COLUMN     "originalUrl" TEXT,
ADD COLUMN     "sitemapInclude" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "thumbnailAlt" TEXT,
ADD COLUMN     "thumbnailImage" TEXT;

-- AlterTable
ALTER TABLE "SeoSiteSettings" ADD COLUMN     "conversionScript" TEXT,
ADD COLUMN     "crawlerRules" JSONB,
ADD COLUMN     "googleSiteVerification" TEXT,
ADD COLUMN     "tracking" JSONB;

-- CreateTable
CREATE TABLE "SeoSchemaBlock" (
    "id" TEXT NOT NULL,
    "scope" "SeoSchemaScope" NOT NULL,
    "pageId" TEXT,
    "name" TEXT NOT NULL,
    "schemaType" TEXT NOT NULL,
    "json" JSONB,
    "draftJson" JSONB,
    "status" "SeoSchemaStatus" NOT NULL DEFAULT 'DRAFT',
    "validation" JSONB NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSchemaBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SeoTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "SeoPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "path" TEXT,
    "keywordId" TEXT,
    "issueId" TEXT,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoChecklistItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "phase" "SeoChecklistPhase" NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'HANDOFF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SeoChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "assigneeName" TEXT,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "autoCheck" TEXT,
    "lastCheck" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoChangeRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "before" JSONB,
    "reason" TEXT,
    "status" "SeoChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoImportBatch" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "fileName" TEXT,
    "raw" JSONB NOT NULL,
    "preview" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "createdById" TEXT,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBaselineUrl" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "redirectTo" TEXT,
    "title" TEXT,
    "description" TEXT,
    "canonical" TEXT,
    "h1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "robots" TEXT,
    "ogTitle" TEXT,
    "ogImage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CRAWL',
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoBaselineUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoSchemaBlock_scope_status_idx" ON "SeoSchemaBlock"("scope", "status");

-- CreateIndex
CREATE INDEX "SeoSchemaBlock_pageId_idx" ON "SeoSchemaBlock"("pageId");

-- CreateIndex
CREATE INDEX "SeoTask_status_idx" ON "SeoTask"("status");

-- CreateIndex
CREATE INDEX "SeoTask_assigneeId_idx" ON "SeoTask"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoChecklistItem_key_key" ON "SeoChecklistItem"("key");

-- CreateIndex
CREATE INDEX "SeoChecklistItem_phase_sortOrder_idx" ON "SeoChecklistItem"("phase", "sortOrder");

-- CreateIndex
CREATE INDEX "SeoChangeRequest_status_createdAt_idx" ON "SeoChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SeoImportBatch_kind_createdAt_idx" ON "SeoImportBatch"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "SeoBaselineUrl_path_idx" ON "SeoBaselineUrl"("path");

-- CreateIndex
CREATE UNIQUE INDEX "SeoBaselineUrl_batchId_path_key" ON "SeoBaselineUrl"("batchId", "path");

