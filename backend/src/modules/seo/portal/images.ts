// Images & alt text for the SEO portal: every image the audit saw on a page (plus guide and blog
// images stored here), with its alt text, size, format and where it is used. Read-only: nothing is
// uploaded, moved, converted or deleted from here. Webflow CDN addresses are matched against the
// local copies listed in backend/media/manifest.json, so staff can see which ones already exist here.

import fs from "node:fs";
import path from "node:path";
import prisma from "@/lib/db/prisma";
import { getMediaAssets, MEDIA_DIR } from "@/modules/media/media.repository";
import { isWebflowUrl } from "@/modules/seo/seo.audit";
import { liveOf } from "@/modules/seo/seo.pages";

export interface ImageRow {
  src: string;
  kind: "img" | "og" | "schema" | "stored";
  pages: string[];
  alts: (string | null)[];
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  webflow: boolean;
  external: boolean;
  localCopy: string | null;
  broken: boolean;
  flags: string[];
  recommendations: string[];
}

const LARGE_BYTES = 400_000;

/** Alt text that names a file rather than describing the picture. */
export function looksLikeFileName(alt: string): boolean {
  const a = alt.trim();
  if (!a) return false;
  return /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(a) || /^[0-9a-f]{6,}([\s_-][0-9a-f]{3,}){2,}$/i.test(a) || /^(img|image|dsc|photo|screenshot)[\s_-]?\d+/i.test(a) || /^[a-z0-9]+(?:[_-][a-z0-9]+){2,}$/i.test(a);
}

/** Local file under /media: its size on disk, or null. Never follows paths outside MEDIA_DIR. */
function localBytes(src: string): number | null {
  if (!src.startsWith("/media/")) return null;
  const file = path.resolve(MEDIA_DIR, decodeURIComponent(src.slice("/media/".length)));
  if (!file.startsWith(path.resolve(MEDIA_DIR) + path.sep)) return null;
  try {
    return fs.statSync(file).size;
  } catch {
    return null;
  }
}

const formatOf = (src: string) => src.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? null;

/** Webflow CDN address → the local copy already in backend/media, from the media manifest. */
export function webflowLocalMap(): Map<string, { src: string; alt: string; width?: number; height?: number }> {
  const map = new Map<string, { src: string; alt: string; width?: number; height?: number }>();
  for (const a of getMediaAssets()) {
    const url = a.source?.url;
    if (url && isWebflowUrl(url)) map.set(url, { src: a.src, alt: a.alt, width: a.width, height: a.height });
  }
  return map;
}

/** Image references in a guide or blog body (Markdown subset: ![alt](src)). */
export function bodyImages(body: string | null): { src: string; alt: string }[] {
  if (!body) return [];
  return [...body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map((m) => ({ alt: m[1], src: m[2] }));
}

export async function imageInventory() {
  const [pages, brokenIssues] = await Promise.all([
    prisma.seoPage.findMany({ where: { status: { not: "ARCHIVED" } }, select: { path: true, lastCrawl: true, source: true, body: true, featuredImage: true, featuredImageAlt: true, thumbnailImage: true, thumbnailAlt: true, ogImage: true } }),
    prisma.seoIssue.findMany({ where: { type: "IMAGE_BROKEN", status: "OPEN" }, select: { detail: true } }),
  ]);
  const broken = new Set(brokenIssues.map((i) => (i.detail as { src?: string }).src).filter(Boolean) as string[]);
  const manifest = new Map(getMediaAssets().map((a) => [a.src, a]));
  const local = webflowLocalMap();
  const rows = new Map<string, ImageRow>();

  const add = (src: string, kind: ImageRow["kind"], page: string, alt: string | null, width: number | null = null, height: number | null = null) => {
    let row = rows.get(src);
    if (!row) {
      const asset = manifest.get(src);
      row = {
        src,
        kind,
        pages: [],
        alts: [],
        width: width ?? asset?.width ?? null,
        height: height ?? asset?.height ?? null,
        format: formatOf(src),
        bytes: localBytes(src),
        webflow: isWebflowUrl(src),
        external: /^https?:\/\//i.test(src),
        localCopy: local.get(src)?.src ?? null,
        broken: broken.has(src),
        flags: [],
        recommendations: [],
      };
      rows.set(src, row);
    }
    if (!row.pages.includes(page)) row.pages.push(page);
    if (kind === "img" || kind === "stored") row.alts.push(alt);
    if (row.kind !== "img" && kind === "img") row.kind = "img";
  };

  let pagesCrawled = 0;
  for (const p of pages) {
    const live = liveOf(p);
    if (live?.images) {
      pagesCrawled++;
      for (const img of live.images) add(img.src, img.kind, p.path, img.alt, img.width, img.height);
    }
    if (p.source === "CMS") {
      if (p.featuredImage) add(p.featuredImage, "stored", p.path, p.featuredImageAlt);
      if (p.thumbnailImage) add(p.thumbnailImage, "stored", p.path, p.thumbnailAlt);
      for (const img of bodyImages(p.body)) add(img.src, "stored", p.path, img.alt);
    }
    if (p.ogImage) add(p.ogImage, "og", p.path, null);
  }

  for (const row of rows.values()) {
    const describable = row.kind === "img" || row.kind === "stored";
    if (describable && row.alts.some((a) => a === null)) row.flags.push("missing-alt");
    if (describable && row.alts.some((a) => a !== null && looksLikeFileName(a))) row.flags.push("filename-alt");
    if (row.webflow) {
      row.flags.push("webflow-cdn");
      row.recommendations.push(row.localCopy ? `A local copy exists at ${row.localCopy}; point the page at it.` : "Download it and add it to backend/media, then point the page at the local copy (keep the alt text).");
    } else if (row.external) row.flags.push("external");
    if (row.broken) row.flags.push("broken");
    if (row.format && ["jpg", "jpeg", "png"].includes(row.format) && !row.external) row.recommendations.push("Serve as WebP or AVIF (next/image converts /media files automatically; the original is still a large download for crawlers and social cards).");
    if (row.bytes !== null && row.bytes > LARGE_BYTES) {
      row.flags.push("large");
      row.recommendations.push(`${Math.round(row.bytes / 1024)} KB on disk: compress it.`);
    }
    if (row.kind === "og" && row.width && row.height && (row.width < 1200 || row.height < 630)) row.recommendations.push("Social images look best at 1200 × 630.");
  }

  const list = [...rows.values()].sort((a, b) => b.flags.length - a.flags.length || b.pages.length - a.pages.length || a.src.localeCompare(b.src));
  const count = (flag: string) => list.filter((r) => r.flags.includes(flag)).length;
  const assets = getMediaAssets();
  return {
    images: list,
    summary: {
      images: list.length,
      pagesCrawled,
      missingAlt: count("missing-alt"),
      filenameAlt: count("filename-alt"),
      webflowCdn: count("webflow-cdn"),
      webflowWithLocalCopy: list.filter((r) => r.webflow && r.localCopy).length,
      broken: count("broken"),
      large: count("large"),
      library: {
        files: assets.length,
        fromWebflow: assets.filter((a) => a.source?.url && isWebflowUrl(a.source.url)).length,
        filenameAlt: assets.filter((a) => a.alt && looksLikeFileName(a.alt)).length,
      },
    },
    note: "Read-only. Files are never uploaded, converted, moved or deleted from here. Images on pages that haven't been audited yet aren't listed: run an audit first.",
  };
}
