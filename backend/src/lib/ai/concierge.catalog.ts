/**
 * What the concierge says about a product, taken from the current website rather than the
 * database rows imported from the old Webflow site (owner, 2026-11-11: "use only the current
 * live website's tours, prices, schedules, pickup locations"). The database still carries old
 * Webflow titles ("Our Best Selling Banff Shared Tour", "Standard Banff Private Best Selling
 * Tour") and old descriptions/inclusions for the four doc tours; guests must never see them.
 *
 * Names follow frontend lib/sharedTours.ts and lib/privateTours.ts. Content for the four doc tours
 * lives in the approved knowledge base (knowledge.base.ts), which mirrors frontend lib/tourContent.ts.
 */

import { WEBSITE_TITLES } from "@/modules/bookings/tour-itinerary";
import { WEBSITE_CATALOG } from "./knowledge/website-catalog";

const CATALOG_NAMES: Record<string, string> = Object.fromEntries(
  WEBSITE_CATALOG.map((p) => [p.slug, p.name]),
);

/** The website's name for a product, where it differs from the database title (same as vouchers and emails). */
export const WEBSITE_NAMES: Record<string, string> = {
  ...CATALOG_NAMES,
  ...WEBSITE_TITLES,
};

/** One line on each doc tour, from the approved knowledge base and live website catalog. */
export const DOC_TOUR_SUMMARY: Record<string, string> = Object.fromEntries(
  WEBSITE_CATALOG.map((p) => [p.slug, p.overview]),
);

/**
 * Tours whose website page content comes from the live website catalog (frontend lib/tourContent.ts
 * and lib/sharedTours.ts), so the database summary, description, inclusions and highlights are
 * superseded by the fresh website text.
 */
export const DOC_TOUR_SLUGS = new Set(Object.keys(DOC_TOUR_SUMMARY));

/** A product's name as the website shows it. */
export function websiteName(t: { slug?: string | null; title?: string | null } | null | undefined, fallback = "Vista Chase experience"): string {
  if (!t) return fallback;
  return (t.slug && WEBSITE_NAMES[t.slug]) || t.title || fallback;
}

/** The product page path on the website. */
export const productPage = (slug: string) => `/${slug}`;
