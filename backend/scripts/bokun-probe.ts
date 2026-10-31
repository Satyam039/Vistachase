// Read-only Bókun check: fetches the next two weeks of availability for one product and prints
// what the response looks like (field names and the first two entries), so the date sync can be
// matched to real data. Never prints the keys and never creates or changes anything in Bókun.
//
//   BOKUN_ACCESS_KEY=… BOKUN_SECRET_KEY=… BOKUN_API_URL=https://api.bokun.io \
//     npx tsx scripts/bokun-probe.ts 1167962     one product, full detail
//     npx tsx scripts/bokun-probe.ts --all       every mapped product, one summary each
//     npx tsx scripts/bokun-probe.ts --list      every product in the Bókun account, with categories

import { BokunApiClient } from "../src/modules/bokun/bokun.client";

/** One line per mapped product: our tour vs Bókun's name for that ID, dates found and pricing. */
async function checkAll(client: BokunApiClient, start: string, end: string) {
  const { PRODUCT_MAP } = await import("../src/modules/bokun/product-map");
  for (const product of PRODUCT_MAP.filter((p) => p.bokunId)) {
    try {
      const list = ((await client.getAvailabilities(product.bokunId!, start, end)) ?? []) as any[];
      const first = list[0];
      const rates = (first?.rates ?? []).map((r: any) => {
        const price = first.pricesByRate?.find((p: any) => p.activityRateId === r.id);
        const perBooking = price?.pricePerBooking?.amount;
        const perPerson = (price?.pricePerCategoryUnit ?? []).map((u: any) => u.amount?.amount ?? u.amount).filter(Boolean);
        return `${r.title} [${r.pricedPerPerson ? "per person" : "per booking"} ${perBooking ?? perPerson.join("/") ?? "?"}]`;
      });
      console.log(
        [
          `${product.slug} (${product.category}) → Bókun ${product.bokunId}: "${first?.activityTitle ?? "no dates"}"`,
          `   ${list.length} departures; first ${first ? `${new Date(first.date).toISOString().slice(0, 10)} ${first.startTime}, seats left ${first.availabilityCount}${first.soldOut ? " SOLD OUT" : ""}` : "-"}`,
          `   rates: ${rates.join("; ") || "-"}`,
          `   prices by category: ${JSON.stringify(first?.pricesByCategory ?? {})}`,
        ].join("\n"),
      );
    } catch (error) {
      console.log(`${product.slug} → Bókun ${product.bokunId}: ERROR ${(error as Error).message.slice(0, 120)}`);
    }
  }
}

/** Every product in the Bókun account: ID, title, and passenger categories (names and ages). */
async function listProducts(client: BokunApiClient) {
  const result: any = await client.fetch("POST", "/activity.json/search?lang=EN&currency=CAD", { page: 1, pageSize: 100 });
  const items: any[] = result?.items ?? result?.results ?? (Array.isArray(result) ? result : []);
  console.log(`${items.length} products (of ${result?.totalHits ?? "?"}):`);
  for (const item of items) {
    let categories = "";
    try {
      const detail: any = await client.fetch("GET", `/activity.json/${item.id}?lang=EN&currency=CAD`);
      categories = (detail?.pricingCategories ?? [])
        .map((c: any) => `${c.title}${c.minAge != null || c.maxAge != null ? ` (${c.minAge ?? 0}–${c.maxAge ?? "+"})` : ""} #${c.id}`)
        .join(", ");
    } catch {
      categories = "(details unavailable)";
    }
    console.log(`${item.id}  ${String(item.title ?? "").replace(/&amp;/g, "&")}\n      categories: ${categories || "-"}`);
  }
}

async function main() {
  const productId = process.argv[2] || "1167962"; // banff-highlights-tour
  const { BOKUN_ACCESS_KEY, BOKUN_SECRET_KEY } = process.env;
  const apiUrl = process.env.BOKUN_API_URL || "https://api.bokun.io";
  if (!BOKUN_ACCESS_KEY || !BOKUN_SECRET_KEY) throw new Error("Set BOKUN_ACCESS_KEY and BOKUN_SECRET_KEY in this terminal first.");

  const client = new BokunApiClient(BOKUN_ACCESS_KEY, BOKUN_SECRET_KEY, apiUrl);
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const start = day(1);
  const end = day(14);

  if (productId === "--list") return listProducts(client);
  if (productId === "--all") {
    console.log(`API: ${apiUrl}  checking every mapped product, dates ${start} → ${end}`);
    return checkAll(client, start, end);
  }
  console.log(`API: ${apiUrl}  product: ${productId}  dates: ${start} → ${end}`);
  const data = await client.getAvailabilities(productId, start, end);
  const list = Array.isArray(data) ? data : [];
  console.log(`Response type: ${Array.isArray(data) ? `array of ${list.length}` : typeof data}`);
  if (!Array.isArray(data)) console.log("Top-level keys:", Object.keys(data ?? {}));
  if (list.length > 0) {
    console.log("Fields on each entry:", Object.keys(list[0]).sort().join(", "));
    console.log("First entries:");
    console.log(JSON.stringify(list.slice(0, 2), null, 2));
  }
}

main().catch((error) => {
  // Bókun's error text (e.g. 401 Unauthorized) is safe to print; it never contains the keys.
  console.error("Bókun check failed:", (error as Error).message);
  process.exitCode = 1;
});
