import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import { VISTACHASE_STATIC_KNOWLEDGE_BASE } from "./knowledge.base";
import { ON_SALE } from "@/modules/tours/product-map";

const CACHE_KEY = "vistachase:master_knowledge_base";
const CACHE_META_KEY = "vistachase:master_knowledge_base_meta";
const IN_MEMORY_TTL_MS = 60 * 60 * 1000; // 1 hour memory cache

interface KnowledgeBaseMetadata {
  version: string;
  hash: string;
  compiledAt: string;
  tourCount: number;
  shuttleStopCount: number;
  byteLength: number;
}

let memoryCache: { text: string; meta: KnowledgeBaseMetadata; expiresAt: number } | null = null;

/**
 * Checks whether Moraine Lake Road is seasonally closed based on Mountain Time
 */
function isMoraineLakeRoadSeasonallyClosed(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    month: "numeric",
  });
  const month = parseInt(formatter.format(now), 10);
  return month >= 10 || month <= 5; // mid-October through late May
}

/**
 * Compiles the Master Knowledge Base from live database rows, product catalogs, and policies.
 */
export async function syncMasterKnowledgeBase(): Promise<KnowledgeBaseMetadata> {
  const cache = getCacheProvider();

  let liveTourCatalog = "";
  let tourCount = 0;
  let stopCount = 0;

  try {
    const tours = await prisma.tour.findMany({
      where: ON_SALE,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        durationHours: true,
        basePrice: true,
        currency: true,
        priceUnit: true,
        summary: true,
        bookingMode: true,
      },
      orderBy: [{ category: "asc" }, { basePrice: "asc" }],
    });

    const stops = await prisma.shuttleStop.findMany({
      where: { isActive: true },
      select: { name: true, town: true, address: true },
      orderBy: { sortOrder: "asc" },
    });

    tourCount = tours.length;
    stopCount = stops.length;

    const tourLines = tours.map((t) => {
      const priceFormatted =
        t.basePrice > 0
          ? `CAD $${(t.basePrice / 100).toFixed(2)} ${t.priceUnit === "GROUP" ? "per vehicle" : "per guest"}`
          : "Price on request";
      return `- **${t.title}** (Slug: \`${t.slug}\`) · ${t.category} · Duration: ~${t.durationHours}h · ${priceFormatted} · Mode: ${t.bookingMode}. ${t.summary}`;
    });

    const towns = [...new Set(stops.map((s) => s.town))];
    const stopSample = stops.slice(0, 8).map((s) => `${s.name} (${s.town})`).join("; ");

    liveTourCatalog = `
---

## 8. Live Synchronized Catalog & Verified Stops (Updated Daily)
- **Active Bookable Tours (${tourCount} Live Products):**
${tourLines.join("\n")}

- **Verified Hotel & Hub Pickup Stops (${stopCount} Active Stops in ${towns.join(", ")}):**
  - Key Hubs: ${stopSample}
  - Doorstep hotel pickups operate for all major hotels across Banff, Canmore, and Lake Louise.
`;
  } catch (dbErr) {
    console.warn(
      "[knowledge.sync] Live catalog database read failed; falling back to core knowledge base:",
      (dbErr as Error).message
    );
  }

  const isWinter = isMoraineLakeRoadSeasonallyClosed();
  const roadStatusNote = isWinter
    ? "\n> [!NOTE] Current Parks Canada Status: Moraine Lake Road and Takakkaw Falls are CLOSED for the winter season (mid-October to late May). Tours operate winter itineraries including Johnston Canyon Icewalk and Abraham Lake ice bubbles.\n"
    : "\n> [!NOTE] Current Parks Canada Status: Moraine Lake Road is OPEN for licensed commercial tour operators.\n";

  // Build the complete master knowledge text
  const masterContent = `${VISTACHASE_STATIC_KNOWLEDGE_BASE}\n${roadStatusNote}\n${liveTourCatalog}`.trim();

  // Compute hash and version
  const hash = crypto.createHash("sha256").update(masterContent).digest("hex").slice(0, 16);
  const version = `kb_${new Date().toISOString().slice(0, 10)}_${hash.slice(0, 6)}`;
  const metadata: KnowledgeBaseMetadata = {
    version,
    hash,
    compiledAt: new Date().toISOString(),
    tourCount,
    shuttleStopCount: stopCount,
    byteLength: Buffer.byteLength(masterContent, "utf8"),
  };

  // Persist to cache (Redis / Memory)
  await cache.set(CACHE_KEY, masterContent, 24 * 60 * 60); // 24-hour TTL in cache
  await cache.set(CACHE_META_KEY, metadata, 24 * 60 * 60);

  // Update in-memory cache
  memoryCache = {
    text: masterContent,
    meta: metadata,
    expiresAt: Date.now() + IN_MEMORY_TTL_MS,
  };

  console.log(
    `[knowledge.sync] Master knowledge base updated: Version ${version} (${metadata.byteLength} bytes, ${tourCount} tours, ${stopCount} stops)`
  );

  return metadata;
}

/**
 * Retrieves the compiled Master Knowledge Base text for the agent prompt.
 * Seamlessly refreshes if missing or expired.
 */
export async function getMasterKnowledgeBase(): Promise<string> {
  // 1. Check in-memory cache
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    return memoryCache.text;
  }

  // 2. Check distributed cache (Redis)
  const cache = getCacheProvider();
  const cachedText = await cache.get<string>(CACHE_KEY);
  if (cachedText) {
    const cachedMeta = await cache.get<KnowledgeBaseMetadata>(CACHE_META_KEY);
    if (cachedMeta) {
      memoryCache = {
        text: cachedText,
        meta: cachedMeta,
        expiresAt: Date.now() + IN_MEMORY_TTL_MS,
      };
      return cachedText;
    }
  }

  // 3. If cache is empty, trigger an automated compile
  try {
    const meta = await syncMasterKnowledgeBase();
    if (memoryCache) return memoryCache.text;
  } catch (err) {
    console.warn("[knowledge.sync] Dynamic sync failed; using static fallback:", (err as Error).message);
  }

  // 4. Ultimate fallback
  return VISTACHASE_STATIC_KNOWLEDGE_BASE;
}

/**
 * Returns metadata about the current knowledge base version
 */
export async function getKnowledgeBaseMetadata(): Promise<KnowledgeBaseMetadata | null> {
  if (memoryCache?.meta) return memoryCache.meta;
  const cache = getCacheProvider();
  return cache.get<KnowledgeBaseMetadata>(CACHE_META_KEY);
}

/**
 * Invalidate knowledge base cache (called by admin or webhook when a tour/price changes)
 */
export async function invalidateKnowledgeBase(): Promise<KnowledgeBaseMetadata> {
  memoryCache = null;
  const cache = getCacheProvider();
  await cache.del(CACHE_KEY);
  await cache.del(CACHE_META_KEY);
  return syncMasterKnowledgeBase();
}
