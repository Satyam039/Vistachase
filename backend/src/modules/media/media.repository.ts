import fs from "node:fs";
import path from "node:path";

/**
 * Every image the site uses lives in backend/media and is served at /media/*
 * (see app.ts). media/manifest.json, written by scripts/media/build-media.mjs,
 * describes each file: size, alt text, collection, places and tags.
 */
export const MEDIA_DIR = process.env.MEDIA_DIR ? path.resolve(process.env.MEDIA_DIR) : path.resolve(process.cwd(), "media");

export interface MediaAsset {
  id: string;
  src: string;
  /** Videos: a 1080p encode for large screens (hero clips only). */
  srcHd?: string;
  /** Videos: poster frame shown before (or instead of) playback. */
  poster?: string;
  duration?: number;
  width?: number;
  height?: number;
  title: string;
  alt: string;
  collection: "photos" | "site" | "brand" | "badges" | "icons" | "blog" | "videos";
  kind: string;
  places: string[];
  tags: string[];
  source: { origin: string; file?: string; url?: string; pages?: string[]; derived?: string };
}

let cache: { mtimeMs: number; assets: MediaAsset[] } | null = null;

export function getMediaAssets(): MediaAsset[] {
  const file = path.join(MEDIA_DIR, "manifest.json");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return [];
  }
  if (!cache || cache.mtimeMs !== stat.mtimeMs) {
    cache = { mtimeMs: stat.mtimeMs, assets: JSON.parse(fs.readFileSync(file, "utf8")).assets };
  }
  return cache.assets;
}

export function findMedia(filter: { collection?: string; place?: string; tag?: string; kind?: string }) {
  return getMediaAssets().filter(
    (a) =>
      (!filter.collection || a.collection === filter.collection) &&
      (!filter.place || a.places.includes(filter.place)) &&
      (!filter.tag || a.tags.includes(filter.tag)) &&
      (!filter.kind || a.kind === filter.kind)
  );
}

export interface PageVideo {
  id: string;
  src: string;
  srcHd: string | null;
  poster: string;
  title: string;
  alt: string;
}

/**
 * Background video clips for a page, best match first: scored by the places they show
 * (earlier places weigh more), in the right season ("winter" clips only for winter pages,
 * never for summer ones). Wildlife clips rank after landscapes.
 */
export function videosFor(places: string[], season: "all" | "summer" | "winter" = "all", limit = 2): PageVideo[] {
  const weights = new Map(places.map((p, i) => [p, places.length - i]));
  return getMediaAssets()
    .filter((a) => a.collection === "videos")
    .map((a) => {
      const winter = a.tags.includes("winter");
      if ((season === "winter" && !winter) || (season === "summer" && winter)) return null;
      let score = a.places.reduce((sum, p) => sum + (weights.get(p) ?? 0), 0);
      if (score === 0) return null;
      if (a.tags.includes("wildlife")) score -= 1;
      return { a, score };
    })
    .filter((x): x is { a: MediaAsset; score: number } => x !== null)
    .sort((x, y) => y.score - x.score || x.a.id.localeCompare(y.a.id))
    // One clip per place before repeating a place (two waterfalls at the same falls add little).
    .reduce<{ picked: { a: MediaAsset; score: number }[]; seen: Set<string> }>(
      (acc, item) => {
        // The clip's most specific matched place: the one the page weights highest.
        const place = item.a.places.filter((p) => weights.has(p)).sort((p, q) => weights.get(q)! - weights.get(p)!)[0] ?? "";
        if (!acc.seen.has(place)) {
          acc.seen.add(place);
          acc.picked.push(item);
        }
        return acc;
      },
      { picked: [], seen: new Set() }
    )
    .picked.slice(0, limit)
    .map(({ a }) => ({ id: a.id, src: a.src, srcHd: a.srcHd ?? null, poster: a.poster ?? "", title: a.title, alt: a.alt }));
}
