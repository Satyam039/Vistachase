// The migration checklist (SEO portal): the handoff's "before launch" list plus the usual checks for
// the weeks after launch. Items are seeded once (insert-missing, never overwritten). An item can be
// marked Done only with evidence (a link, a check result, a note of what was verified) or an
// explicit confirmation recorded against the person who gave it. Automated checks attach their
// result as a suggestion; they never mark anything Done by themselves.

import type { Prisma, SeoChecklistPhase, SeoChecklistStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";
import { getLatestTechnical } from "@/modules/seo/portal/technical";
import { HANDOFF_BLOG_POSTS } from "@/modules/seo/portal/blog";

interface Seed {
  key: string;
  phase: SeoChecklistPhase;
  section: string;
  title: string;
  description?: string;
  source?: "HANDOFF" | "STANDARD";
  autoCheck?: string;
}

const B: SeoChecklistPhase = "BEFORE_LAUNCH";
const A: SeoChecklistPhase = "AFTER_LAUNCH";

export const CHECKLIST_SEED: Seed[] = [
  // Handoff, "Before launch"
  { key: "staging-noindex", phase: B, section: "Crawling", title: "Block indexing of the staging domain", description: "The preview address must not be indexed (robots Disallow: / or noindex) until launch.", autoCheck: "robots.blockAll" },
  { key: "robots-allow", phase: B, section: "Crawling", title: "robots.txt allows all crawlers and lists the sitemap", autoCheck: "robots.sitemap" },
  { key: "crawlers-ai", phase: B, section: "Crawling", title: "Googlebot and Bingbot allowed; GPTBot, ClaudeBot, PerplexityBot and Google-Extended still allowed", autoCheck: "crawler" },
  { key: "sitemap", phase: B, section: "Crawling", title: "sitemap.xml is generated and includes every blog post with lastmod", autoCheck: "sitemap.reachable" },
  { key: "verification", phase: B, section: "Search Console", title: "Google site verification meta tag on the home page", description: "Copy the ID from the source (the PDF text reads isQ3svDyWBUc7wL57wZAC-aZ5_yT-QXBS0eMwJU9jvk). Needs an admin's approval.", autoCheck: "verification" },
  { key: "canonical-www", phase: B, section: "Canonical domain", title: "Self-referencing canonical on https://www.vistachase.com, no trailing slash", autoCheck: "canonical.home" },
  { key: "redirect-www", phase: B, section: "Canonical domain", title: "http:// and the bare domain 301 to https://www.vistachase.com", description: "Server and DNS work; needs approval before anyone changes DNS.", autoCheck: "domain" },
  { key: "llms", phase: B, section: "Crawling", title: "Serve /llms.txt (current file from Nishika)", autoCheck: "llms" },
  { key: "gtag", phase: B, section: "Tracking", title: "Google tag (G-KH1432E703 and AW-16675422535) on every page, loaded once", description: "Needs an admin's approval.", autoCheck: "tracking.gtag" },
  { key: "conversion", phase: B, section: "Tracking", title: "Footer conversion script (50 CAD) wired to the confirmed triggers", description: "The full script isn't in the handoff. Confirm the script and which buttons trigger it with Nishika; nothing is guessed." },
  { key: "static-urls", phase: B, section: "URLs", title: "The 25 static pages, the blog template and the 404 keep their URLs or 301", description: "Use Website Audit → Baseline comparison.", autoCheck: "baseline" },
  { key: "metadata", phase: B, section: "Metadata", title: "Title, description, canonical and Open Graph copied exactly for every page", description: "Import into drafts, review, then publish." },
  { key: "og-fallback", phase: B, section: "Metadata", title: "og:url, og:type and twitter:card on every page; OG falls back to the SEO title and description" },
  { key: "jsonld-copy", phase: B, section: "Schema", title: "Per-page JSON-LD copied, @id values kept, Webflow image URLs re-hosted" },
  { key: "blogposting", phase: B, section: "Schema", title: "BlogPosting schema on every post (headline, dates, author, image, publisher @id)" },
  { key: "blog-urls", phase: B, section: "Blog", title: `All ${HANDOFF_BLOG_POSTS} posts at /blog-post/<slug> with the exact slugs`, autoCheck: "blog.count" },
  { key: "blog-content", phase: B, section: "Blog", title: "Heading levels, internal links, alt text and embeds kept in each post" },
  { key: "blog-drafts", phase: B, section: "Blog", title: "Only published posts migrated; drafts confirmed with Nishika" },
  { key: "blog-dates", phase: B, section: "Blog", title: "Original published and modified dates kept" },
  { key: "blog-meta", phase: B, section: "Blog", title: "Each post's SEO title, description and OG image mapped" },
  { key: "images-rehost", phase: B, section: "Images", title: "Webflow CDN images re-hosted with their alt text", autoCheck: "images.webflow" },
  { key: "redirects", phase: B, section: "Redirects", title: "Webflow 301 redirects copied and switched on", autoCheck: "redirects" },
  { key: "single-h1", phase: B, section: "Content", title: "One H1 per page; existing heading structure kept" },
  { key: "real-404", phase: B, section: "Technical", title: "Missing pages return a real 404 with the custom page", autoCheck: "http.404" },
  { key: "performance", phase: B, section: "Technical", title: "Core Web Vitals, WebP images, lazy loading, no render-blocking JS", description: "Field data needs Search Console or PageSpeed Insights." },
  { key: "rich-results", phase: B, section: "Schema", title: "Templates validated in Google's Rich Results Test", description: "Add the test result link as evidence." },
  // After launch (standard practice)
  { key: "gsc-sitemap", phase: A, section: "Search Console", title: "Submit the sitemap in Search Console", source: "STANDARD" },
  { key: "gsc-coverage", phase: A, section: "Search Console", title: "Check page indexing and crawl errors daily for two weeks", source: "STANDARD" },
  { key: "gsc-change-of-address", phase: A, section: "Search Console", title: "Confirm the www property is the one being reported (no change of address needed if the domain stays the same)", source: "STANDARD" },
  { key: "ga4-realtime", phase: A, section: "Tracking", title: "GA4 Realtime shows visits; Ads conversion recorded once per conversion", source: "STANDARD" },
  { key: "redirect-crawl", phase: A, section: "Redirects", title: "Re-crawl the old URL list: every old URL is 200 or one 301 hop", source: "STANDARD", autoCheck: "baseline" },
  { key: "rankings-baseline", phase: A, section: "Monitoring", title: "Compare clicks and impressions with the pre-launch baseline after 4 weeks", source: "STANDARD" },
  { key: "backlinks", phase: A, section: "Monitoring", title: "Top backlinks still land on a 200 page", source: "STANDARD" },
  { key: "staging-closed", phase: A, section: "Crawling", title: "Staging address no longer reachable or still noindex", source: "STANDARD" },
  { key: "webflow-off", phase: A, section: "Launch", title: "Webflow site unpublished only after the checks above pass", source: "STANDARD" },
];

/** Inserts the items that don't exist yet; never changes existing ones. */
export async function seedChecklist() {
  const existing = new Set((await prisma.seoChecklistItem.findMany({ select: { key: true } })).map((i) => i.key));
  const missing = CHECKLIST_SEED.map((s, i) => ({ ...s, sortOrder: i })).filter((s) => !existing.has(s.key));
  if (missing.length) {
    await prisma.seoChecklistItem.createMany({
      data: missing.map((s) => ({ key: s.key, phase: s.phase, section: s.section, title: s.title, description: s.description ?? null, source: s.source ?? "HANDOFF", sortOrder: s.sortOrder, autoCheck: s.autoCheck ?? null })),
      skipDuplicates: true,
    });
  }
  return missing.length;
}

export async function listChecklist() {
  await seedChecklist();
  const items = await prisma.seoChecklistItem.findMany({ orderBy: [{ phase: "asc" }, { sortOrder: "asc" }] });
  const people = await staffNames(items.flatMap((i) => [i.confirmedById, i.updatedById]));
  const rows = items.map((i) => ({ ...i, confirmedBy: i.confirmedById ? people[i.confirmedById] ?? null : null, updatedBy: i.updatedById ? people[i.updatedById] ?? null : null }));
  const progress = (phase: SeoChecklistPhase) => {
    const list = rows.filter((r) => r.phase === phase);
    const counted = list.filter((r) => r.status !== "NOT_APPLICABLE");
    return { total: counted.length, done: counted.filter((r) => r.status === "DONE").length, blocked: counted.filter((r) => r.status === "BLOCKED").length };
  };
  return { items: rows, progress: { before: progress("BEFORE_LAUNCH"), after: progress("AFTER_LAUNCH") } };
}

async function staffNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return {} as Record<string, string>;
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name || u.email]));
}

export interface ChecklistUpdate {
  status?: SeoChecklistStatus;
  notes?: string | null;
  assigneeName?: string | null;
  addEvidence?: string;
  removeEvidence?: string;
  confirm?: boolean;
}

export async function updateChecklistItem(id: string, input: ChecklistUpdate, userId: string) {
  const item = await prisma.seoChecklistItem.findUnique({ where: { id } });
  if (!item) throw new SeoError(404, "Checklist item not found.");
  let evidence = [...item.evidence];
  if (input.addEvidence) evidence = [...evidence, input.addEvidence.trim()].slice(-20);
  if (input.removeEvidence) evidence = evidence.filter((e) => e !== input.removeEvidence);
  const status = input.status ?? item.status;
  const data: Prisma.SeoChecklistItemUpdateInput = { evidence, updatedById: userId };
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.assigneeName !== undefined) data.assigneeName = input.assigneeName;
  if (input.status) data.status = input.status;

  if (status === "DONE" && item.status !== "DONE") {
    // Done needs proof: evidence on the item, or the person's explicit confirmation.
    if (evidence.length === 0 && !input.confirm) {
      throw new SeoError(422, "Add evidence (a link, a check result or what you verified) or confirm that you checked it yourself before marking this done.");
    }
    data.confirmedById = userId;
    data.confirmedAt = new Date();
  }
  if (status !== "DONE" && item.status === "DONE") {
    data.confirmedById = null;
    data.confirmedAt = null;
  }
  if (status === "DONE" && evidence.length === 0 && item.status === "DONE" && input.removeEvidence && !item.confirmedById) {
    throw new SeoError(422, "This item is done; keep at least one piece of evidence or reopen it first.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.seoChecklistItem.update({ where: { id }, data });
    await tx.auditLog.create({
      data: { userId, action: "SEO_CHECKLIST_UPDATED", entityType: "SeoChecklistItem", entityId: id, details: { key: item.key, from: item.status, to: status, evidenceAdded: input.addEvidence ?? null, confirmed: Boolean(input.confirm) } },
    });
    return row;
  });
  return updated;
}

/** Runs the automated checks that apply and stores each result on its item (never marks Done). */
export async function refreshAutoChecks() {
  const items = await prisma.seoChecklistItem.findMany({ where: { autoCheck: { not: null } } });
  const tech = await getLatestTechnical();
  const [blogCount, webflowImages, redirectsActive, redirectsInactive, baseline] = await Promise.all([
    prisma.seoPage.count({ where: { source: "CMS", path: { startsWith: BLOG_PREFIX }, status: "PUBLISHED" } }),
    prisma.seoIssue.count({ where: { status: "OPEN", type: "WEBFLOW_CDN_REFERENCE" } }),
    prisma.seoRedirect.count({ where: { active: true } }),
    prisma.seoRedirect.count({ where: { active: false } }),
    prisma.seoImportBatch.findFirst({ where: { kind: "BASELINE", status: "APPLIED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, result: true } }),
  ]);
  const at = new Date().toISOString();
  const fromTech = (prefix: string) => {
    if (!tech) return { ok: null, message: "Not checked yet: run Technical SEO → Run checks." };
    const list = tech.checks.filter((c) => c.id === prefix || c.id.startsWith(`${prefix}.`));
    if (!list.length) return { ok: null, message: "Not covered by the last technical check." };
    const failed = list.filter((c) => c.status === "fail");
    const unknown = list.filter((c) => c.status === "not_checked");
    return {
      ok: failed.length ? false : unknown.length === list.length ? null : true,
      message: `${list.map((c) => `${c.label}: ${c.status}`).join("; ")} (checked ${tech.checkedAt}).`,
    };
  };
  const results: Record<string, { ok: boolean | null; message: string }> = {};
  for (const item of items) {
    const key = item.autoCheck!;
    let r: { ok: boolean | null; message: string };
    if (key === "blog.count") r = { ok: blogCount >= HANDOFF_BLOG_POSTS ? true : false, message: `${blogCount} of ${HANDOFF_BLOG_POSTS} blog posts are published at ${BLOG_PREFIX}<slug>.` };
    else if (key === "images.webflow") r = { ok: webflowImages === 0 ? true : false, message: `${webflowImages} open Webflow CDN references (from the last audit).` };
    else if (key === "redirects") r = { ok: null, message: `${redirectsActive} redirects on, ${redirectsInactive} waiting for review. Compare with the Webflow redirect export.` };
    else if (key === "baseline") r = baseline ? { ok: null, message: `Baseline captured ${baseline.createdAt.toISOString().slice(0, 10)}: open Website Audit → Baseline to compare.` } : { ok: null, message: "No baseline captured yet." };
    else r = fromTech(key);
    results[item.id] = r;
    await prisma.seoChecklistItem.update({ where: { id: item.id }, data: { lastCheck: { ...r, at } } });
  }
  return results;
}
