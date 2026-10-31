// Imports blog posts from a Webflow CSV export (CMS → Blog Posts → Export) into /blog-post/<slug>,
// with the same preview-then-apply code as the SEO portal's Import screen (portal/imports.ts):
// posts marked Draft or Archived in Webflow are skipped, the rest are created and published, and a
// post whose URL already exists here gets the imported version as a draft to review instead.
// Images stay on the Webflow CDN unless a local copy is in backend/media.
//
// Usage (on the server, from backend/):
//   npx tsx scripts/import-blog-csv.ts /path/to/export.csv            # preview only
//   npx tsx scripts/import-blog-csv.ts /path/to/export.csv --apply    # import and publish
//
// Runs as the first ADMIN account (recorded on the import batch and the page history).

import fs from "node:fs";
import prisma from "../src/lib/db/prisma";
import { applyBatch, createPreview } from "../src/modules/seo/portal/imports";

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file || !fs.existsSync(file)) throw new Error("Give the path of the Webflow CSV export as the first argument.");

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No ADMIN account found (scripts/create-admin.js creates one).");

  const batch = await createPreview({ kind: "BLOG_POSTS", source: "CSV", text: fs.readFileSync(file, "utf8"), fileName: file.split("/").pop() }, admin.id);
  const rows = (batch.preview as { rows: { action: string; slug: string | null; errors?: string[]; notes?: string[] }[] }).rows;
  const count = (action: string) => rows.filter((r) => r.action === action).length;
  console.log(`${rows.length} posts in the file: ${count("create")} new, ${count("update-draft")} already here (imported as drafts to review), ${count("skip")} skipped (draft/archived in Webflow), ${count("error")} with errors.`);
  for (const r of rows.filter((r) => r.action === "skip" || r.action === "error")) {
    console.log(`  ${r.action.padEnd(5)} ${r.slug ?? "(no slug)"}: ${[...(r.errors ?? []), ...(r.notes ?? [])][0] ?? ""}`);
  }

  if (!apply) {
    await prisma.seoImportBatch.update({ where: { id: batch.id }, data: { status: "DISCARDED" } }).catch(() => {});
    console.log("\nPreview only. Run again with --apply to import and publish.");
    return;
  }
  await applyBatch(batch.id, { publish: true, confirm: true }, admin.id);
  const published = await prisma.seoPage.count({ where: { source: "CMS", path: { startsWith: "/blog-post/" }, status: "PUBLISHED" } });
  console.log(`\nImported. Published blog posts on the site: ${published}. /blog shows them within a minute.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error((error as Error).message);
    await prisma.$disconnect();
    process.exit(1);
  });
