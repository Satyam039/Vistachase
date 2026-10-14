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
  { path: "/banff-activity-tickets", label: "Banff activity tickets", pageType: "LANDING", indexable: true, conversionGoal: "ENQUIRY", sitemapPriority: 0.7 },
  { path: "/destinations", label: "Destinations", pageType: "LANDING", indexable: true, sitemapPriority: 0.7 },
  { path: "/about-us", label: "About us", pageType: "STATIC", indexable: true, sitemapPriority: 0.5 },
  { path: "/contact-us", label: "Contact us", pageType: "STATIC", indexable: true, conversionGoal: "ENQUIRY", sitemapPriority: 0.5 },
  { path: "/faq", label: "FAQ", pageType: "STATIC", indexable: true, sitemapPriority: 0.6 },
  { path: "/guides", label: "Travel guides", pageType: "LANDING", indexable: true, sitemapPriority: 0.6 },
  { path: "/gallery", label: "Gallery", pageType: "STATIC", indexable: true, sitemapPriority: 0.4 },
  { path: "/pickup-finder", label: "Pickup finder", pageType: "STATIC", indexable: true, sitemapPriority: 0.4 },
  { path: "/concierge", label: "Concierge", pageType: "STATIC", indexable: true, sitemapPriority: 0.3 },
  { path: "/partners", label: "Partner program", pageType: "STATIC", indexable: true, sitemapPriority: 0.3 },
  { path: "/affiliates", label: "Travel trade & agents", pageType: "STATIC", indexable: true, sitemapPriority: 0.3 },
  { path: "/cancellation-policy", label: "Cancellation policy", pageType: "LEGAL", indexable: true, sitemapPriority: 0.2 },
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
  "/privacy-policy-vista-chase", // redirects to /privacy-policy
];

/** Prefix of CMS-managed editorial pages (frontend/src/app/guides/[slug]). */
export const GUIDE_PREFIX = "/guides/";
