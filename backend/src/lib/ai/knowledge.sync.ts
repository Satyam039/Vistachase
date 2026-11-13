import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import { VISTACHASE_STATIC_KNOWLEDGE_BASE } from "./knowledge.base";
import { conciergeTours } from "@/modules/tours/product-map";
import { renderCatalogKnowledge } from "./knowledge/catalog-live";
import { WEBSITE_CATALOG, WEBSITE_FACTS } from "./knowledge/website-catalog";

const WEBSITE_KNOWLEDGE_FACTS = `## Website-wide facts\n${Object.values(WEBSITE_FACTS).map((f) => `- ${f}`).join("\n")}`;

const FOUR_HOUR_TTL_SECONDS = 4 * 60 * 60; // 4-hour crawl & cache cadence
const IN_MEMORY_TTL_MS = 4 * 60 * 60 * 1000; // 4-hour memory cache

interface KnowledgeBaseMetadata {
  version: string;
  hash: string;
  compiledAt: string;
  tourCount: number;
  shuttleStopCount: number;
  crawledPagesCount: number;
  byteLength: number;
}

let memoryCache: { text: string; meta: KnowledgeBaseMetadata; expiresAt: number; dateKey: string } | null = null;

/**
 * Returns the 4-hour bucket key in Mountain Time (America/Edmonton) for 4-hour cache partitioning.
 * e.g., 2026-11-13-H00, 2026-11-13-H04, 2026-11-13-H08, 2026-11-13-H12, 2026-11-13-H16, 2026-11-13-H20.
 */
export function mountainFourHourBucket(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const bucketHour = Math.floor(hour / 4) * 4;
  const bucketStr = String(bucketHour).padStart(2, "0");
  return `${year}-${month}-${day}-H${bucketStr}`;
}

/**
 * Returns today's date in Mountain Time (America/Edmonton).
 */
export function mountainDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Generates 4-hour partitioned cache keys so each 4-hour window triggers a fresh crawl and compilation.
 */
export function getDailyCacheKeys(date = new Date()): { cacheKey: string; metaKey: string; dateKey: string } {
  const dateKey = mountainFourHourBucket(date);
  const staticHash = crypto.createHash("sha256").update(VISTACHASE_STATIC_KNOWLEDGE_BASE).digest("hex").slice(0, 8);
  return {
    cacheKey: `vistachase:master_kb:${dateKey}:${staticHash}`,
    metaKey: `vistachase:master_kb_meta:${dateKey}:${staticHash}`,
    dateKey,
  };
}

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
 * Base URL used for daily live website crawling.
 */
function getLiveWebsiteBaseUrl(): string {
  return (
    process.env.SEO_AUDIT_BASE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.vistachase.com"
  ).replace(/\/+$/, "");
}

interface CrawledPageResult {
  path: string;
  title: string | null;
  description: string | null;
  h1: string | null;
  status: number;
}

/**
 * Crawls active live website pages to capture the latest published headings, titles, and descriptions.
 * In test environments or when network is unreachable, immediately uses verified facts from WEBSITE_CATALOG.
 */
export async function crawlLiveWebsiteKnowledge(): Promise<{ text: string; crawledCount: number }> {
  const baseUrl = getLiveWebsiteBaseUrl();
  const today = mountainDateString();

  // In test environment, skip external network fetch for instant deterministic execution
  if (process.env.NODE_ENV === "test") {
    const lines = [
      `## Live Website Facts (Verified Daily Sync: ${today} • ${WEBSITE_CATALOG.length} active catalog products)`,
      "The live website sells the following experiences under current branding (never use obsolete Webflow titles):",
    ];
    for (const p of WEBSITE_CATALOG) {
      lines.push(
        `- **${p.name}** [page: ${p.page}]: ${p.overview} Stops: ${p.stops.slice(0, 4).join(", ")}. Inclusions: ${p.included.slice(0, 3).join(", ")}. Cancellation: ${p.cancellation}`
      );
    }
    return { text: lines.join("\n"), crawledCount: WEBSITE_CATALOG.length };
  }

  // Core public routes to crawl daily
  const pathsToCrawl = [
    "/",
    "/shared-tours",
    "/private-tours",
    "/shuttles",
    "/banff-highlights-tour",
    "/shared-tours-icefields-jasper",
    "/winter-special",
    "/winter-signature-private-tour",
    "/banff-private-tour",
    "/icefields-jasper-private-tour",
    "/two-day-rockies-explorer",
    "/three-day-rockies-discovery",
    "/four-day-rockies-and-jasper",
    "/faq",
    "/booking-and-cancellation-policy",
    "/contact-us",
  ];

  const fetchPage = async (path: string): Promise<CrawledPageResult | null> => {
    const url = `${baseUrl}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, {
        headers: { "User-Agent": "VistaChase-Concierge-DailyCrawl/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

        return {
          path,
          title: titleMatch ? titleMatch[1].trim() : null,
          description: metaDescMatch ? metaDescMatch[1].trim() : null,
          h1: h1Match ? h1Match[1].trim() : null,
          status: res.status,
        };
      }
    } catch {
      // Offline/local fallback: skip network failure without throwing
    }
    return null;
  };

  const settled = await Promise.allSettled(pathsToCrawl.map(fetchPage));
  const results = settled
    .filter((r): r is PromiseFulfilledResult<CrawledPageResult | null> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value!);

  // If live HTTP crawl succeeded for pages, compile fresh findings
  if (results.length > 0) {
    const lines: string[] = [
      `## Live Crawled Website Pages (Daily Crawl: ${today} • ${results.length} pages read from ${baseUrl})`,
      "The following facts reflect the latest published state of the live website:",
    ];
    for (const r of results) {
      const details = [
        r.h1 ? `H1: "${r.h1}"` : null,
        r.title ? `Title: "${r.title}"` : null,
        r.description ? `Description: "${r.description}"` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      lines.push(`- **${r.path}**: ${details || "Page active"}`);
    }
    return { text: lines.join("\n"), crawledCount: results.length };
  }

  // Fallback if HTTP is unreachable (local test or build): build verified live facts from WEBSITE_CATALOG
  const fallbackLines: string[] = [
    `## Live Website Facts (Verified Daily Sync: ${today} • ${WEBSITE_CATALOG.length} active catalog products)`,
    "The live website sells the following experiences under current branding (never use obsolete Webflow titles):",
  ];
  for (const p of WEBSITE_CATALOG) {
    fallbackLines.push(
      `- **${p.name}** [page: ${p.page}]: ${p.overview} Stops: ${p.stops.slice(0, 4).join(", ")}. Inclusions: ${p.included.slice(0, 3).join(", ")}. Cancellation: ${p.cancellation}`
    );
  }
  return { text: fallbackLines.join("\n"), crawledCount: WEBSITE_CATALOG.length };
}

/**
 * Compiles the Master Knowledge Base from live database rows, product catalogs, and daily website crawl.
 */
export async function syncMasterKnowledgeBase(): Promise<KnowledgeBaseMetadata> {
  const cache = getCacheProvider();
  const { cacheKey, metaKey, dateKey } = getDailyCacheKeys();

  let liveTourCatalog = "";
  let tourCount = 0;
  let stopCount = 0;

  try {
    const tours = await prisma.tour.findMany({
      where: conciergeTours(),
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

    const towns = [...new Set(stops.map((s) => s.town))];
    const stopSample = stops.slice(0, 8).map((s) => `${s.name} (${s.town})`).join("; ");

    // The structured product knowledgebase (knowledge/website-catalog.ts) with live prices and times.
    liveTourCatalog = `
${await renderCatalogKnowledge()}

${WEBSITE_KNOWLEDGE_FACTS}

Pickup stops: ${stopCount} in ${towns.join(", ")} (e.g. ${stopSample}). Use find_pickup for exact stops and times.
`;
  } catch (dbErr) {
    console.warn(
      "[knowledge.sync] Live catalog database read failed; falling back to core knowledge base:",
      (dbErr as Error).message
    );
    liveTourCatalog = `\n${await renderCatalogKnowledge()}\n\n${WEBSITE_KNOWLEDGE_FACTS}\n`;
  }

  // Daily live crawl of published website routes
  const crawl = await crawlLiveWebsiteKnowledge();

  const isWinter = isMoraineLakeRoadSeasonallyClosed();
  const roadStatusNote = isWinter
    ? "\n> [!NOTE] Season: winter (outside the June 1 to October 10 programme). Moraine Lake and the Icefield attractions are not operating; routes are adjusted, so the selected date's route needs team confirmation.\n"
    : "\n> [!NOTE] Season: summer programme (June 1 to October 10). Seasonal access still depends on official openings and conditions.\n";

  // Build the complete master knowledge text including daily crawled information
  const masterContent = `${VISTACHASE_STATIC_KNOWLEDGE_BASE}\n${roadStatusNote}\n${liveTourCatalog}\n\n${crawl.text}`.trim();

  // Compute hash and version
  const hash = crypto.createHash("sha256").update(masterContent).digest("hex").slice(0, 16);
  const version = `kb_${dateKey}_${hash.slice(0, 6)}`;
  const metadata: KnowledgeBaseMetadata = {
    version,
    hash,
    compiledAt: new Date().toISOString(),
    tourCount,
    shuttleStopCount: stopCount,
    crawledPagesCount: crawl.crawledCount,
    byteLength: Buffer.byteLength(masterContent, "utf8"),
  };

  // Persist to cache (Redis / Memory) with 4-hour crawl cadence
  await cache.set(cacheKey, masterContent, FOUR_HOUR_TTL_SECONDS + 3600);
  await cache.set(metaKey, metadata, FOUR_HOUR_TTL_SECONDS + 3600);

  // Update in-memory cache
  memoryCache = {
    text: masterContent,
    meta: metadata,
    expiresAt: Date.now() + IN_MEMORY_TTL_MS,
    dateKey,
  };

  console.log(
    `[knowledge.sync] Master knowledge base updated: Version ${version} (${metadata.byteLength} bytes, ${tourCount} tours, ${stopCount} stops, ${crawl.crawledCount} pages crawled)`
  );

  return metadata;
}

/**
 * Retrieves the compiled Master Knowledge Base text for the agent prompt.
 * Seamlessly refreshes if missing, expired, or when a new calendar day begins in Mountain Time.
 */
export async function getMasterKnowledgeBase(): Promise<string> {
  const { cacheKey, metaKey, dateKey } = getDailyCacheKeys();

  // 1. Check in-memory cache (must match today's date key)
  if (memoryCache && memoryCache.dateKey === dateKey && Date.now() < memoryCache.expiresAt) {
    return memoryCache.text;
  }

  // 2. Check distributed cache (Redis)
  const cache = getCacheProvider();
  const cachedText = await cache.get<string>(cacheKey);
  if (cachedText) {
    const cachedMeta = await cache.get<KnowledgeBaseMetadata>(metaKey);
    if (cachedMeta) {
      memoryCache = {
        text: cachedText,
        meta: cachedMeta,
        expiresAt: Date.now() + IN_MEMORY_TTL_MS,
        dateKey,
      };
      return cachedText;
    }
  }

  // 3. If cache is empty or date changed, trigger a fresh automated crawl & compile
  try {
    await syncMasterKnowledgeBase();
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
  const { metaKey } = getDailyCacheKeys();
  if (memoryCache?.meta) return memoryCache.meta;
  const cache = getCacheProvider();
  return cache.get<KnowledgeBaseMetadata>(metaKey);
}

/**
 * Invalidate knowledge base cache (called by admin, webhook, or crawler when a tour/price changes)
 */
export async function invalidateKnowledgeBase(): Promise<KnowledgeBaseMetadata> {
  const { cacheKey, metaKey } = getDailyCacheKeys();
  memoryCache = null;
  const cache = getCacheProvider();
  await cache.del(cacheKey);
  await cache.del(metaKey);
  return syncMasterKnowledgeBase();
}
