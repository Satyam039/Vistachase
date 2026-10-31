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
export const REMOVED_TOUR_SLUGS = ["banff-upper-hot-springs-tickets", "open-top-touring-tickets"];
export const ON_SALE = { slug: { notIn: REMOVED_TOUR_SLUGS } };

export const CATALOG = [...catalog, ...extraCatalog] as { slug: string; title: string; priceFrom: number | null; priceUnit: string; facts: { label: string; value: string }[] }[];
