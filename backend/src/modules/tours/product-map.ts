import productMap from "../../../prisma/catalog/product-map.json";
import catalog from "../../../prisma/catalog/products.json";
import extraCatalog from "../../../prisma/catalog/extra-products.json";

/**
 * The product mapping table (prisma/catalog/product-map.json): website page ↔ Bókun product ↔
 * Mornby tour, with each product's booking mode. With Bókun connected (docs/BOKUN.md), bookings
 * for a product with a `bokunId` are also created in Bókun and its seats are read from Bókun.
 */
export interface MappedProduct {
  slug: string;
  url: string;
  category: "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY" | "TICKET";
  bookingMode: "BOKUN" | "ENQUIRY";
  bokunId: string | null;
  /** Bókun start time IDs (owner's doc, 2026-11-05); see findSlot in modules/bokun/bokun-booking.ts. */
  bokunStartTimeIds?: number[];
  /** Bókun rate IDs per season (owner's doc, 2026-11-13): summer = June 1 to October 10. */
  bokunRateIds?: { summer?: number; winter?: number };
  destination: string;
  mornbyTour: string | null;
  mornbyMatch: "confirmed" | "proposed" | "none";
  places: string[];
  season: "all" | "summer" | "winter";
}

function parseProductOverrides(): Record<string, string> {
  const env = process.env.BOKUN_PRODUCT_OVERRIDES;
  if (!env) return {};
  try {
    return Object.fromEntries(
      env.split(",").map((pair) => pair.trim().split(":") as [string, string]),
    );
  } catch {
    return {};
  }
}

const overrides = parseProductOverrides();
export const PRODUCT_MAP = (productMap.products as MappedProduct[]).map((p) => {
  if (overrides[p.slug]) return { ...p, bokunId: overrides[p.slug] };
  return p;
});
/**
 * Products taken off sale (owner, 2026-10-28: the Banff Upper Hot Springs and Open Top Touring
 * tickets). They are gone from the catalog files, but databases seeded earlier still hold their
 * rows, which stay for past enquiries; public listings, product pages, the sitemap and the
 * concierge skip them with ON_SALE.
 */
/**
 * Tours not in the owner's product list (Google Doc, Pricing, 2026-11-05: "Align this list of
 * products in backend"; "We should only have 3 shared tours"). Off sale like the tickets above;
 * their old URLs send visitors to the closest offered page (frontend lib/retiredTours.ts).
 */
export const RETIRED_TOUR_SLUGS = [
  "shared-tours-heart-of-banff",
  "shared-tours-banff-yoho",
  "banff-yoho-custom-private-tour",
  "jasper-custom-private-tour",
];
/**
 * Tours brought back after being retired (owner, 2026-11-11: the winter tours "were live before",
 * bookable again December to April). Their old redirects are switched off on deploy
 * (scripts/apply-seo-fixes.ts) and their archived SEO page rows restored.
 */
export const RESTORED_TOUR_SLUGS = ["winter-special", "winter-signature-private-tour"];
export const REMOVED_TOUR_SLUGS = ["banff-upper-hot-springs-tickets", "open-top-touring-tickets", ...RETIRED_TOUR_SLUGS];
export const ON_SALE = { slug: { notIn: REMOVED_TOUR_SLUGS } };
/**
 * Activity tickets are hidden from guests on the website for now (owner, 2026-11-07); their rows
 * stay in the database and admin. The concierge leaves them out too, unless SHOW_ACTIVITY_TICKETS=true
 * (set it together with the frontend's NEXT_PUBLIC_SHOW_ACTIVITY_TICKETS=true to show them again).
 */
export const activityTicketsVisible = () => process.env.SHOW_ACTIVITY_TICKETS === "true";
/**
 * What the concierge may talk about: products listed on the website, without tickets while they're
 * hidden. The unlisted multi-day enquiry row (old Webflow "Multi-Day Canadian Rockies Experience")
 * is left out: the knowledge base describes the current multi-day packages and their pages.
 */
export const conciergeTours = () => {
  const listed = { slug: { notIn: [...REMOVED_TOUR_SLUGS, ...UNLISTED_TOUR_SLUGS] } };
  return activityTicketsVisible() ? listed : { ...listed, category: { not: "TICKET" as const } };
};
/**
 * Pages that stay (and stay in the sitemap) but are not listed as a product: the old multi-day
 * enquiry product's URL now shows the Multi-Day Journeys page (frontend app/multi-day-tour-package-for-banff).
 */
export const UNLISTED_TOUR_SLUGS = ["multi-day-tour-package-for-banff"];
/** Products listed on the site: search, home, category and destination pages. */
export const LISTED = { slug: { notIn: [...REMOVED_TOUR_SLUGS, ...UNLISTED_TOUR_SLUGS] } };
/** Products whose seats and links Bókun checks: linked, booked through Bókun, still offered. */
export const BOKUN_PRODUCTS = PRODUCT_MAP.filter((p) => p.bokunId && p.bookingMode === "BOKUN" && !REMOVED_TOUR_SLUGS.includes(p.slug));

export const CATALOG = [...catalog, ...extraCatalog] as { slug: string; title: string; priceFrom: number | null; priceUnit: string; facts: { label: string; value: string }[] }[];
