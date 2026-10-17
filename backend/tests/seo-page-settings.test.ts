// Page settings from the Webflow-style SEO platform brief: site search fields, page custom code
// (admin only, allowed tags only), page JSON-LD on any page, the public extras and search index,
// and the blog list's filters, paging and CSV export.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { parseCustomCode } from "@/modules/seo/portal/custom-code";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
const P = "/api/seo/portal";
const A = "/api/seo/admin";

type U = { id: string; email: string; role: string; name: string };
const cookieFor = (u: U) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;
const as = (cookie: string) => ({
  get: (url: string) => request(app).get(url).set("Cookie", cookie),
  post: (url: string, body?: object) => request(app).post(url).set("Cookie", cookie).send(body ?? {}),
  put: (url: string, body?: object) => request(app).put(url).set("Cookie", cookie).send(body ?? {}),
  patch: (url: string, body?: object) => request(app).patch(url).set("Cookie", cookie).send(body ?? {}),
});

let admin = "";
let seo = "";
let editor = "";
let livePath = "";
let liveId = "";

async function makeUser(role: "SEO_MANAGER" | "EDITOR") {
  return prisma.user.create({ data: { email: `settings-${role.toLowerCase()}-${unique()}@example.com`, passwordHash: "x", name: `${role} settings`, role } });
}

beforeAll(async () => {
  admin = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));
  seo = cookieFor(await makeUser("SEO_MANAGER"));
  editor = cookieFor(await makeUser("EDITOR"));
  livePath = `/settings-test-${unique()}`;
  const page = await prisma.seoPage.create({ data: { path: livePath, label: "Settings test page", pageType: "STATIC", source: "STATIC_ROUTE", status: "PUBLISHED", publishedAt: new Date(), seoTitle: "Settings test | Vista Chase", metaDescription: "A page for the settings tests.", ogImage: "/media/photos/og.webp" } });
  liveId = page.id;
});

describe("custom code parser", () => {
  it("accepts the allowed tags", () => {
    const head = parseCustomCode(
      `<!-- Search Console -->
<meta name="google-site-verification" content="abc123">
<link rel="preconnect" href="https://www.googletagmanager.com">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>
<script>window.dataLayer = window.dataLayer || [];</script>
<style>.promo { color: red; }</style>
<noscript><img src="https://example.com/pixel.gif" alt=""></noscript>`,
      "head",
    );
    expect(head.errors).toEqual([]);
    expect(head.elements.map((e) => e.tag)).toEqual(["meta", "link", "script", "script", "style", "noscript"]);
  });

  it("refuses anything that could take over the page", () => {
    const cases: [string, RegExp][] = [
      [`<iframe src="https://evil.example"></iframe>`, /isn't allowed/],
      [`<img src=x onerror="alert(1)">`, /isn't allowed/],
      [`<script onload="x()" src="https://a.example/x.js"></script>`, /event handler/],
      [`<script src="http://insecure.example/x.js"></script>`, /https/],
      [`<script src="https://a.example/x.js">alert(1)</script>`, /can't also have code/],
      [`<meta http-equiv="refresh" content="0;url=https://evil.example">`, /http-equiv/],
      [`<link rel="import" href="https://a.example">`, /isn't allowed/],
      [`<script type="text/x-template">x</script>`, /isn't allowed/],
      [`<script>never closed`, /closing/],
      [`hello <meta name="a" content="b">`, /Text outside a tag/],
      [`<script type="application/ld+json">{bad json</script>`, /valid JSON/],
      [`<noscript><script>alert(1)</script></noscript>`, /./],
    ];
    for (const [code, error] of cases) {
      const r = parseCustomCode(code, "head");
      expect(r.errors.join(" "), code).toMatch(error);
    }
    expect(parseCustomCode(`<meta name="a" content="b">`, "body").errors.join(" ")).toMatch(/head box/);
    expect(parseCustomCode("x".repeat(20_001), "head").errors[0]).toMatch(/under/);
  });
});

describe("custom code permissions", () => {
  it("lets anyone check, and only an admin save", async () => {
    const check = await as(editor).post(`${P}/custom-code/check`, { head: `<meta name="a" content="b">`, body: `<iframe></iframe>` });
    expect(check.status).toBe(200);
    expect(check.body.head).toEqual({ tags: ["meta"], errors: [] });
    expect(check.body.body.errors.length).toBe(1);

    const code = { head: `<meta name="robots-test" content="yes">`, body: `<script>window.vcTest = 1;</script>` };
    expect((await as(seo).put(`${P}/pages/${liveId}/custom-code`, code)).status).toBe(403);
    expect((await as(editor).put(`${P}/pages/${liveId}/custom-code`, code)).status).toBe(403);
    expect((await as(admin).put(`${P}/pages/${liveId}/custom-code`, { head: "<iframe></iframe>", body: "" })).status).toBe(400);
    const saved = await as(admin).put(`${P}/pages/${liveId}/custom-code`, code);
    expect(saved.status).toBe(200);
    expect(saved.body.changed).toBe(true);
    const log = await prisma.auditLog.findFirst({ where: { action: "SEO_CUSTOM_CODE_UPDATED", entityId: liveId } });
    expect(log).not.toBeNull();
  });

  it("serves only the parsed code of a published page", async () => {
    const res = await request(app).get(`/api/seo/public/page-extras?path=${encodeURIComponent(livePath)}`);
    expect(res.status).toBe(200);
    expect(res.body.extras.head).toEqual([{ tag: "meta", attrs: { name: "robots-test", content: "yes" } }]);
    expect(res.body.extras.body[0]).toMatchObject({ tag: "script", content: "window.vcTest = 1;" });
    const none = await request(app).get(`/api/seo/public/page-extras?path=/no-such-page-${unique()}`);
    expect(none.body.extras).toBeNull();
  });
});

describe("page schema on any page", () => {
  it("publishes a JSON-LD block on a page built in code and serves it publicly", async () => {
    const json = JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: "Settings test page" });
    expect((await as(editor).post(`${P}/schema`, { scope: "PAGE", pageId: liveId, name: "Test block", json })).status).toBe(403);
    const saved = await as(seo).post(`${P}/schema`, { scope: "PAGE", pageId: liveId, name: "Test block", json });
    expect(saved.status).toBe(201);
    const pub = await as(seo).post(`${P}/schema/${saved.body.block.id}/publish`);
    expect(pub.status).toBe(200);
    const res = await request(app).get(`/api/seo/public/page-extras?path=${encodeURIComponent(livePath)}`);
    expect(res.body.extras.schema).toEqual([{ "@context": "https://schema.org", "@type": "WebPage", name: "Settings test page" }]);
  });
});

describe("site search settings", () => {
  it("are manager fields: editors can't change them", async () => {
    expect((await as(editor).patch(`${A}/pages/${liveId}`, { searchTitle: "x" })).status).toBe(403);
    expect((await as(seo).patch(`${A}/pages/${liveId}`, { searchImage: "javascript:alert(1)" })).status).toBe(400);
  });

  it("fall back to the SEO fields and drop excluded pages", async () => {
    const before = await request(app).get("/api/seo/public/search-index");
    const row = before.body.pages.find((p: { path: string }) => p.path === livePath);
    expect(row).toMatchObject({ title: "Settings test | Vista Chase", description: "A page for the settings tests.", image: "/media/photos/og.webp" });

    await prisma.seoPage.update({ where: { id: liveId }, data: { searchTitle: "Find the settings page", searchDescription: "Search blurb", searchImage: "/media/photos/search.webp" } });
    const custom = (await request(app).get("/api/seo/public/search-index")).body.pages.find((p: { path: string }) => p.path === livePath);
    expect(custom).toMatchObject({ title: "Find the settings page", description: "Search blurb", image: "/media/photos/search.webp" });

    await prisma.seoPage.update({ where: { id: liveId }, data: { searchExclude: true } });
    const after = await request(app).get("/api/seo/public/search-index");
    expect(after.body.pages.some((p: { path: string }) => p.path === livePath)).toBe(false);
  });

  it("keep the page's other metadata untouched", async () => {
    const meta = await request(app).get(`/api/seo/public/meta?path=${encodeURIComponent(livePath)}`);
    expect(meta.body.meta).toMatchObject({ seoTitle: "Settings test | Vista Chase", metaDescription: "A page for the settings tests." });
  });
});

describe("blog list", () => {
  const tag = unique();
  beforeAll(async () => {
    const now = Date.now();
    const rows = [
      { slug: `alpha-${tag}`, label: `Alpha ${tag}`, featured: true, status: "PUBLISHED" as const, createdAt: new Date(now - 2 * 86_400_000), robotsIndex: true },
      { slug: `bravo-${tag}`, label: `Bravo ${tag}`, featured: false, status: "DRAFT" as const, createdAt: new Date(now - 40 * 86_400_000), robotsIndex: false },
      { slug: `charlie-${tag}`, label: `=HYPERLINK("x") ${tag}`, featured: false, status: "PUBLISHED" as const, createdAt: new Date(now - 10 * 86_400_000), robotsIndex: true },
    ];
    for (const r of rows) {
      await prisma.seoPage.create({ data: { path: `/blog-post/${r.slug}`, label: r.label, pageType: "GUIDE", source: "CMS", status: r.status, featured: r.featured, robotsIndex: r.robotsIndex, createdAt: r.createdAt, publishedAt: r.status === "PUBLISHED" ? r.createdAt : null } });
    }
  });

  it("filters, sorts and pages", async () => {
    const all = await as(seo).get(`${P}/blog?q=${tag}`);
    expect(all.body.matching).toBe(3);
    expect(all.body.posts.length).toBe(3);
    expect((await as(seo).get(`${P}/blog?q=${tag}&featured=yes`)).body.posts.map((p: { label: string }) => p.label)).toEqual([`Alpha ${tag}`]);
    expect((await as(seo).get(`${P}/blog?q=${tag}&indexing=no`)).body.posts.map((p: { label: string }) => p.label)).toEqual([`Bravo ${tag}`]);
    expect((await as(seo).get(`${P}/blog?q=${tag}&created=7d`)).body.posts.map((p: { label: string }) => p.label)).toEqual([`Alpha ${tag}`]);
    expect((await as(seo).get(`${P}/blog?q=${tag}&status=DRAFT`)).body.matching).toBe(1);
    const sorted = await as(seo).get(`${P}/blog?q=${tag}&sort=created&dir=asc`);
    expect(sorted.body.posts.map((p: { slug: string }) => p.slug)).toEqual([`bravo-${tag}`, `charlie-${tag}`, `alpha-${tag}`]);
    const paged = await as(seo).get(`${P}/blog?q=${tag}&sort=name&dir=asc&page=2&pageSize=5`);
    expect(paged.body.matching).toBe(3);
    expect(paged.body.posts).toEqual([]);
    expect((await as(seo).get(`${P}/blog?sort=sideways`)).status).toBe(400);
  });

  it("exports the filtered list as CSV without spreadsheet formulas", async () => {
    const res = await as(seo).get(`${P}/blog/export.csv?q=${tag}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    const lines = res.text.trim().split("\n");
    expect(lines.length).toBe(4);
    expect(res.text).toContain(`'=HYPERLINK`);
    expect(res.text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });
});
