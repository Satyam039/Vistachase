// Tours no longer in the owner's product list (Google Doc, Pricing, 2026-11-05: "Align this list of
// products in backend"; "We should only have 3 shared tours") and tickets taken off sale
// (2026-10-28). The backend keeps them off sale (REMOVED_TOUR_SLUGS in
// backend/src/modules/tours/product-map.ts); their old vistachase.com URLs send visitors, and search
// engines, to the closest single page we still offer (technical SEO recheck, 9 Nov 2026: a tour sent
// to a category page reads as a soft 404). The same redirects are saved in the SEO portal
// (BUILT_IN_REDIRECTS in backend/src/modules/seo/seo.redirects.ts), which the middleware applies
// first; this list is the fallback if the API can't be reached.
export const RETIRED_TOUR_REDIRECTS: Record<string, string> = {
  "shared-tours-heart-of-banff": "/banff-highlights-tour",
  "shared-tours-banff-yoho": "/banff-highlights-tour",
  "banff-yoho-custom-private-tour": "/banff-private-tour",
  "jasper-custom-private-tour": "/icefields-jasper-private-tour",
  // Owner, 25 Nov 2026: the winter tours are off the website again; both go to the shared Icefield tour.
  "winter-special": "/shared-tours-icefields-jasper",
  "winter-signature-private-tour": "/shared-tours-icefields-jasper",
  "open-top-touring-tickets": "/banff-highlights-tour",
  "banff-upper-hot-springs-tickets": "/destinations/banff-national-park",
};

/**
 * The two lake-shuttle products (owner, 25 Nov 2026: remove these two pages; the /shuttles page and its
 * booking stay). They stay on sale, because /shuttles books their departures, but their own pages
 * send visitors to /shuttles and every link on the site points there instead.
 */
export const SHUTTLE_PRODUCT_PAGES: Record<string, string> = {
  // Owner, 25 Nov 2026: sunrise = departures 1-2, day shuttle = departures 3-7. Departures 2 and 3 run
  // all season (June to September), so their cards are always on /shuttles.
  "sunrise-shuttle-to-moraine-lake-and-lake-louise": "/shuttles#shuttle-departure-2",
  "full-day-at-lake-louise-and-moraine-lake": "/shuttles#shuttle-departure-3",
};
export const SHUTTLE_PRODUCT_SLUGS = Object.keys(SHUTTLE_PRODUCT_PAGES);
Object.assign(RETIRED_TOUR_REDIRECTS, SHUTTLE_PRODUCT_PAGES);

/** Where a tour's link goes: its own page, or its departure on /shuttles for the shuttle products. */
export const tourPagePath = (slug: string) => SHUTTLE_PRODUCT_PAGES[slug] ?? `/${slug}`;
