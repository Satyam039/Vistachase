// Images for the SEO portal: the library staff pick featured and Open Graph images from (the site's
// own media plus earlier uploads), and uploads. An upload is decoded and re-encoded by sharp (so only
// real raster images get through, with metadata stripped), resized to at most 2400px wide, saved as
// WebP under media/uploads/seo/<yyyy-mm>/ and served by the existing /media static route. Nothing is
// overwritten or deleted, and each upload is recorded in the audit log.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import prisma from "@/lib/db/prisma";
import { MEDIA_DIR, getMediaAssets } from "@/modules/media/media.repository";
import { SeoError } from "@/modules/seo/seo.errors";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 2400;
const UPLOAD_DIR = "uploads/seo";
const ACCEPTED = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff", "heif"]);

export interface LibraryImage {
  src: string;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
  source: "library" | "upload";
  uploadedAt?: string;
  uploadedBy?: string | null;
}

/** Turns "Moraine Lake sunrise.JPG" into "moraine-lake-sunrise". */
function baseName(fileName: string) {
  const stem = path.basename(fileName).replace(/\.[^.]+$/, "");
  return (
    stem
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image"
  );
}

export async function uploadImage(input: { data: string; fileName: string; alt?: string | null }, userId: string) {
  const match = input.data.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  const buffer = Buffer.from(match ? match[2] : input.data, "base64");
  if (buffer.length === 0) throw new SeoError(400, "The file is empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new SeoError(413, "The image is larger than 8 MB. Export a smaller copy and try again.");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    throw new SeoError(400, "That file isn't an image the site can use (JPEG, PNG, WebP, GIF or AVIF).");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new SeoError(400, "Use a JPEG, PNG, WebP, GIF or AVIF image (SVG and other formats aren't accepted).");
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) throw new SeoError(400, "The image is too small: use at least 200 × 200 px (1200 × 630 px for social sharing).");

  const output = await sharp(buffer, { animated: false })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const month = new Date().toISOString().slice(0, 7);
  const name = `${baseName(input.fileName)}-${crypto.randomBytes(4).toString("hex")}.webp`;
  const dir = path.join(MEDIA_DIR, UPLOAD_DIR, month);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), output.data, { flag: "wx" });

  const src = `/media/${UPLOAD_DIR}/${month}/${name}`;
  const image: LibraryImage = {
    src,
    alt: (input.alt ?? "").trim().slice(0, 300),
    title: path.basename(input.fileName).slice(0, 200),
    width: output.info.width,
    height: output.info.height,
    source: "upload",
  };
  await prisma.auditLog.create({
    data: { userId, action: "SEO_IMAGE_UPLOADED", entityType: "SeoImage", entityId: src, details: { ...image, bytes: output.data.length, originalBytes: buffer.length, originalFormat: meta.format } },
  });
  return { ...image, uploadedAt: new Date().toISOString() };
}

/** The site's photos and earlier uploads, newest uploads first; optionally filtered by text. */
export async function imageLibrary(q?: string): Promise<{ images: LibraryImage[]; uploads: number }> {
  const logs = await prisma.auditLog.findMany({
    where: { action: "SEO_IMAGE_UPLOADED" },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true } } },
  });
  const uploads: LibraryImage[] = [];
  for (const log of logs) {
    const d = (log.details ?? {}) as Record<string, unknown>;
    const src = String(d.src ?? log.entityId);
    if (!src.startsWith(`/media/${UPLOAD_DIR}/`) || !fs.existsSync(path.join(MEDIA_DIR, src.slice("/media/".length)))) continue;
    uploads.push({
      src,
      alt: String(d.alt ?? ""),
      title: String(d.title ?? path.basename(src)),
      width: typeof d.width === "number" ? d.width : null,
      height: typeof d.height === "number" ? d.height : null,
      source: "upload",
      uploadedAt: log.createdAt.toISOString(),
      uploadedBy: log.user?.name ?? null,
    });
  }
  const library: LibraryImage[] = getMediaAssets()
    .filter((a) => ["photos", "site", "blog"].includes(a.collection) && /\.(webp|jpe?g|png|avif)$/i.test(a.src))
    .map((a) => ({ src: a.src, alt: a.alt, title: a.title, width: a.width ?? null, height: a.height ?? null, source: "library" as const }));

  const term = q?.trim().toLowerCase();
  const all = [...uploads, ...library];
  const images = term ? all.filter((i) => `${i.src} ${i.alt} ${i.title}`.toLowerCase().includes(term)) : all;
  return { images, uploads: uploads.length };
}
