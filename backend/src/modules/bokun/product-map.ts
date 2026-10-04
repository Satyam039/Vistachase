import productMap from "../../../prisma/catalog/product-map.json";
import catalog from "../../../prisma/catalog/products.json";

/**
 * The product mapping table (prisma/catalog/product-map.json): website page ↔ Bokun
 * product ↔ Mornby tour. Bokun IDs are placeholders (null) until Vista Chase provides them;
 * until then a product is referred to as `pending:<slug>` wherever a Bokun ID is expected.
 */
export interface MappedProduct {
  slug: string;
  url: string;
  category: "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY";
  bookingMode: "BOKUN" | "ENQUIRY";
  bokunId: string | null;
  destination: string;
  mornbyTour: string | null;
  mornbyMatch: "confirmed" | "proposed" | "none";
  places: string[];
  season: "all" | "summer" | "winter";
}

export const PRODUCT_MAP = productMap.products as MappedProduct[];
export const CATALOG = catalog as { slug: string; title: string; priceFrom: number | null; priceUnit: string; facts: { label: string; value: string }[] }[];

const PENDING = "pending:";

/** The ID used for a product in Bokun-shaped data: its Bokun ID, or `pending:<slug>` until one is provided. */
export function bokunKey(product: MappedProduct) {
  return product.bokunId ?? `${PENDING}${product.slug}`;
}

/** Website slug for a Bokun product ID (or a `pending:<slug>` placeholder). */
export function slugForBokunId(id: string): string | undefined {
  if (id.startsWith(PENDING)) return PRODUCT_MAP.find((p) => p.slug === id.slice(PENDING.length))?.slug;
  return PRODUCT_MAP.find((p) => p.bokunId === id)?.slug;
}

/** Bokun API settings (.env). Empty until Vista Chase issues API keys. */
export function bokunConfig() {
  return {
    apiUrl: process.env.BOKUN_API_URL || "https://api.bokuntest.com",
    accessKey: process.env.BOKUN_ACCESS_KEY || "",
    secretKey: process.env.BOKUN_SECRET_KEY || "",
    onlineSalesChannelId: process.env.BOKUN_ONLINE_SALES_CHANNEL_ID || productMap.bokun.onlineSalesChannelId || "",
  };
}

/** What is still missing before the site can talk to Bokun. */
export function bokunReadiness() {
  const config = bokunConfig();
  const missingIds = PRODUCT_MAP.filter((p) => p.bookingMode === "BOKUN" && !p.bokunId).map((p) => p.slug);
  return {
    apiKeys: Boolean(config.accessKey && config.secretKey),
    onlineSalesChannel: Boolean(config.onlineSalesChannelId),
    productIdsMissing: missingIds,
    ready: Boolean(config.accessKey && config.secretKey && config.onlineSalesChannelId) && missingIds.length === 0,
  };
}
