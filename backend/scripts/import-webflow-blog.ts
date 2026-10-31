// Imports the blog posts exported from the old Webflow site (prisma/catalog/webflow-blog-posts.csv,
// the CMS "Blog Posts" collection export) as published posts at their old /blog-post/<slug>
// addresses, through the same conversion as SEO portal → Imports.
//
// Only posts missing here are created. A post that already exists at its address, in any state
// (including ones staff edited, unpublished or archived in the SEO portal), is left as it is, so
// this is safe to run on every deploy. Posts that are drafts or archived in Webflow are skipped.
//
// Images still on the Webflow CDN (no copy in media/manifest.json) are downloaded to
// media/uploads/blog-import/ and served from /media/uploads/blog-import/, so the posts keep their
// pictures once the Webflow site is switched off. An image that can't be downloaded keeps its
// Webflow address. --no-download skips the downloads.
//
// Usage:
//   npm run seed:blog
//   npx tsx scripts/import-webflow-blog.ts [--dry-run] [--no-download] [--file <export.csv>]

import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import prisma from "../src/lib/db/prisma";
import { MEDIA_DIR } from "../src/modules/media/media.repository";
import { isWebflowUrl } from "../src/modules/seo/seo.audit";
import { createImportedPost, postData, postsFromCsv, previewPosts } from "../src/modules/seo/portal/imports";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const download = !args.includes("--no-download");
const fileArg = args.indexOf("--file");
const file = fileArg >= 0 ? path.resolve(args[fileArg + 1]) : path.resolve(__dirname, "../prisma/catalog/webflow-blog-posts.csv");

const IMAGE_DIR = path.join(MEDIA_DIR, "uploads", "blog-import");
const IMAGE_URL = "/media/uploads/blog-import";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Webflow asset URL → a stable local file name (Webflow names start with a unique asset id). */
function localName(url: string): string {
  const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "image");
  const ext = last.match(/\.(png|jpe?g|webp|gif|avif|svg)$/i)?.[0].toLowerCase() ?? "";
  const base = last.slice(0, last.length - ext.length).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "image";
  return `${base}${ext}`;
}

const localised = new Map<string, string | null>();

/** Downloads one Webflow image (once per run); the local /media address, or null to keep the original. */
async function localImage(url: string): Promise<string | null> {
  if (localised.has(url)) return localised.get(url)!;
  const name = localName(url);
  const target = path.join(IMAGE_DIR, name);
  let result: string | null = `${IMAGE_URL}/${name}`;
  if (!fs.existsSync(target)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status} ${type}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`${bytes.length} bytes`);
      fs.mkdirSync(IMAGE_DIR, { recursive: true });
      fs.writeFileSync(`${target}.part`, bytes);
      fs.renameSync(`${target}.part`, target);
    } catch (error) {
      console.warn(`  image kept on Webflow (${(error as Error).message}): ${url}`);
      result = null;
    }
  }
  localised.set(url, result);
  return result;
}

const WEBFLOW_URL = /https?:\/\/[^\s)"'<>]*(?:website-files\.com|webflow\.(?:com|io))[^\s)"'<>]*/gi;

async function localiseText(text: string | null): Promise<string | null> {
  if (!text) return text;
  let out = text;
  for (const url of new Set(text.match(WEBFLOW_URL) ?? [])) {
    if (!isWebflowUrl(url)) continue;
    const local = await localImage(url);
    if (local) out = out.split(url).join(local);
  }
  return out;
}

async function main() {
  const csv = fs.readFileSync(file, "utf8");
  const posts = postsFromCsv(csv);
  const preview = await previewPosts(posts, { dateSource: "created", mapLocalImages: true, useBaseline: true });
  const toCreate = preview.rows.filter((r) => r.action === "create");
  const existing = preview.rows.filter((r) => r.action === "update-draft").length;
  const skipped = preview.rows.filter((r) => r.action === "skip");
  const errors = preview.rows.filter((r) => r.action === "error");
  console.log(`Webflow blog export: ${posts.length} posts; ${toCreate.length} to import, ${existing} already here, ${skipped.length} drafts/archived in Webflow, ${errors.length} with errors.`);
  for (const r of errors) console.warn(`  not imported ${r.path ?? r.ref}: ${r.errors.join(" ")}`);
  if (dryRun || toCreate.length === 0) return;

  const now = new Date();
  const result = { created: 0, drafted: 0, skipped: preview.rows.length - toCreate.length, failed: [] as { ref: string; error: string }[], ids: [] as string[] };
  for (const row of toCreate) {
    if (download) {
      const f = row.fields;
      f.body = await localiseText(f.body);
      f.featuredImage = await localiseText(f.featuredImage);
      f.thumbnailImage = await localiseText(f.thumbnailImage);
      f.ogImage = await localiseText(f.ogImage);
    }
    const parsed = postData(row.fields);
    if (!parsed.success) {
      result.failed.push({ ref: row.ref, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    try {
      const page = await createImportedPost(row, parsed.data, { publish: true, source: "CSV", userId: null, now });
      result.created++;
      result.ids.push(page.id);
    } catch (error) {
      result.failed.push({ ref: row.ref, error: (error as Error).message.slice(0, 200) });
    }
  }
  for (const f of result.failed) console.warn(`  failed ${f.ref}: ${f.error}`);

  // Recorded like a portal import, so it shows under SEO portal → Imports.
  const batch = await prisma.seoImportBatch.create({
    data: { kind: "BLOG_POSTS", source: "CSV", status: "APPLIED", fileName: path.basename(file), raw: { file: path.basename(file) }, preview: preview as unknown as Prisma.InputJsonValue, result: result as unknown as Prisma.InputJsonValue, appliedAt: now },
  });
  await prisma.auditLog.create({ data: { action: "SEO_IMPORT_APPLIED", entityType: "SeoImportBatch", entityId: batch.id, details: { kind: "BLOG_POSTS", created: result.created, skipped: result.skipped, failed: result.failed.length, publish: true, script: "import-webflow-blog" } } });
  const kept = [...localised.values()].filter((v) => v === null).length;
  console.log(`Blog posts: imported ${result.created}, ${result.failed.length} failed; ${localised.size - kept} images saved here, ${kept} still on Webflow.`);
}

main()
  .catch((err) => {
    console.error("import-webflow-blog failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
