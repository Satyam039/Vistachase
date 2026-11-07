// Read-only Bókun check: fetches the next two weeks of availability for one product and prints
// what the response looks like (field names and the first two entries), so the date sync can be
// matched to real data. Never prints the keys and never creates or changes anything in Bókun.
//
//   BOKUN_ACCESS_KEY=… BOKUN_SECRET_KEY=… BOKUN_API_URL=https://api.bokun.io \
//     npx tsx scripts/bokun-probe.ts 1167962     one product, full detail
//     npx tsx scripts/bokun-probe.ts --all       every mapped product, one summary each
//     npx tsx scripts/bokun-probe.ts --list      every product in the Bókun account, with categories
//     npx tsx scripts/bokun-probe.ts 30190 2026-11-15   one product, every start time Bókun has that day
//     npx tsx scripts/bokun-probe.ts --times     every tour: Bókun's start times vs this site's, month by month
//
// Reads backend/.env, so on the server no keys need typing.

import "dotenv/config";
import { BokunApiClient } from "../src/modules/bokun/bokun.client";

/** One line per mapped product: our tour vs Bókun's name for that ID, dates found and pricing. */
async function checkAll(client: BokunApiClient, start: string, end: string) {
  const { PRODUCT_MAP } = await import("../src/modules/tours/product-map");
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

/** Every start time Bókun returns for one product on one day (asked with a day either side). */
async function checkDay(client: BokunApiClient, productId: string, date: string) {
  const { slotDate, slotTime, shiftDay } = await import("../src/modules/bokun/bokun-booking");
  const { PRODUCT_MAP } = await import("../src/modules/tours/product-map");
  const tours = PRODUCT_MAP.filter((p) => p.bokunId === productId).map((p) => p.slug);
  console.log(`Bókun product ${productId} is used by: ${tours.join(", ") || "no tour on this site (check BOKUN_PRODUCT_OVERRIDES)"}`);
  for (const [start, end] of [[date, date], [shiftDay(date, -1), shiftDay(date, 1)]]) {
    const list = (((await client.getAvailabilities(productId, start, end)) ?? []) as any[]);
    console.log(`\nAsked ${start} → ${end}: ${list.length} entries`);
    for (const a of list) {
      console.log(
        `  ${slotDate(a)} ${slotTime(a)}  raw date ${JSON.stringify(a.date)}  seats ${a.availabilityCount ?? "?"}${a.soldOut ? " SOLD OUT" : ""}${a.unavailable ? " UNAVAILABLE" : ""}`,
      );
    }
  }
}

/**
 * Every tour linked to Bókun: the start times Bókun offers each month over the next year, next to
 * the times this site's departures have that month (read from the database, nothing changed).
 * "MISMATCH" marks a month where the two lists differ.
 */
async function checkTimes(client: BokunApiClient) {
  const { slotDate, slotTime } = await import("../src/modules/bokun/bokun-booking");
  const { PRODUCT_MAP } = await import("../src/modules/tours/product-map");
  const { formatTimeOfDay } = await import("../src/lib/utils/time");
  const { prisma } = await import("../src/lib/db/prisma");
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const start = day(1);
  const end = day(365);
  console.log(`Start times, ${start} → ${end} (Bókun first, then this site)`);
  for (const product of PRODUCT_MAP.filter((p) => p.bokunId)) {
    try {
      const list = ((await client.getAvailabilities(product.bokunId!, start, end)) ?? []) as any[];
      const bokun = new Map<string, Set<string>>();
      for (const a of list) {
        if (a.unavailable) continue;
        const month = slotDate(a).slice(0, 7);
        if (!bokun.has(month)) bokun.set(month, new Set());
        bokun.get(month)!.add(`${slotTime(a)}${a.startTimeId ? `#${a.startTimeId}` : ""}`);
      }
      const deps = await prisma.tourDeparture.findMany({
        where: { tour: { slug: product.slug }, date: { gte: new Date(start), lte: new Date(end) }, status: { not: "CANCELLED" } },
        select: { date: true, departureTime: true, inventorySource: true },
      });
      const site = new Map<string, Set<string>>();
      for (const d of deps) {
        const month = d.date.toISOString().slice(0, 7);
        if (!site.has(month)) site.set(month, new Set());
        site.get(month)!.add(`${formatTimeOfDay(d.departureTime)}${d.inventorySource === "LOCAL" ? "" : ` (${d.inventorySource})`}`);
      }
      console.log(`\n${product.slug} (${product.category}) → Bókun ${product.bokunId}`);
      const months = [...new Set([...bokun.keys(), ...site.keys()])].sort();
      if (months.length === 0) console.log("   no dates on either side");
      for (const month of months) {
        const b = [...(bokun.get(month) ?? [])].sort();
        const s = [...(site.get(month) ?? [])].sort();
        const bTimes = [...new Set(b.map((t) => t.slice(0, 5)))].join(",");
        const sTimes = [...new Set(s.map((t) => t.slice(0, 5)))].join(",");
        console.log(`   ${month}  Bókun: ${b.join(" ") || "-"}   site: ${s.join(" ") || "-"}${bTimes === sTimes ? "" : "   MISMATCH"}`);
      }
    } catch (error) {
      console.log(`${product.slug} → Bókun ${product.bokunId}: ERROR ${(error as Error).message.slice(0, 120)}`);
    }
  }
  await prisma.$disconnect();
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
  if (productId === "--times") return checkTimes(client);
  const onDate = process.argv[3];
  if (onDate && /^\d{4}-\d{2}-\d{2}$/.test(onDate)) return checkDay(client, productId, onDate);
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
