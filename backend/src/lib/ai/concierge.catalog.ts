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

/** The website's name for a product, where it differs from the database title (same as vouchers and emails). */
export const WEBSITE_NAMES: Record<string, string> = WEBSITE_TITLES;

/**
 * Tours whose website page content comes from the owner's doc (frontend lib/tourContent.ts), so
 * the database summary, description, inclusions and highlights are the old Webflow text.
 */
export const DOC_TOUR_SLUGS = new Set(Object.keys(WEBSITE_NAMES));

/** One line on each doc tour, from the approved knowledge base. */
export const DOC_TOUR_SUMMARY: Record<string, string> = {
  "banff-highlights-tour":
    "Small-group day through Banff and Yoho: Lake Louise, seasonal Moraine Lake, Emerald Lake and more, about 10 to 11 hours.",
  "shared-tours-icefields-jasper":
    "Small-group day on the Icefields Parkway: Bow Lake, Crowfoot Glacier, Peyto Lake and the Columbia Icefield (activity included on summer departures), about 9 to 11 hours. It does not go to Jasper town.",
  "banff-private-tour":
    "Your own vehicle and driver-guide for the Banff and Yoho day: Lake Louise, seasonal Moraine Lake, Emerald Lake and more. Priced per vehicle.",
  "icefields-jasper-private-tour":
    "Your own vehicle and driver-guide on the Icefields Parkway to the Columbia Icefield and back. Activities are optional extras. Priced per vehicle.",
};

/** A product's name as the website shows it. */
export function websiteName(t: { slug?: string | null; title?: string | null } | null | undefined, fallback = "Vista Chase experience"): string {
  if (!t) return fallback;
  return (t.slug && WEBSITE_NAMES[t.slug]) || t.title || fallback;
}

/** The product page path on the website. */
export const productPage = (slug: string) => `/${slug}`;
