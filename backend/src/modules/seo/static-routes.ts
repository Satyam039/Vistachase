// Public pages built in code (frontend/src/app). The SEO dashboard creates one SeoPage row for each
// on "Sync pages", and the sitemap lists the indexable ones. Tour and destination pages come from
// the database instead. Keep this list in step with frontend/src/app when a public page is added.

import type { SeoConversionGoal, SeoPageType } from "@prisma/client";

export interface StaticRoute {
  path: string;
  label: string;
  pageType: SeoPageType;
  /** Key pages: switching them to noindex needs an explicit confirmation. */
  important?: boolean;
  /** false = never in the sitemap (sign-in, checkout, redirects, search results). */
  indexable: boolean;
  conversionGoal?: SeoConversionGoal;
  sitemapPriority?: number;
}

export const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", label: "Home", pageType: "HOME", important: true, indexable: true, conversionGoal: "BOOKING", sitemapPriority: 1 },
  { path: "/private-tours", label: "Private tours", pageType: "LANDING", important: true, indexable: true, conversionGoal: "BOOKING", sitemapPriority: 0.9 },
  { path: "/shared-tours", label: "Shared tours", pageType: "LANDING", important: true, indexable: true, conversionGoal: "BOOKING", sitemapPriority: 0.9 },
  { path: "/shuttles", label: "Moraine Lake & Lake Louise shuttles", pageType: "LANDING", important: true, indexable: true, conversionGoal: "BOOKING", sitemapPriority: 0.9 },
  { path: "/two-day-rockies-explorer", label: "Two-Day Rockies Explorer", pageType: "LANDING", indexable: true, conversionGoal: "BOOKING", sitemapPriority: 0.8 },
  { path: "/three-day-rockies-discovery", label: "Three-Day Rockies Discovery", pageType: "LANDING", indexable: true, conversionGoal: "ENQUIRY", sitemapPriority: 0.8 },
  { path: "/four-day-rockies-and-jasper", label: "Four-Day Rockies & Jasper", pageType: "LANDING", indexable: true, conversionGoal: "ENQUIRY", sitemapPriority: 0.8 },
  { path: "/banff-activity-tickets", label: "Banff activity tickets", pageType: "LANDING", indexable: true, conversionGoal: "ENQUIRY", sitemapPriority: 0.7 },
  { path: "/destinations", label: "Destinations", pageType: "LANDING", indexable: true, sitemapPriority: 0.7 },
  { path: "/about-us", label: "About us", pageType: "STATIC", indexable: true, sitemapPriority: 0.5 },
  { path: "/contact-us", label: "Contact us", pageType: "STATIC", indexable: true, conversionGoal: "ENQUIRY", sitemapPriority: 0.5 },
  { path: "/faq", label: "FAQ", pageType: "STATIC", indexable: true, sitemapPriority: 0.6 },
  { path: "/guides", label: "Travel guides", pageType: "LANDING", indexable: true, sitemapPriority: 0.6 },
  { path: "/blog", label: "Blog", pageType: "LANDING", indexable: true, sitemapPriority: 0.6 },
  { path: "/gallery", label: "Gallery", pageType: "STATIC", indexable: true, sitemapPriority: 0.4 },
  { path: "/pickup-finder", label: "Pickup finder", pageType: "STATIC", indexable: true, sitemapPriority: 0.4 },
  { path: "/concierge", label: "Concierge", pageType: "STATIC", indexable: true, sitemapPriority: 0.3 },
  // /partners redirects here since 9 Nov 2026 (BUILT_IN_REDIRECTS).
  { path: "/affiliates", label: "Affiliate & partner program", pageType: "STATIC", indexable: true, sitemapPriority: 0.3 },
  // Migration doc, 9 Nov 2026: the partner portal's landing page is indexable and in the sitemap.
  { path: "/affiliate", label: "Affiliate portal", pageType: "STATIC", indexable: true, sitemapPriority: 0.3 },
  { path: "/privacy-policy-vista-chase", label: "Cancellation policy", pageType: "LEGAL", indexable: true, sitemapPriority: 0.2 },
  { path: "/privacy-policy", label: "Privacy policy", pageType: "LEGAL", indexable: true, sitemapPriority: 0.2 },
  { path: "/terms-and-conditions", label: "Terms and conditions", pageType: "LEGAL", indexable: true, sitemapPriority: 0.2 },
];

/** Public paths that are never listed or indexed (they exist, but have no search value). */
export const NON_INDEXABLE_PATHS = [
  "/book",
  "/search",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/partners/login",
  "/partners/dashboard",
  "/cancellation-policy", // redirects to /privacy-policy-vista-chase (the Webflow URL)
  "/seo", // SEO workspace (staff only)
  "/seo/login",
];

/** Prefix of CMS-managed editorial pages (frontend/src/app/guides/[slug]). */
export const GUIDE_PREFIX = "/guides/";

/** Blog posts keep the Webflow address /blog-post/<slug> (frontend/src/app/blog-post/[slug]). */
export const BLOG_PREFIX = "/blog-post/";

/** Every prefix a CMS page can live under. */
export const CMS_PREFIXES = [GUIDE_PREFIX, BLOG_PREFIX] as const;
export type CmsPrefix = (typeof CMS_PREFIXES)[number];

/** The CMS prefix of a path ("/guides/" or "/blog-post/"), else null. */
export const cmsPrefixOf = (path: string): CmsPrefix | null => CMS_PREFIXES.find((p) => path.startsWith(p)) ?? null;
