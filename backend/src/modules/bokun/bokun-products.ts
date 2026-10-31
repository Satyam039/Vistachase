// Which Bókun products the connected account has, next to the website products linked to them
// (prisma/catalog/product-map.json, BOKUN_PRODUCT_OVERRIDES). A test account (api.bokuntest.com)
// has its own product IDs, so the live IDs in product-map.json aren't found there: this list shows
// the account's IDs, and Admin → Bookings → Bókun builds the BOKUN_PRODUCT_OVERRIDES line from it.

import { PRODUCT_MAP } from "@/modules/tours/product-map";
import { bokunClient, type BokunApi } from "@/modules/bokun/config";

export interface BokunActivity {
  id: string;
  title: string;
}

export interface BokunProductCheck {
  /** Products in the connected Bókun account (first 200). */
  activities: BokunActivity[];
  /** Each website product that books through Bókun, and whether its Bókun ID is in the account. */
  products: { slug: string; bokunId: string | null; found: boolean; title: string | null }[];
}

/** Reads the account's products from Bókun and checks the website's links against them. */
export async function checkBokunProducts(client: BokunApi | null = bokunClient()): Promise<BokunProductCheck | null> {
  if (!client) return null;
  const raw = await client.fetch("POST", "/activity.json/search?lang=EN&currency=CAD", { page: 1, pageSize: 200 });
  const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.results) ? raw.results : [];
  const activities = items
    .filter((a) => a && a.id != null)
    .map((a) => ({ id: String(a.id), title: String(a.title ?? a.name ?? "") }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const byId = new Map(activities.map((a) => [a.id, a]));
  const products = PRODUCT_MAP.filter((p) => p.bookingMode === "BOKUN").map((p) => {
    const match = p.bokunId ? byId.get(String(p.bokunId)) : undefined;
    return { slug: p.slug, bokunId: p.bokunId, found: Boolean(match), title: match?.title ?? null };
  });
  return { activities, products };
}
