// Tours no longer in the owner's product list (Google Doc, Pricing, 2026-11-05: "Align this list of
// products in backend"; "We should only have 3 shared tours"). The backend keeps them off sale
// (RETIRED_TOUR_SLUGS in backend/src/modules/tours/product-map.ts); their old vistachase.com URLs
// send visitors, and search engines, to the closest page we still offer.
export const RETIRED_TOUR_REDIRECTS: Record<string, string> = {
  "shared-tours-heart-of-banff": "/shared-tours",
  "shared-tours-banff-yoho": "/banff-highlights-tour",
  "winter-special": "/shared-tours",
  "winter-signature-private-tour": "/private-tours",
  "banff-yoho-custom-private-tour": "/private-tours",
  "jasper-custom-private-tour": "/private-tours",
};
