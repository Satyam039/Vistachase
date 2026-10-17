-- SEO portal page settings (docs/SEO_PORTAL.md, "Page settings"). Additive only: new nullable or
-- defaulted columns on SeoPage. Nothing is dropped, renamed or rewritten, and every new setting is
-- empty/off, so the public site renders exactly as before after this runs. The previous release
-- ignores these columns, so a code rollback is safe.

-- AlterTable
ALTER TABLE "SeoPage" ADD COLUMN     "searchTitle" TEXT,
ADD COLUMN     "searchDescription" TEXT,
ADD COLUMN     "searchImage" TEXT,
ADD COLUMN     "searchExclude" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customHeadCode" TEXT,
ADD COLUMN     "customBodyCode" TEXT;
