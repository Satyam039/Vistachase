// SEO fixes from the post-migration technical audit (9 Nov 2026: the "Technical audit : Vista Chase
// (After Migration)" spreadsheet, the Migration DOC and the fix-recheck artifact). Runs on every
// deploy (deploy-aws.yml) and is safe to repeat: it only adds what is missing and never overwrites
// a value staff have changed in the SEO portal.
//
// 1. Redirects: every built-in migration redirect (BUILT_IN_REDIRECTS in seo.redirects.ts) is saved
//    as a SEO portal redirect (source IMPORT) when no redirect from that address exists yet, so the
//    dashboard counts it and staff can edit or switch it off. The page row of a retired address
//    (an old tour, a removed ticket, the empty /guides index) is archived first; archived rows stay
//    in the database and can be restored from the portal.
// 2. Page titles and meta descriptions (prisma/catalog/seo-fixes-2026-11.json): the shorter title
//    from the audit spreadsheet is set where the page has no SEO title yet or still has the exact
//    title the audit reported; the same rule for the 13 descriptions over 160 characters.
// 3. Blog posts: empty SEO title, meta description and social image are filled from the post's own
//    Webflow fields (Name, Post Summary, Thumbnail Image), the way the Webflow template used them.
//
// Usage:
//   npm run seed:seo-fixes
//   npx tsx scripts/apply-seo-fixes.ts [--dry-run]

import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/db/prisma";
import { BUILT_IN_REDIRECTS, resolveChains } from "../src/modules/seo/seo.redirects";
import { isReservedPath } from "../src/modules/seo/paths";
import { isWebflowUrl } from "../src/modules/seo/seo.audit";
import { webflowLocalMap } from "../src/modules/seo/portal/images";
import { BLOG_PREFIX } from "../src/modules/seo/static-routes";

const dryRun = process.argv.includes("--dry-run");

interface Fix {
  from: string;
  to: string;
}
const fixes = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../prisma/catalog/seo-fixes-2026-11.json"), "utf8")) as {
  titles: Record<string, Fix>;
  descriptions: Record<string, Fix>;
};

async function redirects() {
  const existing = await prisma.seoRedirect.findMany({ select: { fromPath: true, toPath: true, active: true } });
  const saved = new Set(existing.map((r) => r.fromPath));
  const planned = Object.entries(BUILT_IN_REDIRECTS).filter(([from]) => !saved.has(from) && !isReservedPath(from));
  // Never save one that would loop or chain with what is already active.
  const active = [...existing.filter((r) => r.active), ...planned.map(([fromPath, toPath]) => ({ fromPath, toPath }))];
  const bad = new Set(resolveChains(active).filter((c) => c.loop || c.hops > 1).map((c) => c.fromPath));
  let added = 0;
  let archived = 0;
  for (const [fromPath, toPath] of planned) {
    if (bad.has(fromPath)) {
      console.warn(`  redirect ${fromPath} -> ${toPath} not saved: it would loop or chain`);
      continue;
    }
    const page = await prisma.seoPage.findUnique({ where: { path: fromPath }, select: { id: true, status: true } });
    if (dryRun) {
      console.log(`  would add ${fromPath} -> ${toPath}${page && page.status !== "ARCHIVED" ? " (and archive its page row)" : ""}`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      if (page && page.status !== "ARCHIVED") {
        await tx.seoPage.update({ where: { id: page.id }, data: { status: "ARCHIVED" } });
        await tx.auditLog.create({ data: { action: "SEO_PAGE_ARCHIVED", entityType: "SeoPage", entityId: page.id, details: { path: fromPath, reason: `Redirected to ${toPath} (technical audit, Nov 2026)`, script: "apply-seo-fixes" } } });
        archived++;
      }
      const created = await tx.seoRedirect.create({ data: { fromPath, toPath, statusCode: 301, active: true, source: "IMPORT", note: "Webflow migration / technical audit, Nov 2026" } });
      await tx.auditLog.create({ data: { action: "SEO_REDIRECT_CREATED", entityType: "SeoRedirect", entityId: created.id, details: { fromPath, toPath, statusCode: 301, script: "apply-seo-fixes" } } });
    });
    added++;
  }
  console.log(`Redirects: ${added} added, ${archived} retired page rows archived, ${saved.size} already saved.`);
}

/** Sets `field` to fix.to where it is empty or still exactly the value the audit reported. */
async function metaFixes(field: "seoTitle" | "metaDescription", list: Record<string, Fix>) {
  let changed = 0;
  for (const [p, fix] of Object.entries(list)) {
    const page = await prisma.seoPage.findUnique({ where: { path: p }, select: { id: true, seoTitle: true, metaDescription: true, status: true } });
    if (!page || page.status === "ARCHIVED") continue;
    const current = page[field];
    if (current && current.trim() !== fix.from) continue; // staff wrote their own: keep it
    if (current === fix.to) continue;
    if (dryRun) console.log(`  would set ${field} of ${p}: ${fix.to}`);
    else await prisma.seoPage.update({ where: { id: page.id }, data: { [field]: fix.to } });
    changed++;
  }
  console.log(`${field}: ${changed} pages updated.`);
}

async function blogMetadata() {
  const local = webflowLocalMap();
  const posts = await prisma.seoPage.findMany({
    where: { source: "CMS", path: { startsWith: BLOG_PREFIX }, status: { not: "ARCHIVED" } },
    select: { id: true, path: true, label: true, seoTitle: true, metaDescription: true, ogImage: true, excerpt: true, thumbnailImage: true, featuredImage: true },
  });
  let changed = 0;
  for (const p of posts) {
    const data: { seoTitle?: string; metaDescription?: string; ogImage?: string } = {};
    if (!p.seoTitle) data.seoTitle = fixes.titles[p.path]?.to ?? p.label.trim();
    if (!p.metaDescription && p.excerpt?.trim()) data.metaDescription = p.excerpt.trim();
    if (!p.ogImage) {
      let image = p.thumbnailImage ?? p.featuredImage ?? null;
      if (image && isWebflowUrl(image)) image = local.get(image)?.src ?? null;
      if (image) data.ogImage = image;
    }
    if (!Object.keys(data).length) continue;
    if (dryRun) console.log(`  would fill ${p.path}: ${Object.keys(data).join(", ")}`);
    else await prisma.seoPage.update({ where: { id: p.id }, data });
    changed++;
  }
  console.log(`Blog posts: SEO fields filled on ${changed} of ${posts.length}.`);
}

async function main() {
  await redirects();
  await metaFixes("seoTitle", fixes.titles);
  await metaFixes("metaDescription", fixes.descriptions);
  await blogMetadata();
}

main()
  .catch((err) => {
    console.error("apply-seo-fixes failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
