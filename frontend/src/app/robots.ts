import type { MetadataRoute } from "next";
import { getSiteConfig, siteOrigin } from "@/lib/seo/server";

// Signed-in and staff areas aren't crawled. Checkout (/book) and search are crawlable on purpose:
// their pages say noindex, and a crawler has to fetch a page to see that. /api stays crawlable so
// pages that load content in the browser (reviews) render for search engines. SEO_BLOCK_INDEXING=true (staging, or a
// site still on a bare IP) asks every crawler to stay away.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = siteOrigin();
  if (process.env.SEO_BLOCK_INDEXING === "true") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  // AI crawlers an SEO manager chose to block in the SEO portal (Technical SEO → Crawler access).
  // Search engines can never be blocked there; by default the list is empty and nothing changes.
  const blocked = (await getSiteConfig())?.crawlerRules ?? [];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/booking", "/partners/dashboard", "/seo"],
      },
      ...blocked.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
