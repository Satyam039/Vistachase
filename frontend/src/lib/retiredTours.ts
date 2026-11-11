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
  "open-top-touring-tickets": "/banff-highlights-tour",
  "banff-upper-hot-springs-tickets": "/destinations/banff-national-park",
};
