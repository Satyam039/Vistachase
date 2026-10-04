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
  width?: number;
  height?: number;
  title: string;
  alt: string;
  collection: "photos" | "site" | "brand" | "badges" | "icons" | "blog";
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
