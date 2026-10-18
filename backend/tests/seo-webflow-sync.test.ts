// Webflow blog sync, against a fake Webflow API (no request leaves the machine): published posts are
// added at their Webflow address, drafts never are, re-runs make no duplicates, local edits are never
// overwritten, unpublished posts go offline (not deleted) and come back, addresses never move.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { syncWebflowBlog } from "@/modules/seo/portal/webflow-sync";
import { publicBlogPosts, publicGuide, sitemapEntries } from "@/modules/seo/seo.public";
import { BLOG_PREFIX } from "@/modules/seo/static-routes";

const app = createApp();
const tag = Math.random().toString(36).slice(2, 8);
const P = "/api/seo/portal";
const CDN = "https://cdn.prod.website-files.com/abc123";

type U = { id: string; email: string; role: string; name: string };
const cookieFor = (u: U) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;

interface Item {
  id: string;
  isDraft?: boolean;
  isArchived?: boolean;
  createdOn: string;
  lastUpdated: string;
  lastPublished: string | null;
  fieldData: Record<string, unknown>;
}

const para = "Ride the Lake Louise Summer Gondola for grizzly bear viewing and big views over the Bow Valley. ".repeat(12);
const item = (n: string, over: Partial<Item> = {}, fields: Record<string, unknown> = {}): Item => ({
  id: `wf-${n}-${tag}`,
  createdOn: "2026-03-01T10:00:00.000Z",
  lastUpdated: "2026-10-15T08:27:00.000Z",
  lastPublished: "2026-10-15T08:27:00.000Z",
  ...over,
  fieldData: {
    name: `Gondola guide ${n} ${tag}`,
    slug: `gondola-${n}-${tag}`,
    "post-body": `<h1>Gondola guide ${n} ${tag}</h1><p><img src="${CDN}/hero-${n}.png" alt="Gondola cabins"></p><p><strong>Quick answer:</strong> ${para}</p><h2>Tickets</h2><p>See the <a href="https://www.vistachase.com/blog-post/lake-louise-hiking-guide">Lake Louise hiking guide</a>.</p>`,
    "post-summary": `Plan your Lake Louise Summer Gondola trip ${n}.`,
    "thumbnail-image": { url: `${CDN}/thumb-${n}.png`, alt: `Thumbnail ${n}` },
    featured: n === "a",
    ...fields,
  },
});

let live: Item[] = [];
let staged: Item[] = [];
const fakeWebflow = async (url: string) => {
  const u = new URL(url);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (u.pathname === "/v2/sites/site-test/collections") return json({ collections: [{ id: "col-test", displayName: "Blog Posts", slug: "blog-posts" }] });
  if (u.pathname === "/v2/collections/col-test/items/live") return json({ items: live, pagination: { total: live.length } });
  if (u.pathname === "/v2/collections/col-test/items") return json({ items: staged, pagination: { total: staged.length } });
  return new Response("not found", { status: 404 });
};
const sync = () => syncWebflowBlog({ trigger: "MANUAL", fetchImpl: fakeWebflow as unknown as typeof fetch });
const pageAt = (slug: string) => prisma.seoPage.findUnique({ where: { path: `${BLOG_PREFIX}${slug}` } });
/** Moves the last sync (and last change) back a minute, as if the sync ran a while ago. */
const age = (slug: string) => prisma.$executeRaw`UPDATE "SeoPage" SET "webflowSyncedAt" = now() - interval '1 minute', "updatedAt" = now() - interval '1 minute' WHERE path = ${`${BLOG_PREFIX}${slug}`}`;

const env = { ...process.env };
let seo = "";
let editor = "";

beforeAll(async () => {
  process.env.WEBFLOW_API_TOKEN = "test-token";
  process.env.WEBFLOW_SITE_ID = "site-test";
  process.env.WEBFLOW_BLOG_COLLECTION_ID = "col-test";
  seo = cookieFor(await prisma.user.create({ data: { email: `wf-seo-${tag}@example.com`, passwordHash: "x", name: "WF SEO", role: "SEO_MANAGER" } }));
  editor = cookieFor(await prisma.user.create({ data: { email: `wf-editor-${tag}@example.com`, passwordHash: "x", name: "WF editor", role: "EDITOR" } }));
});

afterAll(() => {
  process.env = env;
});

describe("Webflow blog sync", () => {
  it("adds published posts at their Webflow address and never brings drafts in", async () => {
    const a = item("a");
    const draft = item("draft", { isDraft: true, lastPublished: null });
    live = [a];
    staged = [a, draft];
    const r = await sync();
    expect(r.created).toEqual([`${BLOG_PREFIX}gondola-a-${tag}`]);
    const page = await pageAt(`gondola-a-${tag}`);
    expect(page).toMatchObject({ status: "PUBLISHED", source: "CMS", webflowItemId: a.id, importSource: "WEBFLOW_API", featured: true, excerpt: `Plan your Lake Louise Summer Gondola trip a.`, thumbnailImage: `${CDN}/thumb-a.png`, thumbnailAlt: "Thumbnail a", sitemapInclude: true, robotsIndex: true });
    expect(page!.datePublished?.toISOString()).toBe("2026-03-01T10:00:00.000Z");
    // Body: the Webflow H1 became an H2 (the page keeps one H1), the internal link is site-relative.
    expect(page!.body).toContain(`## Gondola guide a ${tag}`);
    expect(page!.body).toContain(`![Gondola cabins](${CDN}/hero-a.png)`);
    expect(page!.body).toContain("[Lake Louise hiking guide](/blog-post/lake-louise-hiking-guide)");
    expect(await pageAt(`gondola-draft-${tag}`)).toBeNull();

    expect((await publicBlogPosts()).some((p) => p.path === page!.path)).toBe(true);
    expect(await publicGuide(`gondola-a-${tag}`, BLOG_PREFIX)).not.toBeNull();
    expect(await publicGuide(`gondola-draft-${tag}`, BLOG_PREFIX)).toBeNull();
    expect((await sitemapEntries()).some((e) => e.path === page!.path)).toBe(true);
  });

  it("makes no duplicates and no changes when run again", async () => {
    const before = await pageAt(`gondola-a-${tag}`);
    const r = await sync();
    expect(r.created).toEqual([]);
    expect(r.updated).toEqual([]);
    expect(r.unchanged).toBe(1);
    expect(await prisma.seoPage.count({ where: { webflowItemId: live[0].id } })).toBe(1);
    expect((await pageAt(`gondola-a-${tag}`))!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
  });

  it("applies Webflow edits to a post nobody changed here, keeping the address and publish date", async () => {
    await age(`gondola-a-${tag}`);
    live = [item("a", { lastUpdated: "2026-10-16T09:00:00.000Z" }, { "post-summary": "New summary from Webflow.", featured: false })];
    staged = [...live];
    const r = await sync();
    expect(r.updated).toEqual([`${BLOG_PREFIX}gondola-a-${tag}`]);
    const page = await pageAt(`gondola-a-${tag}`);
    expect(page).toMatchObject({ excerpt: "New summary from Webflow.", featured: false, status: "PUBLISHED", draft: null });
    expect(page!.datePublished?.toISOString()).toBe("2026-03-01T10:00:00.000Z");
  });

  it("puts Webflow edits in a draft when the post was changed here", async () => {
    await age(`gondola-a-${tag}`);
    await prisma.seoPage.update({ where: { path: `${BLOG_PREFIX}gondola-a-${tag}` }, data: { seoTitle: "Lake Louise Summer Gondola Guide | Vista Chase" } });
    live = [item("a", { lastUpdated: "2026-10-17T09:00:00.000Z" }, { "post-summary": "Second Webflow summary.", featured: false })];
    staged = [...live];
    const r = await sync();
    expect(r.drafted).toEqual([`${BLOG_PREFIX}gondola-a-${tag}`]);
    const page = await pageAt(`gondola-a-${tag}`);
    expect(page!.excerpt).toBe("New summary from Webflow.");
    expect(page!.seoTitle).toBe("Lake Louise Summer Gondola Guide | Vista Chase");
    expect((page!.draft as Record<string, unknown>).excerpt).toBe("Second Webflow summary.");
    // The same Webflow values don't pile up again on the next run.
    expect((await sync()).drafted).toEqual([]);
  });

  it("links a post that already lives at the same address and drafts the differences", async () => {
    const slug = `gondola-b-${tag}`;
    await prisma.seoPage.create({ data: { path: `${BLOG_PREFIX}${slug}`, label: "Imported earlier", pageType: "GUIDE", source: "CMS", status: "PUBLISHED", publishedAt: new Date(), body: "Old body", importSource: "WEBFLOW_CSV" } });
    live = [item("a", { lastUpdated: "2026-10-17T09:00:00.000Z" }, { "post-summary": "Second Webflow summary.", featured: false }), item("b")];
    staged = [...live];
    const r = await sync();
    expect(r.drafted).toEqual([`${BLOG_PREFIX}${slug}`]);
    const page = await pageAt(slug);
    expect(page).toMatchObject({ webflowItemId: live[1].id, body: "Old body", label: "Imported earlier", status: "PUBLISHED" });
    expect((page!.draft as Record<string, unknown>).label).toBe(`Gondola guide b ${tag}`);
    expect(await prisma.seoPage.count({ where: { path: { startsWith: `${BLOG_PREFIX}gondola-b-${tag}` } } })).toBe(1);
  });

  it("never moves a post when its Webflow slug changes", async () => {
    await age(`gondola-a-${tag}`);
    live = [item("a", { lastUpdated: "2026-10-18T09:00:00.000Z" }, { slug: `gondola-renamed-${tag}` }), live[1]];
    staged = [...live];
    const r = await sync();
    expect(r.notes.join(" ")).toMatch(/address wasn't changed/);
    expect(await pageAt(`gondola-renamed-${tag}`)).toBeNull();
    expect(await pageAt(`gondola-a-${tag}`)).not.toBeNull();
  });

  it("takes a post offline when Webflow unpublishes it, and back when it is published again", async () => {
    const c = item("c");
    live = [...live, c];
    staged = [...live];
    await sync();
    await age(`gondola-c-${tag}`);
    live = live.filter((i) => i.id !== c.id);
    staged = [...live, { ...c, isDraft: true }];
    const r = await sync();
    expect(r.offline).toEqual([`${BLOG_PREFIX}gondola-c-${tag}`]);
    const off = await pageAt(`gondola-c-${tag}`);
    expect(off).toMatchObject({ status: "DRAFT" });
    expect(off!.webflowOfflineAt).not.toBeNull();
    expect(await publicGuide(`gondola-c-${tag}`, BLOG_PREFIX)).toBeNull();
    expect((await sitemapEntries()).some((e) => e.path === off!.path)).toBe(false);

    live = [...live, c];
    staged = [...live];
    const back = await sync();
    expect(back.updated).toContain(`${BLOG_PREFIX}gondola-c-${tag}`);
    expect(await pageAt(`gondola-c-${tag}`)).toMatchObject({ status: "PUBLISHED", webflowOfflineAt: null });
  });

  it("refuses to take many posts offline at once (an empty or broken Webflow answer)", async () => {
    const many = ["d", "e", "f", "g", "h", "i"].map((n) => item(n));
    live = [...live, ...many];
    staged = [...live];
    await sync();
    live = [];
    staged = [];
    const r = await sync();
    expect(r.offline).toEqual([]);
    expect(r.notes.join(" ")).toMatch(/none were taken offline/);
    expect(await pageAt(`gondola-d-${tag}`)).toMatchObject({ status: "PUBLISHED" });
  });

  it("respects the sitemap and index settings of synced posts", async () => {
    await prisma.seoPage.update({ where: { path: `${BLOG_PREFIX}gondola-d-${tag}` }, data: { sitemapInclude: false } });
    await prisma.seoPage.update({ where: { path: `${BLOG_PREFIX}gondola-e-${tag}` }, data: { robotsIndex: false } });
    const paths = new Set((await sitemapEntries()).map((e) => e.path));
    expect(paths.has(`${BLOG_PREFIX}gondola-d-${tag}`)).toBe(false);
    expect(paths.has(`${BLOG_PREFIX}gondola-e-${tag}`)).toBe(false);
    expect(paths.has(`${BLOG_PREFIX}gondola-f-${tag}`)).toBe(true);
  });
});

describe("Webflow sync routes", () => {
  it("shows the status to the team and lets only SEO managers run it", async () => {
    const status = await request(app).get(`${P}/webflow/sync`).set("Cookie", editor);
    expect(status.status).toBe(200);
    expect(status.body.sync).toMatchObject({ configured: true, scheduled: false });
    expect(status.body.sync.lastRuns.length).toBeGreaterThan(0);
    expect(JSON.stringify(status.body)).not.toContain("test-token");
    expect((await request(app).post(`${P}/webflow/sync`).set("Cookie", editor).send({})).status).toBe(403);
  });

  it("says so when Webflow isn't connected", async () => {
    delete process.env.WEBFLOW_API_TOKEN;
    const res = await request(app).post(`${P}/webflow/sync`).set("Cookie", seo).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/WEBFLOW_API_TOKEN/);
    process.env.WEBFLOW_API_TOKEN = "test-token";
  });
});
