// SEO portal (/api/seo/portal/*): who may do what, drafts of live pages, structured data checks,
// the Webflow HTML converter, CSV imports (blog posts, redirects), the migration checklist's
// evidence rule, admin-approved changes (verification, tracking) and crawler rules.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { htmlToMarkdown } from "@/modules/seo/portal/html-to-markdown";
import { validateSchema } from "@/modules/seo/portal/schema";
import { headingOutline } from "@/modules/seo/portal/blog";
import { parseRobots, robotsAllows, robotsPreview } from "@/modules/seo/portal/technical";
import { looksLikeFileName } from "@/modules/seo/portal/images";
import { parseHtml } from "@/modules/seo/seo.audit";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
const P = "/api/seo/portal";

type U = { id: string; email: string; role: string; name: string };
const cookieFor = (u: U) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;
const as = (cookie: string) => ({
  get: (url: string) => request(app).get(url).set("Cookie", cookie),
  post: (url: string, body?: object) => request(app).post(url).set("Cookie", cookie).send(body ?? {}),
  put: (url: string, body?: object) => request(app).put(url).set("Cookie", cookie).send(body ?? {}),
  patch: (url: string, body?: object) => request(app).patch(url).set("Cookie", cookie).send(body ?? {}),
  del: (url: string) => request(app).delete(url).set("Cookie", cookie),
});

let admin = "";
let seo = "";
let editor = "";
let viewer = "";
let customer = "";
let pageId = "";

async function makeUser(role: "SEO_MANAGER" | "EDITOR" | "VIEWER" | "CUSTOMER") {
  return prisma.user.create({ data: { email: `portal-${role.toLowerCase()}-${unique()}@example.com`, passwordHash: "x", name: `${role} portal`, role } });
}

let savedSettings: { googleSiteVerification: string | null; tracking: unknown; crawlerRules: unknown } | null = null;

beforeAll(async () => {
  admin = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));
  seo = cookieFor(await makeUser("SEO_MANAGER"));
  editor = cookieFor(await makeUser("EDITOR"));
  viewer = cookieFor(await makeUser("VIEWER"));
  customer = cookieFor(await makeUser("CUSTOMER"));
  const guide = await as(admin).post("/api/seo/admin/pages", { label: "Portal test guide", slug: `portal-test-${unique()}` });
  expect(guide.status).toBe(201);
  pageId = guide.body.page.id;
  const s = await prisma.seoSiteSettings.findUnique({ where: { id: "site" } });
  savedSettings = s ? { googleSiteVerification: s.googleSiteVerification, tracking: s.tracking, crawlerRules: s.crawlerRules } : null;
});

afterAll(async () => {
  // Leave the site settings as they were (other test files read the public config).
  if (savedSettings) {
    await prisma.seoSiteSettings.update({ where: { id: "site" }, data: { googleSiteVerification: savedSettings.googleSiteVerification, tracking: (savedSettings.tracking ?? undefined) as object | undefined, crawlerRules: (savedSettings.crawlerRules ?? undefined) as object | undefined } });
  } else {
    await prisma.seoSiteSettings.updateMany({ where: { id: "site" }, data: { googleSiteVerification: null } });
  }
});

describe("access", () => {
  it("needs an SEO, editor or admin account", async () => {
    expect((await request(app).get(`${P}/overview`)).status).toBe(401);
    expect((await as(customer).get(`${P}/overview`)).status).toBe(403);
    expect((await request(app).post(`${P}/tasks`).send({ title: "x" })).status).toBe(401);
  });

  it("lets every SEO role read", async () => {
    for (const c of [admin, seo, editor, viewer]) {
      const res = await as(c).get(`${P}/overview`);
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
    const me = await as(viewer).get(`${P}/me`);
    expect(me.body).toMatchObject({ role: "VIEWER", seo: { read: true, manage: false, editContent: false }, staff: false });
  });

  it("keeps viewers read-only", async () => {
    expect((await as(viewer).post(`${P}/tasks`, { title: "Viewer task" })).status).toBe(403);
    expect((await as(viewer).put(`${P}/pages/${pageId}/draft`, { body: "Hi" })).status).toBe(403);
    expect((await as(viewer).post(`${P}/technical/run`)).status).toBe(403);
    expect((await as(viewer).post(`${P}/imports/preview`, { kind: "REDIRECTS", source: "CSV", text: "from,to\n/a,/b" })).status).toBe(403);
    expect((await as(viewer).put(`${P}/crawlers`, { rules: {} })).status).toBe(403);
  });

  it("lets editors draft words and images, not indexing or URLs", async () => {
    expect((await as(editor).put(`${P}/pages/${pageId}/draft`, { body: "## Editor words" })).status).toBe(200);
    const blocked = await as(editor).put(`${P}/pages/${pageId}/draft`, { robotsIndex: false });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toContain("robotsIndex");
    expect((await as(editor).put(`${P}/pages/${pageId}/draft`, { slug: "new-slug" })).status).toBe(403);
    expect((await as(editor).post(`${P}/pages/${pageId}/draft/publish`)).status).toBe(403);
    expect((await as(editor).post(`${P}/imports/preview`, { kind: "REDIRECTS", source: "CSV", text: "from,to\n/a,/b" })).status).toBe(403);
    await as(admin).del(`${P}/pages/${pageId}/draft`);
  });

  it("keeps admin-only changes away from SEO managers", async () => {
    expect((await as(seo).post(`${P}/requests/apply`, { kind: "VERIFICATION", payload: { token: "abcdefghijklmnop" }, confirm: true })).status).toBe(403);
    const r = await as(seo).post(`${P}/requests`, { kind: "VERIFICATION", payload: { token: "abcdefghijklmnop" } });
    expect(r.status).toBe(201);
    expect((await as(seo).post(`${P}/requests/${r.body.request.id}/review`, { decision: "approve" })).status).toBe(403);
    expect((await as(seo).post(`${P}/requests/${r.body.request.id}/cancel`)).status).toBe(200);
  });

  it("never reaches bookings, payments, partners, staff or server settings", async () => {
    for (const c of [seo, editor, viewer]) {
      for (const url of ["/api/admin/bookings", "/api/admin/metrics", "/api/admin/staff", "/api/affiliates/admin/payouts", "/api/pricing/admin/rules"]) {
        const res = await as(c).get(url);
        expect([401, 403, 404]).toContain(res.status);
        expect(res.status).not.toBe(200);
      }
    }
  });
});

describe("drafts of live pages", () => {
  it("keeps the live page unchanged until the draft is published", async () => {
    const title = `Portal draft title ${unique()}`;
    const saved = await as(seo).put(`${P}/pages/${pageId}/draft`, { seoTitle: title });
    expect(saved.status).toBe(200);
    expect(saved.body.changes.seoTitle.to).toBe(title);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: pageId } })).seoTitle).not.toBe(title);

    const published = await as(seo).post(`${P}/pages/${pageId}/draft/publish`);
    expect(published.status).toBe(200);
    const page = await prisma.seoPage.findUniqueOrThrow({ where: { id: pageId } });
    expect(page.seoTitle).toBe(title);
    expect(page.draft).toBeNull();
    expect(await prisma.auditLog.count({ where: { entityId: pageId, action: "SEO_PAGE_DRAFT_PUBLISHED" } })).toBe(1);
  });

  it("drops fields that match the live value", async () => {
    const page = await prisma.seoPage.findUniqueOrThrow({ where: { id: pageId } });
    const saved = await as(seo).put(`${P}/pages/${pageId}/draft`, { seoTitle: page.seoTitle });
    expect(saved.body.draft).toBeNull();
  });
});

describe("structured data", () => {
  it("validates JSON-LD", () => {
    expect(validateSchema("{not json").checks.some((c) => c.level === "error")).toBe(true);
    const cdn = validateSchema(JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: "x", image: "https://cdn.prod.website-files.com/a/b.jpg", datePublished: "2024-01-01", author: { "@type": "Person", name: "A" }, publisher: { "@id": "https://www.vistachase.com/#organization" } }));
    expect(cdn.checks.some((c) => c.level === "error" && /Webflow/i.test(c.message))).toBe(true);
    const site = validateSchema(JSON.stringify({ "@context": "https://schema.org", "@type": "TouristInformationCenter", "@id": "https://example.com/#org", name: "Vista Chase", url: "https://www.vistachase.com" }), { scope: "SITE" });
    expect(site.checks.some((c) => c.level === "error")).toBe(true);
  });

  it("publishes site-wide blocks only for an admin", async () => {
    const json = JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", "@id": "https://www.vistachase.com/#website", name: "Vista Chase", url: "https://www.vistachase.com" });
    const created = await as(seo).post(`${P}/schema`, { scope: "SITE", name: "Website", json });
    expect(created.status).toBe(201);
    const blockId = created.body.block.id;
    expect((await as(seo).post(`${P}/schema/${blockId}/publish`)).status).toBe(403);
    // Archive it so it never reaches the public config of other tests.
    expect((await as(admin).post(`${P}/schema/${blockId}/unpublish`, { archive: true })).status).toBe(200);
  });
});

describe("Webflow HTML conversion", () => {
  it("keeps headings, lists, links and alt text and drops embeds", () => {
    const html = `<h1>Title</h1><p>Read <a href="https://www.vistachase.com/private-tours">our tours</a> &amp; more.</p><h3>Sub</h3><ul><li>One</li><li>Two</li></ul><figure><img src="https://cdn.prod.website-files.com/x/lake.jpg" alt="Lake Louise at dawn"></figure><div class="w-embed"><script>alert(1)</script></div>`;
    const out = htmlToMarkdown(html, { siteHosts: ["www.vistachase.com"] });
    expect(out.markdown).toContain("## Title");
    expect(out.markdown).toContain("### Sub");
    expect(out.markdown).toContain("[our tours](/private-tours)");
    expect(out.markdown).toContain("- One");
    expect(out.markdown).toContain("![Lake Louise at dawn](https://cdn.prod.website-files.com/x/lake.jpg)");
    expect(out.markdown).not.toContain("alert");
    expect(out.stats.embedsRemoved).toBe(1);
  });

  it("reports heading jumps", () => {
    expect(headingOutline("## A\n#### B").problems.length).toBe(1);
    expect(headingOutline("## A\n### B").problems.length).toBe(0);
  });
});

describe("imports", () => {
  it("imports published blog posts at /blog-post/<slug> and skips drafts", async () => {
    const live = `portal-post-${unique()}`;
    const draft = `portal-draft-${unique()}`;
    const csv = [
      "Name,Slug,Post Body,Post Summary,SEO Title,Meta Description,Created On,Updated On,Published On,Draft,Archived",
      `Live post,${live},"<h2>Hello</h2><p>Body text</p>",Short summary,Exact Webflow title,Exact Webflow description,2023-05-01T10:00:00Z,2024-02-01T10:00:00Z,2025-09-01T10:00:00Z,false,false`,
      `Draft post,${draft},<p>Draft</p>,,,,2023-05-01T10:00:00Z,,,true,false`,
    ].join("\n");
    const preview = await as(seo).post(`${P}/imports/preview`, { kind: "BLOG_POSTS", source: "CSV", text: csv, fileName: "posts.csv" });
    expect(preview.status).toBe(201);
    const rows = preview.body.batch.preview.rows;
    expect(rows.find((r: { slug: string }) => r.slug === live).action).toBe("create");
    expect(rows.find((r: { slug: string }) => r.slug === draft).action).toBe("skip");

    expect((await as(seo).post(`${P}/imports/${preview.body.batch.id}/apply`, { publish: true, confirm: false })).status).toBe(400);
    const applied = await as(seo).post(`${P}/imports/${preview.body.batch.id}/apply`, { publish: true, confirm: true });
    expect(applied.status).toBe(200);
    expect((await as(seo).post(`${P}/imports/${preview.body.batch.id}/apply`, { publish: true, confirm: true })).status).toBe(409);

    const page = await prisma.seoPage.findUniqueOrThrow({ where: { path: `/blog-post/${live}` } });
    expect(page.status).toBe("PUBLISHED");
    expect(page.seoTitle).toBe("Exact Webflow title");
    expect(page.metaDescription).toBe("Exact Webflow description");
    // "Created On" is the original publish date; "Published On" is only the last re-publish.
    expect(page.datePublished?.toISOString()).toBe("2023-05-01T10:00:00.000Z");
    expect(page.dateModified?.toISOString()).toBe("2024-02-01T10:00:00.000Z");
    expect(await prisma.seoPage.findUnique({ where: { path: `/blog-post/${draft}` } })).toBeNull();

    const pub = await request(app).get(`/api/seo/public/blog/${live}`);
    expect(pub.status).toBe(200);
    expect(pub.body.post.body).toContain("## Hello");
    const list = await request(app).get("/api/seo/public/blog");
    expect(list.body.posts.some((p: { path: string }) => p.path === `/blog-post/${live}`)).toBe(true);
    // Guides stay a separate list.
    const guides = await request(app).get("/api/seo/public/guides");
    expect(guides.body.guides.some((g: { path: string }) => g.path.endsWith(live))).toBe(false);

    // A second import of the same post becomes a draft on it, never an overwrite.
    const again = await as(seo).post(`${P}/imports/preview`, { kind: "BLOG_POSTS", source: "CSV", text: csv.replace("Exact Webflow title", "Changed title") });
    expect(again.body.batch.preview.rows.find((r: { slug: string }) => r.slug === live).action).toBe("update-draft");
    await as(seo).post(`${P}/imports/${again.body.batch.id}/apply`, { confirm: true });
    const after = await prisma.seoPage.findUniqueOrThrow({ where: { path: `/blog-post/${live}` } });
    expect(after.seoTitle).toBe("Exact Webflow title");
    expect((after.draft as { seoTitle?: string }).seoTitle).toBe("Changed title");
  });

  it("saves imported redirects switched off until reviewed", async () => {
    const from = `/old-portal-${unique()}`;
    const preview = await as(seo).post(`${P}/imports/preview`, { kind: "REDIRECTS", source: "CSV", text: `${from},/private-tours\n/admin/x,/` });
    expect(preview.status).toBe(201);
    const applied = await as(seo).post(`${P}/imports/${preview.body.batch.id}/apply`, { confirm: true });
    expect(applied.status).toBe(200);
    const redirect = await prisma.seoRedirect.findUniqueOrThrow({ where: { fromPath: from } });
    expect(redirect.active).toBe(false);
    expect(await prisma.seoRedirect.findUnique({ where: { fromPath: "/admin/x" } })).toBeNull();
    expect((await as(seo).post(`${P}/redirects/activate`, { ids: [redirect.id], confirm: false })).status).toBe(409);
    expect((await as(seo).post(`${P}/redirects/activate`, { ids: [redirect.id], confirm: true })).body.result.activated).toBe(1);
  });

  it("refuses the Webflow API when no token is set", async () => {
    const saved = process.env.WEBFLOW_API_TOKEN;
    delete process.env.WEBFLOW_API_TOKEN;
    const res = await as(seo).post(`${P}/imports/preview`, { kind: "BLOG_POSTS", source: "WEBFLOW_API" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await as(seo).get(`${P}/webflow`)).body.webflow.configured).toBe(false);
    process.env.WEBFLOW_API_TOKEN = saved;
  });
});

describe("migration checklist", () => {
  it("needs evidence or a confirmation to mark an item done", async () => {
    const list = await as(seo).get(`${P}/checklist`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(20);
    const item = list.body.items.find((i: { key: string }) => i.key === "rich-results");
    if (item.status === "DONE") await as(seo).patch(`${P}/checklist/${item.id}`, { status: "IN_PROGRESS" });
    expect((await as(seo).patch(`${P}/checklist/${item.id}`, { status: "DONE" })).status).toBe(422);
    const withEvidence = await as(seo).patch(`${P}/checklist/${item.id}`, { status: "DONE", addEvidence: "https://search.google.com/test/rich-results/result?id=example" });
    expect(withEvidence.status).toBe(200);
    expect(withEvidence.body.item.confirmedAt).toBeTruthy();
    await as(seo).patch(`${P}/checklist/${item.id}`, { status: "IN_PROGRESS" });
    expect((await as(seo).patch(`${P}/checklist/${item.id}`, { status: "DONE", confirm: true })).status).toBe(200);
    await as(seo).patch(`${P}/checklist/${item.id}`, { status: "NOT_STARTED" });
    expect((await as(viewer).patch(`${P}/checklist/${item.id}`, { status: "DONE", confirm: true })).status).toBe(403);
  });
});

describe("admin-approved changes", () => {
  it("puts the verification tag live only after an admin approves", async () => {
    await prisma.seoSiteSettings.updateMany({ where: { id: "site" }, data: { googleSiteVerification: null } });
    const before = await request(app).get("/api/seo/public/site-config");
    expect(before.body.verification).toBeNull();

    const token = "isQ3svDyWBUc7wL57wZAC-aZ5_yT-QXBS0eMwJU9jvk";
    const req = await as(seo).post(`${P}/requests`, { kind: "VERIFICATION", payload: { token }, reason: "From the handoff" });
    expect(req.status).toBe(201);
    expect(req.body.warnings).toEqual([]);
    expect((await request(app).get("/api/seo/public/site-config")).body.verification).toBeNull();

    const approved = await as(admin).post(`${P}/requests/${req.body.request.id}/review`, { decision: "approve" });
    expect(approved.status).toBe(200);
    expect((await request(app).get("/api/seo/public/site-config")).body.verification).toBe(token);
    expect((await as(admin).post(`${P}/requests/${req.body.request.id}/review`, { decision: "approve" })).status).toBe(409);
  });

  it("warns when a verification token differs from the handoff", async () => {
    const req = await as(seo).post(`${P}/requests`, { kind: "VERIFICATION", payload: { token: "isQ3svDyWBUc7wL57wZAC-ayT-QXBS0eMwJU9jvk" } });
    expect(req.body.warnings[0]).toContain("differs");
    await as(admin).post(`${P}/requests/${req.body.request.id}/review`, { decision: "reject", note: "Doesn't match the source" });
  });

  it("keeps the Google tag off until an admin switches it on", async () => {
    expect((await as(admin).post(`${P}/requests/apply`, { kind: "TRACKING", payload: { enabled: true, ga4Id: "G-KH1432E703", adsId: "AW-16675422535" } })).status).toBe(409);
    expect((await as(seo).post(`${P}/requests`, { kind: "TRACKING", payload: { enabled: true } })).status).toBe(400);
    const applied = await as(admin).post(`${P}/requests/apply`, { kind: "TRACKING", payload: { enabled: true, ga4Id: "G-KH1432E703", adsId: "AW-16675422535" }, confirm: true });
    expect(applied.status).toBe(200);
    const config = await request(app).get("/api/seo/public/site-config");
    expect(config.body.tracking).toMatchObject({ ga4Id: "G-KH1432E703", adsId: "AW-16675422535" });
    await as(admin).post(`${P}/requests/apply`, { kind: "TRACKING", payload: { enabled: false }, confirm: true });
    expect((await request(app).get("/api/seo/public/site-config")).body.tracking).toBeNull();
  });
});

describe("crawler rules", () => {
  it("never blocks search engines and asks before blocking an AI crawler", async () => {
    expect((await as(seo).put(`${P}/crawlers`, { rules: { Googlebot: "block" } })).status).toBe(400);
    expect((await as(seo).put(`${P}/crawlers`, { rules: { GPTBot: "block" } })).status).toBe(409);
    const ok = await as(seo).put(`${P}/crawlers`, { rules: { GPTBot: "block" }, confirm: true });
    expect(ok.status).toBe(200);
    expect(ok.body.crawlers.preview).toContain("User-Agent: GPTBot");
    expect((await request(app).get("/api/seo/public/site-config")).body.crawlerRules).toEqual(["GPTBot"]);
    expect((await as(seo).put(`${P}/crawlers`, { rules: {} })).status).toBe(200);
    expect((await request(app).get("/api/seo/public/site-config")).body.crawlerRules).toEqual([]);
  });

  it("reads robots.txt like a crawler", () => {
    const parsed = parseRobots("User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: https://www.vistachase.com/sitemap.xml");
    expect(robotsAllows(parsed, "Googlebot", "/")).toBe(true);
    expect(robotsAllows(parsed, "Googlebot", "/admin/x")).toBe(false);
    expect(robotsAllows(parsed, "GPTBot", "/")).toBe(false);
    expect(parsed.sitemaps).toEqual(["https://www.vistachase.com/sitemap.xml"]);
    expect(robotsPreview([], "https://www.vistachase.com")).toContain("Disallow: /seo");
  });
});

describe("tasks, history and audit reading", () => {
  it("assigns tasks only to SEO staff and logs changes", async () => {
    const team = await as(seo).get(`${P}/team`);
    const assignee = team.body.team.find((t: { role: string }) => t.role === "EDITOR");
    const created = await as(seo).post(`${P}/tasks`, { title: "Fix alt text on blog images", assigneeId: assignee.id, priority: "HIGH", path: "/blog" });
    expect(created.status).toBe(201);
    const customerUser = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
    expect((await as(seo).post(`${P}/tasks`, { title: "Nope", assigneeId: customerUser.id })).status).toBe(400);
    const done = await as(editor).patch(`${P}/tasks/${created.body.task.id}`, { status: "DONE" });
    expect(done.body.task.completedAt).toBeTruthy();
    expect((await as(editor).del(`${P}/tasks/${created.body.task.id}`)).status).toBe(403);
    expect((await as(seo).del(`${P}/tasks/${created.body.task.id}`)).status).toBe(200);
    const log = await as(viewer).get(`${P}/activity?entityType=SeoTask`);
    expect(log.body.entries.some((e: { action: string }) => e.action === "SEO_TASK_DELETED")).toBe(true);
  });

  it("reads images, alt text and JSON-LD from a page", () => {
    const html = `<html><head><meta name="viewport" content="width=device-width"><script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","@id":"https://www.vistachase.com/blog-post/a#post","image":"https://www.vistachase.com/media/a.jpg"}</script><script type="application/ld+json">{bad</script></head><body><h1>A</h1><img src="/media/a.jpg" alt="Moraine Lake" width="800" height="600" loading="lazy"><img src="/_next/image?url=%2Fmedia%2Fb.jpg&w=640&q=75"></body></html>`;
    const page = parseHtml(html, "https://www.vistachase.com/blog-post/a");
    expect(page.jsonLd?.length).toBe(2);
    expect(page.jsonLd?.[0].types).toContain("BlogPosting");
    expect(page.jsonLd?.[1].ok).toBe(false);
    const imgs = page.images?.filter((i) => i.kind === "img") ?? [];
    expect(imgs.map((i) => i.src)).toEqual(["/media/a.jpg", "/media/b.jpg"]);
    expect(imgs[1].alt).toBeNull();
    expect(looksLikeFileName("IMG_2034.jpg")).toBe(true);
    expect(looksLikeFileName("Moraine Lake at sunrise")).toBe(false);
  });
});
