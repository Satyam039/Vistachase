// SEO dashboard API: permissions, bootstrap (insert-only), page overrides and publishing, guides,
// slug changes and redirects, keywords and CSV import, sitemap, llms.txt and the audit (with a fake
// site instead of a live crawl). Existing tours, bookings and commission lines must be untouched.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { runAudit } from "@/modules/seo/seo.audit";
import { publishDuePages } from "@/modules/seo/seo.pages";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);

let admin = "";
let customer = "";

const tokenCookie = (u: { id: string; email: string; role: string; name: string }) =>
  `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;

const as = (cookie: string) => ({
  get: (url: string) => request(app).get(url).set("Cookie", cookie),
  post: (url: string, body?: object) => request(app).post(url).set("Cookie", cookie).send(body ?? {}),
  patch: (url: string, body?: object) => request(app).patch(url).set("Cookie", cookie).send(body ?? {}),
  put: (url: string, body?: object) => request(app).put(url).set("Cookie", cookie).send(body ?? {}),
  del: (url: string) => request(app).delete(url).set("Cookie", cookie),
});

async function pageId(path: string) {
  return (await prisma.seoPage.findUniqueOrThrow({ where: { path } })).id;
}

const LONG_BODY = Array.from({ length: 220 }, (_, i) => `word${i}`).join(" ");

let before: { tours: number; bookings: number; ledger: number; departures: number };

beforeAll(async () => {
  const adminUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  admin = tokenCookie(adminUser);
  const id = unique();
  const cust = await prisma.user.create({ data: { email: `seo-cust-${id}@example.com`, passwordHash: "x", name: "Customer", role: "CUSTOMER" } });
  customer = tokenCookie(cust);
  before = {
    tours: await prisma.tour.count(),
    bookings: await prisma.booking.count(),
    ledger: await prisma.commissionLedger.count(),
    departures: await prisma.tourDeparture.count(),
  };
  const res = await as(admin).post("/api/seo/admin/bootstrap");
  expect(res.status).toBe(200);
});

describe("permissions", () => {
  it("refuses signed-out and non-admin users on every admin route", async () => {
    expect((await request(app).get("/api/seo/admin/overview")).status).toBe(401);
    expect((await as(customer).get("/api/seo/admin/overview")).status).toBe(403);
    expect((await as(customer).patch(`/api/seo/admin/pages/${await pageId("/")}`, { seoTitle: "Hacked" })).status).toBe(403);
    expect((await as(customer).post("/api/seo/admin/keywords", { keyword: "x", intent: "INFORMATIONAL", funnelStage: "TOFU", track: "TRAFFIC_ACQUISITION" })).status).toBe(403);
  });
});

describe("bootstrap", () => {
  it("registers code routes, tours and destinations, and starter keywords with unknown metrics", async () => {
    const tours = await prisma.tour.findMany({ select: { slug: true } });
    const paths = new Set((await prisma.seoPage.findMany({ select: { path: true } })).map((p) => p.path));
    for (const t of tours) expect(paths.has(`/${t.slug}`)).toBe(true);
    expect(paths.has("/")).toBe(true);
    expect(paths.has("/destinations/moraine-lake")).toBe(true);
    expect(paths.has("/login")).toBe(false);

    const keywords = await prisma.seoKeyword.findMany();
    expect(keywords.length).toBeGreaterThan(30);
    expect(keywords.every((k) => k.searchVolume === null && k.difficulty === null && k.volumeBasis === "UNKNOWN" && k.validationStatus === "UNVERIFIED")).toBe(true);
    expect(keywords.some((k) => /calgary|helicopter|wedding|honeymoon|chauffeur/i.test(k.keyword))).toBe(false);
    const shuttle = await prisma.seoKeyword.findUniqueOrThrow({ where: { normalized: "moraine lake shuttle" }, include: { mappings: { include: { page: true } } } });
    expect(shuttle.mappings[0]).toMatchObject({ role: "PRIMARY", page: { path: "/shuttles" } });
  });

  it("is insert-only and leaves tours, departures, bookings and commission lines alone", async () => {
    const page = await prisma.seoPage.findUniqueOrThrow({ where: { path: "/faq" } });
    await prisma.seoPage.update({ where: { id: page.id }, data: { pillar: "Staff edit" } });
    const again = await as(admin).post("/api/seo/admin/bootstrap");
    expect(again.body.result).toMatchObject({ pagesAdded: 0, clustersAdded: 0, keywordsAdded: 0, llmsPrepared: false });
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: page.id } })).pillar).toBe("Staff edit");
    expect(await prisma.tour.count()).toBe(before.tours);
    expect(await prisma.tourDeparture.count()).toBeGreaterThanOrEqual(before.departures);
    expect(await prisma.booking.count()).toBeGreaterThanOrEqual(before.bookings);
    expect(await prisma.commissionLedger.count()).toBeGreaterThanOrEqual(before.ledger);
  });
});

describe("page overrides", () => {
  it("serves published overrides publicly and audits the change", async () => {
    const id = await pageId("/private-tours");
    const title = "Private Tours in Banff & the Canadian Rockies | Vista Chase";
    const res = await as(admin).patch(`/api/seo/admin/pages/${id}`, { seoTitle: title, ogImage: "/media/photos/x.webp", secondaryKeywords: ["private guide banff", "private guide banff", " "] });
    expect(res.status).toBe(200);
    expect(res.body.page.secondaryKeywords).toEqual(["private guide banff"]);
    const pub = await request(app).get("/api/seo/public/meta").query({ path: "/private-tours/" });
    expect(pub.body.meta).toMatchObject({ seoTitle: title, ogImage: "/media/photos/x.webp" });
    expect(pub.body.meta.focusKeyword).toBeUndefined(); // research fields never leave the admin API
    expect(await prisma.auditLog.count({ where: { action: "SEO_PAGE_UPDATED", entityId: id } })).toBe(1);
    expect(await prisma.seoPageRevision.count({ where: { pageId: id, action: "UPDATED" } })).toBe(1);
  });

  it("refuses mass assignment, off-site canonicals and script links", async () => {
    const id = await pageId("/shuttles");
    expect((await as(admin).patch(`/api/seo/admin/pages/${id}`, { status: "ARCHIVED" })).status).toBe(400);
    expect((await as(admin).patch(`/api/seo/admin/pages/${id}`, { path: "/admin" })).status).toBe(400);
    expect((await as(admin).patch(`/api/seo/admin/pages/${id}`, { canonicalUrl: "https://evil.example/shuttles" })).status).toBe(400);
    expect((await as(admin).patch(`/api/seo/admin/pages/${id}`, { ctaUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await as(admin).patch(`/api/seo/admin/pages/${id}`, { slug: "new-address" })).status).toBe(400); // code routes keep their address
    expect((await as(admin).patch(`/api/seo/admin/pages/${id}`, { body: "content" })).status).toBe(400);
  });

  it("stores markup as plain text (it is escaped when rendered)", async () => {
    const id = await pageId("/gallery");
    const res = await as(admin).patch(`/api/seo/admin/pages/${id}`, { breadcrumbLabel: "<script>alert(1)</script>" });
    expect(res.status).toBe(200);
    expect(res.body.page.breadcrumbLabel).toBe("<script>alert(1)</script>");
  });

  it("needs a confirmation to noindex a key page, and noindex pages leave the sitemap", async () => {
    const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
    const id = await pageId(`/${tour.slug}`);
    const refused = await as(admin).patch(`/api/seo/admin/pages/${id}`, { robotsIndex: false });
    expect(refused.status).toBe(409);
    const ok = await as(admin).patch(`/api/seo/admin/pages/${id}`, { robotsIndex: false, confirmNoindex: true });
    expect(ok.status).toBe(200);
    let sitemap = (await request(app).get("/api/seo/public/sitemap")).body.entries.map((e: { path: string }) => e.path);
    expect(sitemap).not.toContain(`/${tour.slug}`);
    await as(admin).patch(`/api/seo/admin/pages/${id}`, { robotsIndex: true });
    sitemap = (await request(app).get("/api/seo/public/sitemap")).body.entries.map((e: { path: string }) => e.path);
    expect(sitemap).toContain(`/${tour.slug}`);
  });

  it("hides overrides while a page is unpublished", async () => {
    const id = await pageId("/about-us");
    await as(admin).patch(`/api/seo/admin/pages/${id}`, { seoTitle: "About Vista Chase: Banff and Canmore tour guides since day one" });
    expect((await as(admin).post(`/api/seo/admin/pages/${id}/status`, { action: "unpublish" })).status).toBe(200);
    expect((await request(app).get("/api/seo/public/meta").query({ path: "/about-us" })).body.meta).toBeNull();
    expect((await request(app).get("/api/seo/public/sitemap")).body.entries.map((e: { path: string }) => e.path)).not.toContain("/about-us");
    expect((await as(admin).post(`/api/seo/admin/pages/${id}/status`, { action: "publish" })).status).toBe(200);
    expect((await request(app).get("/api/seo/public/meta").query({ path: "/about-us" })).body.meta.seoTitle).toMatch(/^About Vista Chase/);
  });
});

describe("guides, slugs and redirects", () => {
  let guideId = "";
  const slug = `lake-louise-guide-${unique()}`;

  it("creates a draft guide and refuses a duplicate address", async () => {
    const res = await as(admin).post("/api/seo/admin/pages", { label: "Lake Louise guide", slug });
    expect(res.status).toBe(201);
    guideId = res.body.page.id;
    expect(res.body.page).toMatchObject({ path: `/guides/${slug}`, status: "DRAFT", source: "CMS" });
    expect((await as(admin).post("/api/seo/admin/pages", { label: "Again", slug })).status).toBe(409);
    expect((await as(admin).post("/api/seo/admin/pages", { label: "Bad", slug: "Bad Slug!" })).status).toBe(400);
    expect((await request(app).get(`/api/seo/public/guides/${slug}`)).status).toBe(404);
  });

  it("won't publish a thin or incomplete guide, then publishes a complete one", async () => {
    const blocked = await as(admin).post(`/api/seo/admin/pages/${guideId}/status`, { action: "publish" });
    expect(blocked.status).toBe(422);
    expect(blocked.body.checks.map((c: { field: string }) => c.field)).toEqual(expect.arrayContaining(["seoTitle", "metaDescription", "h1", "body"]));
    await as(admin).patch(`/api/seo/admin/pages/${guideId}`, {
      seoTitle: "Lake Louise Guide: Parking, Shuttles and Best Viewpoints",
      metaDescription: "How to reach Lake Louise without a parking spot, when to go, and the viewpoints worth the walk. Shuttle times and tips from local guides who visit daily.",
      h1: "Visiting Lake Louise",
      body: LONG_BODY,
      faqs: [{ question: "Is there parking at Lake Louise?", answer: "Yes, paid parking that fills early; shuttles run all day." }],
    });
    const ok = await as(admin).post(`/api/seo/admin/pages/${guideId}/status`, { action: "publish" });
    expect(ok.status).toBe(200);
    const pub = await request(app).get(`/api/seo/public/guides/${slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.guide.faqs).toHaveLength(1);
    expect(pub.body.guide.focusKeyword).toBeUndefined();
    const sitemap = (await request(app).get("/api/seo/public/sitemap")).body.entries.map((e: { path: string }) => e.path);
    expect(sitemap).toContain(`/guides/${slug}`);
  });

  it("blocks saving a live guide into an invalid state", async () => {
    const res = await as(admin).patch(`/api/seo/admin/pages/${guideId}`, { body: "too short now" });
    expect(res.status).toBe(422);
  });

  it("changing a guide's address 301s the old one, without chains", async () => {
    const newSlug = `${slug}-2`;
    const res = await as(admin).patch(`/api/seo/admin/pages/${guideId}`, { slug: newSlug });
    expect(res.status).toBe(200);
    const map = (await request(app).get("/api/seo/public/redirects")).body.redirects;
    expect(map[`/guides/${slug}`]).toEqual([`/guides/${newSlug}`, 301]);
    // Renaming back: the redirect from the new old address is created and the one into the page removed.
    await as(admin).patch(`/api/seo/admin/pages/${guideId}`, { slug });
    const map2 = (await request(app).get("/api/seo/public/redirects")).body.redirects;
    expect(map2[`/guides/${slug}`]).toBeUndefined();
    expect(map2[`/guides/${newSlug}`]).toEqual([`/guides/${slug}`, 301]);
    const sitemap = (await request(app).get("/api/seo/public/sitemap")).body.entries.map((e: { path: string }) => e.path);
    expect(sitemap).not.toContain(`/guides/${newSlug}`);
  });

  it("refuses loops, open redirects, reserved sources and redirects that hide a live page", async () => {
    const a = `/old-a-${unique()}`;
    const b = `/old-b-${unique()}`;
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: a, toPath: b })).status).toBe(201);
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: b, toPath: a })).status).toBe(409);
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: `/x-${unique()}`, toPath: "https://evil.example" })).status).toBe(400);
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: `/x-${unique()}`, toPath: "//evil.example" })).status).toBe(400);
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: "/admin", toPath: "/" })).status).toBe(400);
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: "/shuttles", toPath: "/" })).status).toBe(409);
    expect((await as(admin).post("/api/seo/admin/redirects", { fromPath: a, toPath: "/" })).status).toBe(409); // duplicate source
  });
});

describe("keywords", () => {
  const base = { intent: "TRANSACTIONAL", funnelStage: "BOFU", track: "BOOKING_CONVERSION" };

  it("rejects duplicates and metrics without a basis or source", async () => {
    const kw = `banff tour test ${unique()}`;
    expect((await as(admin).post("/api/seo/admin/keywords", { keyword: kw, ...base })).status).toBe(201);
    expect((await as(admin).post("/api/seo/admin/keywords", { keyword: `  ${kw.toUpperCase()} `, ...base })).status).toBe(409);
    expect((await as(admin).post("/api/seo/admin/keywords", { keyword: `${kw} 2`, ...base, searchVolume: 500 })).status).toBe(400);
    expect((await as(admin).post("/api/seo/admin/keywords", { keyword: `${kw} 3`, ...base, searchVolume: 500, volumeBasis: "RESEARCHED" })).status).toBe(400);
    const ok = await as(admin).post("/api/seo/admin/keywords", { keyword: `${kw} 4`, ...base, searchVolume: 500, volumeBasis: "RESEARCHED", volumeSource: "Google Keyword Planner" });
    expect(ok.status).toBe(201);
    expect(ok.body.keyword).toMatchObject({ searchVolume: 500, volumeBasis: "RESEARCHED" });
  });

  it("flags cannibalisation and intent mismatches instead of hiding them", async () => {
    const created = await as(admin).post("/api/seo/admin/keywords", { keyword: `private tour test ${unique()}`, ...base });
    const id = created.body.keyword.id;
    await as(admin).post(`/api/seo/admin/keywords/${id}/mappings`, { pageId: await pageId("/private-tours"), role: "PRIMARY" });
    const second = await as(admin).post(`/api/seo/admin/keywords/${id}/mappings`, { pageId: await pageId("/faq"), role: "PRIMARY" });
    expect(second.body.warnings.join(" ")).toMatch(/cannibalisation/);
    expect(second.body.warnings.join(" ")).toMatch(/information page/);
    expect(second.body.keyword.flags.cannibalised).toBe(true);
    const list = await as(admin).get("/api/seo/admin/keywords").query({ q: "private tour test", mapped: "yes" });
    expect(list.body.keywords.some((k: { id: string }) => k.id === id)).toBe(true);
  });

  it("previews a CSV without saving, then imports only the valid rows", async () => {
    const tag = unique();
    const csv = [
      "Keywords,Monthly Search Volume,Keyword Difficulty,Search Intent,Funnel Stage,Keyword Cluster,Primary URL,Notes",
      `banff csv ${tag} one,1200,30,informational,ToFu,CSV ${tag},/destinations/banff-national-park,`,
      `Banff CSV ${tag} ONE,,,commercial,MoFu,,,duplicate in file`,
      `banff csv ${tag} two,,,"informational, transactional",ToFu,,,two intents`,
      `banff csv ${tag} three,lots,,commercial,MoFu,,,bad volume`,
      `moraine lake shuttle,,,transactional,BoFu,,,already exists`,
      `banff csv ${tag} four,,,transactional,,,/shuttles,"=cmd|' /C calc'!A0"`,
    ].join("\n");
    const preview = await as(admin).post("/api/seo/admin/keywords/import/preview", { csv });
    expect(preview.status).toBe(200);
    expect(preview.body.preview.counts).toEqual({ create: 2, update: 0, skip: 2, error: 2 });
    expect(preview.body.preview.newClusters).toEqual([`CSV ${tag}`]);
    expect(await prisma.seoKeyword.count({ where: { keyword: { contains: tag } } })).toBe(0);

    const commit = await as(admin).post("/api/seo/admin/keywords/import", { csv });
    expect(commit.status).toBe(200);
    const one = await prisma.seoKeyword.findUniqueOrThrow({ where: { normalized: `banff csv ${tag} one` }, include: { cluster: true } });
    expect(one).toMatchObject({ searchVolume: 1200, volumeBasis: "ESTIMATE", difficulty: 30, difficultyBasis: "ESTIMATE", validationStatus: "UNVERIFIED", track: "TRAFFIC_ACQUISITION" });
    expect(one.cluster?.name).toBe(`CSV ${tag}`);
    const four = await prisma.seoKeyword.findUniqueOrThrow({ where: { normalized: `banff csv ${tag} four` } });
    expect(four).toMatchObject({ funnelStage: "BOFU", track: "BOOKING_CONVERSION", targetPath: "/shuttles" });
    expect(await prisma.seoKeyword.count({ where: { keyword: { contains: tag } } })).toBe(2);

    const exported = await as(admin).get("/api/seo/admin/keywords/export.csv");
    expect(exported.headers["content-type"]).toMatch(/text\/csv/);
    expect(exported.text).toContain(`banff csv ${tag} one`);
    expect(exported.text).toContain(`,'=cmd|' /C calc'!A0`);
  });

  it("archives and restores", async () => {
    const k = await prisma.seoKeyword.findFirstOrThrow({ where: { archivedAt: null } });
    const res = await as(admin).post(`/api/seo/admin/keywords/${k.id}/archive`, { archived: true });
    expect(res.body.keyword.status).toBe("ARCHIVED");
    const list = await as(admin).get("/api/seo/admin/keywords").query({ q: k.keyword });
    expect(list.body.keywords.find((x: { id: string }) => x.id === k.id)).toBeUndefined();
    expect((await as(admin).post(`/api/seo/admin/keywords/${k.id}/archive`, { archived: false })).body.keyword.archivedAt).toBeNull();
  });
});

describe("sitemap and llms.txt", () => {
  it("lists indexable pages only", async () => {
    const entries: { path: string; lastModified: string }[] = (await request(app).get("/api/seo/public/sitemap")).body.entries;
    const paths = entries.map((e) => e.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/destinations/moraine-lake");
    for (const p of ["/login", "/register", "/book", "/search", "/partners/dashboard", "/cancellation-policy"]) expect(paths).not.toContain(p);
    expect(entries.every((e) => !Number.isNaN(Date.parse(e.lastModified)))).toBe(true);
  });

  it("serves llms.txt only once switched on, with the saved pages", async () => {
    expect((await request(app).get("/api/seo/public/llms.txt").query({ origin: "https://www.vistachase.com" })).status).toBe(404);
    expect((await request(app).get("/api/seo/public/llms.txt").query({ origin: "javascript:alert(1)" })).status).toBe(400);
    const saved = await as(admin).put("/api/seo/admin/settings", {
      llmsEnabled: true,
      summary: "Tours and shuttles in Banff.\nSecond line",
      entries: [
        { title: "Shuttles", path: "/shuttles", description: "Moraine Lake shuttles", section: "PRIMARY" },
        { title: "FAQ", path: "/faq", section: "SECONDARY" },
      ],
    });
    expect(saved.status).toBe(200);
    expect((await as(admin).put("/api/seo/admin/settings", { entries: [{ title: "Bad", path: "javascript:alert(1)" }] })).status).toBe(400);
    const txt = await request(app).get("/api/seo/public/llms.txt").query({ origin: "https://www.vistachase.com" });
    expect(txt.status).toBe(200);
    expect(txt.text).toMatch(/^# Vista Chase\n\n> Tours and shuttles in Banff\. Second line/);
    expect(txt.text).toContain("- [Shuttles](https://www.vistachase.com/shuttles): Moraine Lake shuttles");
    expect(txt.text).toContain("## Optional\n\n- [FAQ](https://www.vistachase.com/faq)");
    expect(txt.text).toMatch(/Last updated: \d{4}-\d{2}-\d{2}/);
  });
});

describe("scheduled publishing", () => {
  it("needs a future time, and publishes when due", async () => {
    const created = await as(admin).post("/api/seo/admin/pages", { label: "Scheduled guide", slug: `scheduled-${unique()}` });
    const id = created.body.page.id;
    await as(admin).patch(`/api/seo/admin/pages/${id}`, {
      seoTitle: "Best Time to Visit Banff: Seasons, Crowds and Weather Guide",
      metaDescription: "When to visit Banff for lakes, wildlife, snow or fewer crowds, season by season, with what is open and which tours run in each month of the year ahead.",
      h1: "When to visit Banff",
      body: LONG_BODY,
    });
    expect((await as(admin).post(`/api/seo/admin/pages/${id}/status`, { action: "schedule", publishAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(400);
    expect((await as(admin).post(`/api/seo/admin/pages/${id}/status`, { action: "schedule", publishAt: new Date(Date.now() + 3_600_000).toISOString() })).status).toBe(200);
    expect((await publishDuePages(new Date())).published).toBe(0);
    await publishDuePages(new Date(Date.now() + 2 * 3_600_000));
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id } })).status).toBe("PUBLISHED");
  });
});

describe("audit", () => {
  const html = (path: string, extra = "") => `<!doctype html><html><head><title>Title for ${path} | Vista Chase tours and shuttles in Banff</title>
    ${path === "/faq" ? "" : `<meta name="description" content="Description for ${path}: small-group and private tours in Banff National Park with hotel pickup from Banff and Canmore.">`}
    <link rel="canonical" href="https://www.vistachase.com${path === "/" ? "" : path}"></head><body><h1>Heading ${path}</h1>${extra}</body></html>`;

  let brokenLinkFixed = false;
  const fakeSite = async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/missing-page") return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    const extra = path === "/" && !brokenLinkFixed ? `<a href="/missing-page">old link</a><a href="/shuttles">ok</a>` : "";
    return new Response(html(path, extra), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  };

  it("finds missing descriptions and broken links, and resolves them when fixed", async () => {
    const first = await runAudit({ trigger: "MANUAL", baseUrl: "https://www.vistachase.com", fetchImpl: fakeSite });
    expect(first.run.status).toBe("COMPLETED");
    expect((first.run.summary as { crawled: boolean }).crawled).toBe(true);
    const open = await prisma.seoIssue.findMany({ where: { status: "OPEN" } });
    expect(open.some((i) => i.type === "MISSING_DESCRIPTION" && i.path === "/faq")).toBe(true);
    const broken = open.find((i) => i.type === "BROKEN_INTERNAL_LINK");
    expect(broken?.path).toBe("/");
    expect(open.some((i) => i.type === "PAGE_UNREACHABLE")).toBe(false);
    const faq = await prisma.seoPage.findUniqueOrThrow({ where: { path: "/faq" } });
    expect((faq.lastCrawl as { h1: string[] }).h1).toEqual(["Heading /faq"]);

    // Ignore one issue; fix the link; the broken link resolves, the ignored issue stays ignored.
    const missingDesc = open.find((i) => i.type === "MISSING_DESCRIPTION" && i.path === "/faq")!;
    expect((await as(admin).patch(`/api/seo/admin/issues/${missingDesc.id}`, { status: "IGNORED" })).status).toBe(200);
    brokenLinkFixed = true;
    await runAudit({ trigger: "MANUAL", baseUrl: "https://www.vistachase.com", fetchImpl: fakeSite });
    expect((await prisma.seoIssue.findUniqueOrThrow({ where: { id: broken!.id } })).status).toBe("RESOLVED");
    expect((await prisma.seoIssue.findUniqueOrThrow({ where: { id: missingDesc.id } })).status).toBe("IGNORED");
  });

  it("doesn't resolve page checks when the site can't be reached", async () => {
    const before = await prisma.seoIssue.count({ where: { status: "OPEN", type: "MISSING_H1" } });
    await prisma.seoIssue.create({ data: { fingerprint: `MISSING_H1|/x-${unique()}|`, type: "MISSING_H1", severity: "MEDIUM", message: "test", path: "/x" } });
    const run = await runAudit({ trigger: "MANUAL", baseUrl: "http://127.0.0.1:9", fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
    expect((run.run.summary as { crawled: boolean; crawlNote: string }).crawlNote).toMatch(/couldn't be reached/);
    expect(await prisma.seoIssue.count({ where: { status: "OPEN", type: "MISSING_H1" } })).toBe(before + 1);
  });

  it("shows the overview with local figures only", async () => {
    const res = await as(admin).get("/api/seo/admin/overview");
    expect(res.status).toBe(200);
    const o = res.body.overview;
    expect(o.pages.total).toBeGreaterThan(20);
    expect(o.keywords.total).toBeGreaterThan(30);
    expect(o.integrations.every((i: { connected: boolean }) => i.connected === false)).toBe(true);
    expect(o.dataNote).toMatch(/calculated from Vista Chase's own/);
    expect(Array.isArray(o.issues.fixes)).toBe(true);
  });
});
