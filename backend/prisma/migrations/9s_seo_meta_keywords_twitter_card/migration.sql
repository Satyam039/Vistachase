-- SEO portal page editor: meta keywords and the X (Twitter) card type per page.
-- Additive only: two nullable columns. Null keeps the page's metadata from its code, so nothing
-- changes on any page until someone saves a value in the SEO portal.

ALTER TABLE "SeoPage" ADD COLUMN IF NOT EXISTS "metaKeywords" TEXT;
ALTER TABLE "SeoPage" ADD COLUMN IF NOT EXISTS "twitterCard" TEXT;
