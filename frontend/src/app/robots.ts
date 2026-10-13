import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo/server";

// Signed-in and staff areas aren't crawled. Checkout (/book) and search are crawlable on purpose:
// their pages say noindex, and a crawler has to fetch a page to see that. /api stays crawlable so
// pages that load content in the browser (reviews) render for search engines. SEO_BLOCK_INDEXING=true (staging, or a
// site still on a bare IP) asks every crawler to stay away.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  if (process.env.SEO_BLOCK_INDEXING === "true") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/booking", "/partners/dashboard"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
