-- SEO dashboard (docs/SEO.md). Additive only: new enums and new tables. No existing table, column
-- or row is changed, renamed or dropped (Tour and Destination are referenced, not altered), so the
-- previous release keeps working against this database. Back up before applying in production.
-- Rollback (only if needed, after reverting the code): docs/SEO.md "Rolling back".

-- CreateEnum
CREATE TYPE "SeoPageType" AS ENUM ('HOME', 'TOUR', 'DESTINATION', 'LANDING', 'GUIDE', 'STATIC', 'LEGAL');

-- CreateEnum
CREATE TYPE "SeoPageSource" AS ENUM ('STATIC_ROUTE', 'TOUR', 'DESTINATION', 'CMS');

-- CreateEnum
CREATE TYPE "SeoPublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SeoConversionGoal" AS ENUM ('BOOKING', 'ENQUIRY', 'CALL', 'NEWSLETTER', 'NONE');

-- CreateEnum
CREATE TYPE "SeoSearchIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL');

-- CreateEnum
CREATE TYPE "SeoFunnelStage" AS ENUM ('TOFU', 'MOFU', 'BOFU');

-- CreateEnum
CREATE TYPE "SeoStrategyTrack" AS ENUM ('TRAFFIC_ACQUISITION', 'BOOKING_CONVERSION');

-- CreateEnum
CREATE TYPE "SeoPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SeoKeywordStatus" AS ENUM ('IDEA', 'PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SeoValidationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SeoMetricBasis" AS ENUM ('UNKNOWN', 'ESTIMATE', 'RESEARCHED');

-- CreateEnum
CREATE TYPE "SeoMappingRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "SeoIssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SeoIssueStatus" AS ENUM ('OPEN', 'IGNORED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SeoAuditTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "SeoAuditStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SeoLlmsSection" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateTable
CREATE TABLE "SeoPage" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageType" "SeoPageType" NOT NULL,
    "source" "SeoPageSource" NOT NULL,
    "tourId" TEXT,
    "destinationId" TEXT,
    "label" TEXT NOT NULL,
    "status" "SeoPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "important" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "focusKeyword" TEXT,
    "secondaryKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canonicalUrl" TEXT,
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "twitterTitle" TEXT,
    "twitterDescription" TEXT,
    "twitterImage" TEXT,
    "breadcrumbLabel" TEXT,
    "excerpt" TEXT,
    "body" TEXT,
    "answerSnippet" TEXT,
    "citationFact" TEXT,
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "authorName" TEXT,
    "authorBio" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "featuredImage" TEXT,
    "featuredImageAlt" TEXT,
    "imageTitle" TEXT,
    "imageCaption" TEXT,
    "imageFileName" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "conversionGoal" "SeoConversionGoal" NOT NULL DEFAULT 'NONE',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "pillar" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sitemapPriority" DOUBLE PRECISION,
    "lastCrawl" JSONB,
    "lastCrawledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoPageRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoPageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordCluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pillar" TEXT,
    "track" "SeoStrategyTrack" NOT NULL,
    "description" TEXT,
    "hubPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeywordCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeyword" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "designation" "SeoMappingRole" NOT NULL DEFAULT 'SECONDARY',
    "searchVolume" INTEGER,
    "volumeBasis" "SeoMetricBasis" NOT NULL DEFAULT 'UNKNOWN',
    "volumeSource" TEXT,
    "difficulty" INTEGER,
    "difficultyBasis" "SeoMetricBasis" NOT NULL DEFAULT 'UNKNOWN',
    "difficultySource" TEXT,
    "intent" "SeoSearchIntent" NOT NULL,
    "funnelStage" "SeoFunnelStage" NOT NULL,
    "track" "SeoStrategyTrack" NOT NULL,
    "clusterId" TEXT,
    "targetPath" TEXT,
    "targetPageType" "SeoPageType",
    "priority" "SeoPriority" NOT NULL DEFAULT 'MEDIUM',
    "businessRelevance" INTEGER,
    "competitionNotes" TEXT,
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SeoKeywordStatus" NOT NULL DEFAULT 'IDEA',
    "dataSource" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "validationStatus" "SeoValidationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordMapping" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "role" "SeoMappingRole" NOT NULL DEFAULT 'SECONDARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeywordMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRedirect" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoAuditRun" (
    "id" TEXT NOT NULL,
    "trigger" "SeoAuditTrigger" NOT NULL,
    "status" "SeoAuditStatus" NOT NULL DEFAULT 'RUNNING',
    "startedById" TEXT,
    "baseUrl" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SeoAuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoIssue" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "SeoIssueSeverity" NOT NULL,
    "status" "SeoIssueStatus" NOT NULL DEFAULT 'OPEN',
    "path" TEXT,
    "pageId" TEXT,
    "message" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "lastRunId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SeoIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "siteName" TEXT NOT NULL DEFAULT 'Vista Chase',
    "summary" TEXT,
    "aboutText" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "serviceArea" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessHours" TEXT,
    "googleBusinessUrl" TEXT,
    "sameAs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "llmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoLlmsEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,
    "section" "SeoLlmsSection" NOT NULL DEFAULT 'PRIMARY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoLlmsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoSearchMetric" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "query" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoSearchMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoPage_path_key" ON "SeoPage"("path");

-- CreateIndex
CREATE UNIQUE INDEX "SeoPage_tourId_key" ON "SeoPage"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoPage_destinationId_key" ON "SeoPage"("destinationId");

-- CreateIndex
CREATE INDEX "SeoPage_pageType_idx" ON "SeoPage"("pageType");

-- CreateIndex
CREATE INDEX "SeoPage_status_idx" ON "SeoPage"("status");

-- CreateIndex
CREATE INDEX "SeoPageRevision_pageId_createdAt_idx" ON "SeoPageRevision"("pageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeywordCluster_name_key" ON "SeoKeywordCluster"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_normalized_key" ON "SeoKeyword"("normalized");

-- CreateIndex
CREATE INDEX "SeoKeyword_clusterId_idx" ON "SeoKeyword"("clusterId");

-- CreateIndex
CREATE INDEX "SeoKeyword_status_idx" ON "SeoKeyword"("status");

-- CreateIndex
CREATE INDEX "SeoKeyword_track_priority_idx" ON "SeoKeyword"("track", "priority");

-- CreateIndex
CREATE INDEX "SeoKeywordMapping_pageId_idx" ON "SeoKeywordMapping"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeywordMapping_keywordId_pageId_key" ON "SeoKeywordMapping"("keywordId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoRedirect_fromPath_key" ON "SeoRedirect"("fromPath");

-- CreateIndex
CREATE INDEX "SeoRedirect_active_idx" ON "SeoRedirect"("active");

-- CreateIndex
CREATE INDEX "SeoAuditRun_startedAt_idx" ON "SeoAuditRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeoIssue_fingerprint_key" ON "SeoIssue"("fingerprint");

-- CreateIndex
CREATE INDEX "SeoIssue_status_severity_idx" ON "SeoIssue"("status", "severity");

-- CreateIndex
CREATE INDEX "SeoIssue_pageId_idx" ON "SeoIssue"("pageId");

-- CreateIndex
CREATE INDEX "SeoLlmsEntry_section_sortOrder_idx" ON "SeoLlmsEntry"("section", "sortOrder");

-- CreateIndex
CREATE INDEX "SeoSearchMetric_path_date_idx" ON "SeoSearchMetric"("path", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SeoSearchMetric_source_path_date_query_key" ON "SeoSearchMetric"("source", "path", "date", "query");

-- AddForeignKey
ALTER TABLE "SeoPage" ADD CONSTRAINT "SeoPage_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoPage" ADD CONSTRAINT "SeoPage_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoPageRevision" ADD CONSTRAINT "SeoPageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SeoPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoKeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeywordMapping" ADD CONSTRAINT "SeoKeywordMapping_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeywordMapping" ADD CONSTRAINT "SeoKeywordMapping_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SeoPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoIssue" ADD CONSTRAINT "SeoIssue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SeoPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoIssue" ADD CONSTRAINT "SeoIssue_lastRunId_fkey" FOREIGN KEY ("lastRunId") REFERENCES "SeoAuditRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guard rails the application also validates (Prisma doesn't model CHECK constraints).
ALTER TABLE "SeoRedirect" ADD CONSTRAINT "SeoRedirect_statusCode_check" CHECK ("statusCode" IN (301, 302, 307, 308));
ALTER TABLE "SeoRedirect" ADD CONSTRAINT "SeoRedirect_not_self_check" CHECK ("fromPath" <> "toPath");
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_difficulty_check" CHECK ("difficulty" IS NULL OR ("difficulty" >= 0 AND "difficulty" <= 100));
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_searchVolume_check" CHECK ("searchVolume" IS NULL OR "searchVolume" >= 0);
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_businessRelevance_check" CHECK ("businessRelevance" IS NULL OR ("businessRelevance" >= 1 AND "businessRelevance" <= 5));
