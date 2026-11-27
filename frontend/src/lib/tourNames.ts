// Tour names with their type in front (owner, 2026-11-27): "SHARED - COLUMBIA ICEFIELD ADVENTURE",
// "PRIVATE - BANFF & YOHO DISCOVERY", "MULTI-DAY ...", so a guest sees at a glance whether a tour is
// shared, private or multi-day. One place for every name: tour cards, tour pages, checkout,
// booking summaries, My Trips, admin, and (imported by the backend as @site/tourNames) emails,
// vouchers and PDFs.
//
// Display only: slugs, Bókun product/rate IDs and database titles are unchanged. This file must
// stay free of imports so the backend can load it.

export type TourType = "SHARED" | "PRIVATE" | "MULTI-DAY SHARED" | "MULTI-DAY PRIVATE";

/** "SHARED" + "Columbia Icefield Adventure" -> "SHARED - COLUMBIA ICEFIELD ADVENTURE". */
export const typedTourName = (type: TourType, name: string) => `${type} - ${baseTourName(name)}`.toUpperCase();

/**
 * The name without any type words it already carries ("Private Columbia Icefield Adventure",
 * "Banff & Yoho Discovery (Shared Tour)", "Two-Day Rockies Explorer – Shared Tour",
 * "Winter Special Shared Tour"), so the prefix is never doubled.
 */
export function baseTourName(name: string): string {
  return name
    .replace(/^\s*(shared|private|multi-day(\s+(shared|private))?)\s+-\s+/i, "")
    .replace(/\s*\((shared|private)( tour)?\)\s*$/i, "")
    .replace(/\s+[–—-]\s+(shared|private)( tour)?\s*$/i, "")
    .replace(/^\s*private\s+/i, "")
    .replace(/\s+(shared|private)\s+tour\s*$/i, "")
    .trim();
}

/** The four day tours on sale (database titles are old Webflow names, so these are fixed). */
export const DAY_TOUR_NAMES: Record<string, string> = {
  "banff-highlights-tour": typedTourName("SHARED", "Banff & Yoho Discovery"),
  "shared-tours-icefields-jasper": typedTourName("SHARED", "Columbia Icefield Adventure"),
  "banff-private-tour": typedTourName("PRIVATE", "Banff & Yoho Discovery"),
  "icefields-jasper-private-tour": typedTourName("PRIVATE", "Columbia Icefield Adventure"),
};

/** Multi-day journeys, by package slug (the backend's PACKAGES and the bookings' trip snapshot). */
export const PACKAGE_NAMES: Record<string, string> = {
  "two-day-rockies-explorer": typedTourName("MULTI-DAY SHARED", "Two-Day Rockies Explorer"),
  "two-day-rockies-explorer-private": typedTourName("MULTI-DAY PRIVATE", "Two-Day Rockies Explorer"),
  "three-day-rockies-discovery": typedTourName("MULTI-DAY PRIVATE", "Three-Day Rockies Discovery"),
  "four-day-rockies-and-jasper": typedTourName("MULTI-DAY PRIVATE", "Four-Day Rockies & Jasper"),
};

const PRIVATE_OPTION_NAMES: Record<string, string> = {
  "banff-yoho-private": DAY_TOUR_NAMES["banff-private-tour"],
  "columbia-icefield-private": DAY_TOUR_NAMES["icefields-jasper-private-tour"],
  "two-day-rockies-private": PACKAGE_NAMES["two-day-rockies-explorer-private"],
  "three-day-rockies-discovery": PACKAGE_NAMES["three-day-rockies-discovery"],
  "four-day-rockies-jasper": PACKAGE_NAMES["four-day-rockies-and-jasper"],
};

/** A Private Tours page option's card name (lib/privateTours.ts PRIVATE_OPTIONS, by id). */
export function privateOptionName(opt: { id: string; title: string; isCustomPartner?: boolean }): string {
  if (opt.isCustomPartner) return `${opt.title} – by Banff Elite`.toUpperCase();
  return PRIVATE_OPTION_NAMES[opt.id] ?? typedTourName("PRIVATE", opt.title);
}

const TYPE_BY_CATEGORY: Record<string, TourType> = { SHARED: "SHARED", PRIVATE: "PRIVATE" };

/**
 * A tour's name as the website shows it: the fixed name for the four day tours, else the title
 * with its type in front for any other shared or private tour. Shuttles, tickets and anything
 * else keep their own title.
 */
export function tourDisplayName(
  tour: { slug?: string | null; title?: string | null; category?: string | null } | null | undefined,
  fallback = "Vista Chase tour",
): string {
  if (!tour) return fallback;
  const fixed = tour.slug ? DAY_TOUR_NAMES[tour.slug] : undefined;
  if (fixed) return fixed;
  const title = tour.title || fallback;
  const type = tour.category ? TYPE_BY_CATEGORY[tour.category] : undefined;
  return type && tour.title ? typedTourName(type, title) : title;
}

/** A multi-day trip's name from its package slug, else the title it was booked under. */
export const packageDisplayName = (slug: string | null | undefined, title: string) => (slug && PACKAGE_NAMES[slug]) || title;
