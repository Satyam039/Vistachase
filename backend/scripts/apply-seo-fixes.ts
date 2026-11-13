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
// 5. Restored tours (RESTORED_TOUR_SLUGS, owner 2026-11-11: the winter tours are back): the redirect
//    this script saved for each one's address (source IMPORT, our note) is switched off, and the page
//    row this script archived is published again. Redirects or archives staff made themselves stay.
// 4. Renamed images (RENAMED_MEDIA, 10 Nov 2026: "ChatGPT Image <date>" blog files named after their
//    post): every saved page that still points at an old /media path is pointed at the new one, in
//    its text, image fields and unpublished draft. The old paths also 301 (modules/media/renamed-media.ts).
// 6. Blog post text (prisma/catalog/blog-fixes-2026-11.json, owner 13 Nov 2026): exact sentence swaps
//    that replace retired tour names, old prices and old group sizes in 20 imported posts. A fix only
//    replaces its own old text, so passages staff have rewritten in the SEO portal are left alone.
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
import { RENAMED_MEDIA } from "../src/modules/media/renamed-media";
import { RESTORED_TOUR_SLUGS } from "../src/modules/tours/product-map";
import { planBlogTextFixes, type TextFix } from "../src/modules/seo/blog-text-fixes";

const dryRun = process.argv.includes("--dry-run");

interface Fix {
  /** The value(s) the page may still have: the audit's, or an earlier fix of ours (owner, 2026-11-11: no "12 guests"). */
  from: string | string[];
  to: string;
}
const fixes = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../prisma/catalog/seo-fixes-2026-11.json"), "utf8")) as {
  titles: Record<string, Fix>;
  descriptions: Record<string, Fix>;
};

/** The note on redirects this script saves, so it can tell them from ones staff made. */
const SCRIPT_REDIRECT_NOTE = "Webflow migration / technical audit, Nov 2026";

async function restoredTours() {
  const paths = RESTORED_TOUR_SLUGS.map((slug) => `/${slug}`);
  const stale = await prisma.seoRedirect.findMany({
    where: { fromPath: { in: paths }, active: true, source: "IMPORT", note: SCRIPT_REDIRECT_NOTE },
    select: { id: true, fromPath: true, toPath: true },
  });
  const archivedByUs = await prisma.auditLog.findMany({
    where: { action: "SEO_PAGE_ARCHIVED", entityType: "SeoPage" },
    select: { entityId: true, details: true },
  });
  const ourArchives = new Set(
    archivedByUs
      .filter((a) => {
        const d = a.details as { path?: string; script?: string } | null;
        return d?.script === "apply-seo-fixes" && !!d.path && paths.includes(d.path);
      })
      .map((a) => a.entityId),
  );
  const pages = await prisma.seoPage.findMany({ where: { path: { in: paths }, status: "ARCHIVED" }, select: { id: true, path: true } });
  const toRestore = pages.filter((p) => ourArchives.has(p.id));
  if (dryRun) {
    for (const r of stale) console.log(`  would switch off ${r.fromPath} -> ${r.toPath} (tour restored)`);
    for (const p of toRestore) console.log(`  would publish ${p.path} again`);
    return;
  }
  for (const r of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.seoRedirect.update({ where: { id: r.id }, data: { active: false } });
      await tx.auditLog.create({ data: { action: "SEO_REDIRECT_UPDATED", entityType: "SeoRedirect", entityId: r.id, details: { fromPath: r.fromPath, toPath: r.toPath, active: false, reason: "Tour restored (owner, 2026-11-11)", script: "apply-seo-fixes" } } });
    });
  }
  for (const p of toRestore) {
    await prisma.$transaction(async (tx) => {
      await tx.seoPage.update({ where: { id: p.id }, data: { status: "PUBLISHED" } });
      await tx.auditLog.create({ data: { action: "SEO_PAGE_RESTORED", entityType: "SeoPage", entityId: p.id, details: { path: p.path, reason: "Tour restored (owner, 2026-11-11)", script: "apply-seo-fixes" } } });
    });
  }
  console.log(`Restored tours: ${stale.length} redirects switched off, ${toRestore.length} page rows published again.`);
}

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
      const created = await tx.seoRedirect.create({ data: { fromPath, toPath, statusCode: 301, active: true, source: "IMPORT", note: SCRIPT_REDIRECT_NOTE } });
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
    const known = Array.isArray(fix.from) ? fix.from : [fix.from];
    if (current && !known.includes(current.trim())) continue; // staff wrote their own: keep it
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

const IMAGE_TEXT_FIELDS = ["body", "featuredImage", "thumbnailImage", "ogImage", "twitterImage", "searchImage"] as const;

async function renamedImages() {
  const pairs = Object.entries(RENAMED_MEDIA);
  const pages = await prisma.seoPage.findMany({
    where: { OR: pairs.flatMap(([from]) => [...IMAGE_TEXT_FIELDS.map((f) => ({ [f]: { contains: from } })), { draft: { string_contains: from } }]) },
    select: { id: true, path: true, body: true, featuredImage: true, thumbnailImage: true, ogImage: true, twitterImage: true, searchImage: true, draft: true },
  });
  const swap = (text: string) => pairs.reduce((out, [from, to]) => out.split(from).join(to), text);
  let changed = 0;
  for (const p of pages) {
    const data: Record<string, unknown> = {};
    for (const f of IMAGE_TEXT_FIELDS) {
      const v = p[f];
      if (v && swap(v) !== v) data[f] = swap(v);
    }
    if (p.draft) {
      const raw = JSON.stringify(p.draft);
      if (swap(raw) !== raw) data.draft = JSON.parse(swap(raw));
    }
    if (!Object.keys(data).length) continue;
    if (dryRun) console.log(`  would point ${p.path} at renamed images: ${Object.keys(data).join(", ")}`);
    else await prisma.seoPage.update({ where: { id: p.id }, data });
    changed++;
  }
  console.log(`Renamed images: ${changed} pages updated.`);
}

const blogFixes = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../prisma/catalog/blog-fixes-2026-11.json"), "utf8")) as {
  posts: Record<string, TextFix[]>;
};

async function blogTextFixes() {
  let changed = 0;
  let applied = 0;
  for (const [slug, list] of Object.entries(blogFixes.posts)) {
    const p = `${BLOG_PREFIX}${slug}`;
    const page = await prisma.seoPage.findUnique({
      where: { path: p },
      select: {
        id: true, status: true, faqs: true, draft: true, label: true, h1: true, seoTitle: true, metaDescription: true, excerpt: true,
        ogTitle: true, ogDescription: true, twitterTitle: true, twitterDescription: true, searchTitle: true, searchDescription: true,
        answerSnippet: true, citationFact: true, body: true,
      },
    });
    if (!page || page.status === "ARCHIVED") continue;
    const plan = planBlogTextFixes(page, list);
    for (const f of plan.missing) console.warn(`  ${p}: text not found, left as staff wrote it: "${f.from.slice(0, 60)}..."`);
    if (!plan.applied.length) continue;
    if (dryRun) {
      console.log(`  would update ${p}: ${plan.applied.length} passages in ${Object.keys(plan.data).join(", ")}`);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.seoPage.update({ where: { id: page.id }, data: plan.data });
        await tx.auditLog.create({
          data: {
            action: "SEO_PAGE_UPDATED",
            entityType: "SeoPage",
            entityId: page.id,
            details: { path: p, fields: Object.keys(plan.data), passages: plan.applied.length, reason: "Current tour names, prices and group sizes (owner, 2026-11-13)", script: "apply-seo-fixes" },
          },
        });
      });
    }
    changed++;
    applied += plan.applied.length;
  }
  console.log(`Blog text: ${applied} passages updated in ${changed} posts.`);
}

async function main() {
  await restoredTours();
  await redirects();
  await metaFixes("seoTitle", fixes.titles);
  await metaFixes("metaDescription", fixes.descriptions);
  await blogMetadata();
  await renamedImages();
  await blogTextFixes();
}

main()
  .catch((err) => {
    console.error("apply-seo-fixes failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
