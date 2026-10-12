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
export const CATALOG = [...catalog, ...extraCatalog] as { slug: string; title: string; priceFrom: number | null; priceUnit: string; facts: { label: string; value: string }[] }[];
