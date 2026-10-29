import productMap from "../../../prisma/catalog/product-map.json";
import catalog from "../../../prisma/catalog/products.json";
import extraCatalog from "../../../prisma/catalog/extra-products.json";

/**
 * The product mapping table (prisma/catalog/product-map.json): website page ↔ Mornby tour, with
 * each product's booking mode. `bokunId` is kept as historical data from the retired Bókun
 * integration; nothing calls Bókun any more.
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

export const PRODUCT_MAP = productMap.products as MappedProduct[];
/**
 * Products taken off sale (owner, 2026-10-28: the Banff Upper Hot Springs and Open Top Touring
 * tickets). They are gone from the catalog files, but databases seeded earlier still hold their
 * rows, which stay for past enquiries; public listings, product pages, the sitemap and the
 * concierge skip them with ON_SALE.
 */
export const REMOVED_TOUR_SLUGS = ["banff-upper-hot-springs-tickets", "open-top-touring-tickets"];
export const ON_SALE = { slug: { notIn: REMOVED_TOUR_SLUGS } };

export const CATALOG = [...catalog, ...extraCatalog] as { slug: string; title: string; priceFrom: number | null; priceUnit: string; facts: { label: string; value: string }[] }[];
