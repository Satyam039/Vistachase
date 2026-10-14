// SEO workspace roles and content editing: what SEO_MANAGER, EDITOR and VIEWER can and can't do,
// the staff invite flow (one-time password link, never logged), tour and destination copy edits
// (no prices or booking fields, history, stale-edit protection) and the keyword-sheet additions
// (keyword IDs, research status, bulk edit, column mapping on import).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);

type U = { id: string; email: string; role: string; name: string };
const cookieFor = (u: U) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;
const as = (cookie: string) => ({
  get: (url: string) => request(app).get(url).set("Cookie", cookie),
  post: (url: string, body?: object) => request(app).post(url).set("Cookie", cookie).send(body ?? {}),
  patch: (url: string, body?: object) => request(app).patch(url).set("Cookie", cookie).send(body ?? {}),
  del: (url: string) => request(app).delete(url).set("Cookie", cookie),
});

let admin = "";
let seo = "";
let editor = "";
let viewer = "";
let seoUser: U;
let tourId = "";
let tourSlug = "";
let originalTitle = "";
let destinationId = "";
let originalDestinationName = "";
let homePageId = "";
const kw = (word: string) => `${word} ${unique()}`;

async function makeUser(role: "SEO_MANAGER" | "EDITOR" | "VIEWER") {
  return prisma.user.create({ data: { email: `${role.toLowerCase()}-${unique()}@example.com`, passwordHash: "x", name: `${role} person`, role } });
}

beforeAll(async () => {
  admin = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));
  seoUser = await makeUser("SEO_MANAGER");
  seo = cookieFor(seoUser);
  editor = cookieFor(await makeUser("EDITOR"));
  viewer = cookieFor(await makeUser("VIEWER"));
  const tour = await prisma.tour.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });
  tourId = tour.id;
  tourSlug = tour.slug;
  originalTitle = tour.title;
  const destination = await prisma.destination.findFirstOrThrow();
  destinationId = destination.id;
  originalDestinationName = destination.name;
  // A page of our own (seo-api.test.ts runs the bootstrap; running it twice at once would race).
  const guide = await as(admin).post("/api/seo/admin/pages", { label: "Roles test guide", slug: `roles-test-${unique()}` });
  expect(guide.status).toBe(201);
  homePageId = guide.body.page.id;
});

afterAll(async () => {
  await prisma.tour.update({ where: { id: tourId }, data: { title: originalTitle } });
  await prisma.destination.update({ where: { id: destinationId }, data: { name: originalDestinationName } });
});

describe("SEO manager", () => {
  it("works in the SEO workspace", async () => {
    expect((await as(seo).get("/api/seo/admin/overview")).status).toBe(200);
    const me = await as(seo).get("/api/seo/admin/me");
    expect(me.body).toMatchObject({ role: "SEO_MANAGER", seo: { read: true, manage: true }, staff: false, operations: false });
    const created = await as(seo).post("/api/seo/admin/keywords", { keyword: kw("banff day tour"), intent: "COMMERCIAL", funnelStage: "MOFU", track: "BOOKING_CONVERSION" });
    expect(created.status).toBe(201);
    expect((await as(seo).post("/api/seo/admin/redirects", { fromPath: `/old-${unique()}`, toPath: "/private-tours" })).status).toBe(201);
    expect((await as(seo).patch(`/api/seo/admin/pages/${homePageId}`, { robotsFollow: true })).status).toBe(200);
  });

  it("can't reach bookings, payments, partners, commissions, staff or the audit log", async () => {
    for (const url of [
      "/api/admin/bookings",
      "/api/admin/metrics",
      "/api/admin/flags",
      "/api/admin/departures",
      "/api/admin/staff",
      "/api/admin/audit-logs",
      "/api/affiliates/admin",
      "/api/affiliates/admin/commissions",
    ]) {
      expect([401, 403]).toContain((await as(seo).get(url)).status);
    }
    expect((await as(seo).post("/api/admin/quick-book", {})).status).toBe(403);
    expect((await as(seo).post("/api/admin/staff", { email: seoUser.email, role: "ADMIN" })).status).toBe(403);
    expect((await as(seo).patch(`/api/admin/staff/${seoUser.id}`, { role: "ADMIN" })).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: seoUser.id } })).role).toBe("SEO_MANAGER");
  });
});

describe("editor", () => {
  it("changes page words but not indexing, URLs, status, keywords or redirects", async () => {
    expect((await as(editor).patch(`/api/seo/admin/pages/${homePageId}`, { h1: "Canadian Rockies tours" })).status).toBe(200);
    const robots = await as(editor).patch(`/api/seo/admin/pages/${homePageId}`, { h1: "x", robotsIndex: false });
    expect(robots.status).toBe(403);
    expect(robots.body.error).toMatch(/robotsIndex/);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: homePageId } })).robotsIndex).toBe(true);
    expect((await as(editor).post(`/api/seo/admin/pages/${homePageId}/status`, { action: "publish" })).status).toBe(403);
    expect((await as(editor).post("/api/seo/admin/keywords", { keyword: kw("x"), intent: "INFORMATIONAL", funnelStage: "TOFU", track: "TRAFFIC_ACQUISITION" })).status).toBe(403);
    expect((await as(editor).post("/api/seo/admin/redirects", { fromPath: "/a-b", toPath: "/" })).status).toBe(403);
    expect((await as(editor).post("/api/seo/admin/pages", { label: "Lake Louise in winter", slug: `lake-louise-winter-${unique()}` })).status).toBe(201);
  });
});

describe("viewer", () => {
  it("reads the workspace and content but changes nothing", async () => {
    expect((await as(viewer).get("/api/seo/admin/keywords")).status).toBe(200);
    expect((await as(viewer).get("/api/seo/admin/keywords/export.csv")).status).toBe(200);
    expect((await as(viewer).get("/api/content")).status).toBe(200);
    expect((await as(viewer).patch(`/api/seo/admin/pages/${homePageId}`, { h1: "x" })).status).toBe(403);
    expect((await as(viewer).post("/api/seo/admin/audits")).status).toBe(403);
    expect((await as(viewer).patch(`/api/content/tours/${tourId}`, { fields: { title: "x" } })).status).toBe(403);
  });

  it("signed-out and customers get nothing", async () => {
    const customer = cookieFor(await prisma.user.create({ data: { email: `c-${unique()}@example.com`, passwordHash: "x", name: "C", role: "CUSTOMER" } }));
    expect((await request(app).get("/api/content")).status).toBe(401);
    expect((await as(customer).get("/api/content")).status).toBe(403);
    expect((await as(customer).get("/api/seo/admin/overview")).status).toBe(403);
  });
});

describe("staff invites", () => {
  it("creates an SEO account with a one-time link; the person chooses their own password", async () => {
    const email = `seo-${unique()}@example.com`;
    const res = await as(admin).post("/api/admin/staff", { email, name: "Sam Search", role: "SEO_MANAGER" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ invited: true, user: { email, role: "SEO_MANAGER" } });
    const token = /token=([a-f0-9]{64})$/.exec(res.body.setupLink)?.[1];
    expect(token).toBeTruthy();

    // Nothing about the token reaches the audit log; only its hash is stored.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.resetToken).not.toBe(token);
    const logs = await prisma.auditLog.findMany({ where: { entityId: user.id } });
    expect(JSON.stringify(logs)).not.toContain(token!);

    const list = await as(admin).get("/api/admin/staff");
    expect(list.body.staff.find((s: { email: string }) => s.email === email)).toMatchObject({ role: "SEO_MANAGER", pendingInvite: true });

    // Can't sign in before choosing a password.
    const early = await request(app).post("/api/auth/login").set("X-Forwarded-For", "10.9.0.1").send({ email, password: "anything-at-all" });
    expect(early.status).toBe(401);

    expect((await request(app).post("/api/auth/reset-password").set("X-Forwarded-For", "10.9.0.2").send({ token, newPassword: "a-long-pass-phrase-2026" })).status).toBe(200);
    const login = await request(app).post("/api/auth/login").set("X-Forwarded-For", "10.9.0.3").send({ email, password: "a-long-pass-phrase-2026" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("SEO_MANAGER");
    // The link works once.
    expect((await request(app).post("/api/auth/reset-password").set("X-Forwarded-For", "10.9.0.4").send({ token, newPassword: "another-pass-phrase-1" })).status).toBe(400);

    const after = await as(admin).get("/api/admin/staff");
    expect(after.body.staff.find((s: { email: string }) => s.email === email).pendingInvite).toBe(false);
  });

  it("refuses unknown roles and needs a name for a new account", async () => {
    expect((await as(admin).post("/api/admin/staff", { email: `x-${unique()}@example.com`, role: "SEO_MANAGER" })).status).toBe(404);
    expect((await as(admin).post("/api/admin/staff", { email: `x-${unique()}@example.com`, name: "X Y", role: "SUPERUSER" })).status).toBe(400);
    expect((await as(admin).post("/api/admin/staff", { email: `x-${unique()}@example.com`, name: "X Y", role: "EDITOR", passwordHash: "x" })).status).toBe(400);
  });

  it("issues a fresh link for an existing staff member", async () => {
    const res = await as(admin).post(`/api/admin/staff/${seoUser.id}/setup-link`);
    expect(res.status).toBe(200);
    expect(res.body.setupLink).toMatch(/\/reset-password\?token=[a-f0-9]{64}$/);
  });
});

describe("tour and destination content", () => {
  it("saves copy, shows it on the public API and keeps a history", async () => {
    const before = await as(editor).get(`/api/content/tours/${tourId}`);
    expect(before.status).toBe(200);
    const res = await as(editor).patch(`/api/content/tours/${tourId}`, {
      fields: { title: `${originalTitle} (edited)`, highlights: ["Moraine Lake", "Lake Louise"] },
      expectedUpdatedAt: before.body.tour.updatedAt,
    });
    expect(res.status).toBe(200);
    expect(res.body.changed.sort()).toEqual(["highlights", "title"]);
    expect(res.body.history[0]).toMatchObject({ action: "CONTENT_TOUR_UPDATED" });
    expect(res.body.history[0].details.changes.title).toEqual({ from: originalTitle, to: `${originalTitle} (edited)` });
    const pub = await request(app).get(`/api/tours/${tourSlug}`);
    expect(pub.body.tour.title).toBe(`${originalTitle} (edited)`);

    // Saving from the old copy is refused instead of silently overwriting.
    const stale = await as(editor).patch(`/api/content/tours/${tourId}`, { fields: { title: "Old copy" }, expectedUpdatedAt: before.body.tour.updatedAt });
    expect(stale.status).toBe(409);
  });

  it("refuses prices, booking fields, slugs and unsafe images", async () => {
    const tour = await prisma.tour.findUniqueOrThrow({ where: { id: tourId } });
    for (const fields of [{ basePrice: 1 }, { bookingMode: "ENQUIRY" }, { slug: "new-slug" }, { maxGroupSize: 99 }, { category: "PRIVATE" }]) {
      expect((await as(admin).patch(`/api/content/tours/${tourId}`, { fields })).status).toBe(400);
    }
    expect((await as(admin).patch(`/api/content/tours/${tourId}`, { fields: { featuredImage: "javascript:alert(1)" } })).status).toBe(400);
    expect((await as(admin).patch(`/api/content/tours/${tourId}`, { fields: { galleryImages: ["http://evil.example/x.jpg"] } })).status).toBe(400);
    expect((await as(admin).patch(`/api/content/tours/${tourId}`, { fields: { crossSells: ["no-such-tour"] } })).status).toBe(400);
    const after = await prisma.tour.findUniqueOrThrow({ where: { id: tourId } });
    expect({ price: after.basePrice, mode: after.bookingMode, slug: after.slug, max: after.maxGroupSize }).toEqual({ price: tour.basePrice, mode: tour.bookingMode, slug: tour.slug, max: tour.maxGroupSize });
  });

  it("edits a destination", async () => {
    const res = await as(seo).patch(`/api/content/destinations/${destinationId}`, { fields: { name: `${originalDestinationName} edited` } });
    expect(res.status).toBe(200);
    expect(res.body.destination.name).toBe(`${originalDestinationName} edited`);
    expect(res.body.history).toHaveLength(1);
  });
});

describe("keyword sheet", () => {
  it("stores the research fields and gives each keyword an ID", async () => {
    const res = await as(seo).post("/api/seo/admin/keywords", {
      keyword: kw("moraine lake sunrise tour"),
      intent: "TRANSACTIONAL",
      funnelStage: "BOFU",
      track: "BOOKING_CONVERSION",
      parentTopic: "Moraine Lake",
      market: "ca",
      language: "en",
      bookingIntent: 5,
      competitorEvidence: "Seen ranking in a manual search, 2026-10-14",
      contentGap: "No sunrise-specific copy",
      recommendedAction: "Add a sunrise section to the shuttle page",
    });
    expect(res.status).toBe(201);
    expect(res.body.keyword).toMatchObject({ market: "CA", bookingIntent: 5, researchStatus: "UNVERIFIED", parentTopic: "Moraine Lake" });
    expect(res.body.keyword.code).toMatch(/^KW-\d{4,}$/);
    const found = await as(viewer).get(`/api/seo/admin/keywords?q=${res.body.keyword.code}`);
    expect(found.body.keywords.map((k: { id: string }) => k.id)).toEqual([res.body.keyword.id]);

    expect((await as(seo).post("/api/seo/admin/keywords", { keyword: kw("x y"), intent: "COMMERCIAL", funnelStage: "MOFU", track: "BOOKING_CONVERSION", market: "Canada" })).status).toBe(400);

    // Mapping moves a keyword to "mapped".
    const mapped = await as(seo).post(`/api/seo/admin/keywords/${res.body.keyword.id}/mappings`, { pageId: homePageId, role: "SECONDARY" });
    expect(mapped.body.keyword.researchStatus).toBe("MAPPED");
  });

  it("bulk-edits selected keywords and audits each one", async () => {
    const ids: string[] = [];
    for (const word of ["lake louise shuttle", "banff tour"]) {
      ids.push((await as(seo).post("/api/seo/admin/keywords", { keyword: kw(word), intent: "COMMERCIAL", funnelStage: "MOFU", track: "BOOKING_CONVERSION" })).body.keyword.id);
    }
    const res = await as(seo).post("/api/seo/admin/keywords/bulk", { ids, set: { priority: "HIGH", researchStatus: "RESEARCHED", parentTopic: "Bulk test" } });
    expect(res.status).toBe(200);
    const rows = await prisma.seoKeyword.findMany({ where: { id: { in: ids } } });
    expect(rows.every((r) => r.priority === "HIGH" && r.researchStatus === "RESEARCHED" && r.parentTopic === "Bulk test")).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "SEO_KEYWORD_BULK_UPDATED", entityId: { in: ids } } })).toBe(2);
    expect((await as(seo).post("/api/seo/admin/keywords/bulk", { ids, set: { searchVolume: 999 } })).status).toBe(400);
    expect((await as(viewer).post("/api/seo/admin/keywords/bulk", { ids, set: { priority: "LOW" } })).status).toBe(403);

    const filtered = await as(seo).get("/api/seo/admin/keywords?researchStatus=RESEARCHED&sort=keyword&dir=desc&pageSize=200");
    const names = filtered.body.keywords.map((k: { keyword: string }) => k.keyword);
    expect(names).toEqual([...names].sort((a: string, b: string) => b.localeCompare(a)));
  });

  it("imports with a chosen column mapping, previewing first and keeping the source", async () => {
    const a = kw("johnston canyon tour");
    const csv = `Search phrase,Why,Monthly searches,Research status\n${a},check later,140,researched\n`;
    const preview = await as(seo).post("/api/seo/admin/keywords/import/preview", {
      csv,
      track: "BOOKING_CONVERSION",
      columnMap: { "Search phrase": "keyword", Why: "notes", "Monthly searches": "searchVolume", "Research status": "researchStatus" },
    });
    expect(preview.status).toBe(200);
    expect(preview.body.preview.counts).toMatchObject({ create: 0, error: 1 }); // intent is required
    const csv2 = `Search phrase,Kind,Monthly searches,Research status\n${a},commercial,140,researched\n`;
    const map = { "Search phrase": "keyword", Kind: "intent", "Monthly searches": "searchVolume", "Research status": "researchStatus" };
    const ok = await as(seo).post("/api/seo/admin/keywords/import/preview", { csv: csv2, columnMap: map, dataSource: "Owner's sheet, Oct 2026" });
    expect(ok.status).toBe(200);
    expect(ok.body.preview.counts.create).toBe(1);
    expect(ok.body.preview.columns).toContainEqual({ header: "Kind", field: "intent" });
    expect(await prisma.seoKeyword.count({ where: { keyword: a } })).toBe(0);

    const saved = await as(seo).post("/api/seo/admin/keywords/import", { csv: csv2, columnMap: map, dataSource: "Owner's sheet, Oct 2026" });
    expect(saved.status).toBe(200);
    const k = await prisma.seoKeyword.findFirstOrThrow({ where: { keyword: a } });
    // The figure has no stated basis, so it stays an unverified estimate.
    expect(k).toMatchObject({ searchVolume: 140, volumeBasis: "ESTIMATE", researchStatus: "RESEARCHED", validationStatus: "UNVERIFIED", dataSource: "Owner's sheet, Oct 2026" });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "SEO_KEYWORDS_IMPORTED" }, orderBy: { createdAt: "desc" } });
    expect(log.details).toMatchObject({ dataSource: "Owner's sheet, Oct 2026", create: 1 });

    expect((await as(seo).post("/api/seo/admin/keywords/import/preview", { csv: csv2, columnMap: { Kind: "passwordHash" } })).status).toBe(400);
    expect((await as(seo).post("/api/seo/admin/keywords/import/preview", { csv: csv2, columnMap: { "Search phrase": "keyword", Kind: "keyword" } })).status).toBe(400); // two keyword columns
  });

  it("exports the new columns with keyword IDs", async () => {
    const res = await as(viewer).get("/api/seo/admin/keywords/export.csv");
    const header = res.text.split("\n")[0];
    for (const col of ["keywordId", "parentTopic", "market", "language", "bookingIntent", "competitorEvidence", "researchStatus", "contentGap", "recommendedAction"]) {
      expect(header).toContain(col);
    }
    expect(res.text).toMatch(/\nKW-\d{4}/);
  });
});
