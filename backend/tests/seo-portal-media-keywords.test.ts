// SEO portal additions: image uploads and the image library (featured and Open Graph images),
// keywords by page (several per page, typed keywords join the keyword sheet), the per-page social
// image, and changing a blog post's address.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Uploads go to a temporary media folder, never backend/media.
const tmp = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-media-"));
  process.env.MEDIA_DIR = dir;
  return dir;
});

import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";

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

async function makeUser(role: "SEO_MANAGER" | "EDITOR" | "VIEWER" | "CUSTOMER") {
  return prisma.user.create({ data: { email: `media-${role.toLowerCase()}-${unique()}@example.com`, passwordHash: "x", name: `${role} media`, role } });
}

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: { r: 58, g: 156, b: 166 } } }).png().toBuffer();
const dataUrl = (b: Buffer, type = "image/png") => `data:${type};base64,${b.toString("base64")}`;

beforeAll(async () => {
  admin = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));
  seo = cookieFor(await makeUser("SEO_MANAGER"));
  editor = cookieFor(await makeUser("EDITOR"));
  viewer = cookieFor(await makeUser("VIEWER"));
  customer = cookieFor(await makeUser("CUSTOMER"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("image uploads", () => {
  it("lets editors and SEO managers upload, not viewers or customers", async () => {
    const body = { data: dataUrl(await png(400, 300)), fileName: "x.png" };
    expect((await request(app).post(`${P}/media`).send(body)).status).toBe(401);
    expect((await as(customer).post(`${P}/media`, body)).status).toBe(403);
    expect((await as(viewer).post(`${P}/media`, body)).status).toBe(403);
  });

  it("re-encodes an upload as WebP under /media/uploads/seo, serves it and lists it", async () => {
    const res = await as(editor).post(`${P}/media`, { data: dataUrl(await png(3000, 1600)), fileName: "Moraine Lake Sunrise.PNG", alt: "Moraine Lake at sunrise" });
    expect(res.status).toBe(201);
    const { src, width, height } = res.body.image;
    expect(src).toMatch(/^\/media\/uploads\/seo\/\d{4}-\d{2}\/moraine-lake-sunrise-[0-9a-f]{8}\.webp$/);
    expect(width).toBe(2400); // resized down, aspect kept
    expect(height).toBe(1280);
    const file = path.join(tmp, src.slice("/media/".length));
    expect((await sharp(file).metadata()).format).toBe("webp");

    const served = await request(app).get(src);
    expect(served.status).toBe(200);

    const lib = await as(viewer).get(`${P}/media?q=moraine`);
    expect(lib.status).toBe(200);
    expect(lib.body.images.some((i: { src: string; alt: string }) => i.src === src && i.alt === "Moraine Lake at sunrise")).toBe(true);
  });

  it("refuses files that aren't images, SVGs and tiny images", async () => {
    const text = await as(seo).post(`${P}/media`, { data: dataUrl(Buffer.from("<?php echo 1; ?>"), "image/png"), fileName: "shell.png" });
    expect(text.status).toBe(400);
    const svg = await as(seo).post(`${P}/media`, { data: dataUrl(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><script>alert(1)</script></svg>'), "image/svg+xml"), fileName: "x.svg" });
    expect(svg.status).toBe(400);
    const tiny = await as(seo).post(`${P}/media`, { data: dataUrl(await png(50, 50)), fileName: "tiny.png" });
    expect(tiny.status).toBe(400);
  });
});

describe("keywords by page", () => {
  let pageId = "";

  beforeAll(async () => {
    const post = await as(seo).post(`${P}/blog`, { label: "Keywords test post", slug: `keywords-test-${unique()}` });
    expect(post.status).toBe(201);
    pageId = post.body.page.id;
  });

  it("adds several typed keywords to one page, creating new ones in the keyword sheet", async () => {
    const words = [`banff winter tours ${unique()}`, `lake louise in winter ${unique()}`, `johnston canyon ice walk ${unique()}`, `banff snow ${unique()}`, `canmore winter ${unique()}`];
    for (const [i, keyword] of words.entries()) {
      const res = await as(seo).post(`${P}/pages/${pageId}/keywords`, { keyword, role: i === 0 ? "PRIMARY" : "SECONDARY" });
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(true);
    }
    const created = await prisma.seoKeyword.findFirstOrThrow({ where: { keyword: words[0] } });
    expect(created).toMatchObject({ intent: "INFORMATIONAL", track: "TRAFFIC_ACQUISITION", volumeBasis: "UNKNOWN", searchVolume: null });

    // The same keyword typed again (different case) is the same keyword, not a duplicate.
    const again = await as(seo).post(`${P}/pages/${pageId}/keywords`, { keyword: words[1].toUpperCase(), role: "SECONDARY" });
    expect(again.status).toBe(201);
    expect(again.body.created).toBe(false);

    const list = await as(viewer).get(`${P}/page-keywords?group=blog`);
    const row = list.body.pages.find((p: { id: string }) => p.id === pageId);
    expect(row.keywords).toHaveLength(5);
    expect(row.keywords[0]).toMatchObject({ keyword: words[0], role: "PRIMARY" });
  });

  it("changes a keyword's role and removes it from the page", async () => {
    const list = await as(seo).get(`${P}/page-keywords?group=blog`);
    const row = list.body.pages.find((p: { id: string }) => p.id === pageId);
    const second = row.keywords[1];
    expect((await as(seo).patch(`${P}/pages/${pageId}/keywords/${second.mappingId}`, { role: "PRIMARY" })).status).toBe(200);
    expect((await prisma.seoKeywordMapping.findUniqueOrThrow({ where: { id: second.mappingId } })).role).toBe("PRIMARY");
    expect((await as(seo).del(`${P}/pages/${pageId}/keywords/${second.mappingId}`)).status).toBe(200);
    expect(await prisma.seoKeywordMapping.findUnique({ where: { id: second.mappingId } })).toBeNull();
    // The keyword itself stays in the sheet.
    expect(await prisma.seoKeyword.findUnique({ where: { id: second.id } })).not.toBeNull();
  });

  it("only SEO managers and admins change page keywords", async () => {
    expect((await as(editor).post(`${P}/pages/${pageId}/keywords`, { keyword: "nope keyword", role: "SECONDARY" })).status).toBe(403);
    expect((await as(viewer).post(`${P}/pages/${pageId}/keywords`, { keyword: "nope keyword", role: "SECONDARY" })).status).toBe(403);
    const other = await as(seo).post(`${P}/blog`, { label: "Other post", slug: `other-${unique()}` });
    const list = await as(seo).get(`${P}/page-keywords?group=blog`);
    const mapping = list.body.pages.find((p: { id: string }) => p.id === pageId).keywords[0];
    // A mapping can only be changed through the page it belongs to.
    expect((await as(seo).del(`${P}/pages/${other.body.page.id}/keywords/${mapping.mappingId}`)).status).toBe(404);
  });
});

describe("social (Open Graph) image", () => {
  it("sets a page's OG image and publishes the page row when asked", async () => {
    const page = await prisma.seoPage.create({ data: { path: `/og-test-${unique()}`, label: "OG test", pageType: "LANDING", source: "STATIC_ROUTE", status: "DRAFT" } });
    expect((await as(editor).put(`${P}/pages/${page.id}/social-image`, { ogImage: "/media/site/x.webp" })).status).toBe(403);
    expect((await as(seo).put(`${P}/pages/${page.id}/social-image`, { ogImage: "javascript:alert(1)" })).status).toBe(400);
    const saved = await as(seo).put(`${P}/pages/${page.id}/social-image`, { ogImage: "/media/site/og-home.webp" });
    expect(saved.status).toBe(200);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: page.id } })).status).toBe("DRAFT");
    const published = await as(admin).put(`${P}/pages/${page.id}/social-image`, { ogImage: "/media/site/og-home.webp", publish: true });
    expect(published.status).toBe(200);
    const row = await prisma.seoPage.findUniqueOrThrow({ where: { id: page.id } });
    expect(row).toMatchObject({ ogImage: "/media/site/og-home.webp", status: "PUBLISHED" });
    const cleared = await as(seo).put(`${P}/pages/${page.id}/social-image`, { ogImage: null });
    expect(cleared.status).toBe(200);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: page.id } })).ogImage).toBeNull();
  });
});

describe("blog post address", () => {
  it("changing a published post's slug moves it and redirects the old address", async () => {
    const slug = `address-test-${unique()}`;
    const created = await as(seo).post(`${P}/blog`, { label: "Address test", slug });
    const id = created.body.page.id;
    const body = Array.from({ length: 160 }, (_, i) => `word${i}`).join(" ");
    expect((await as(seo).patch(`/api/seo/admin/pages/${id}`, { seoTitle: "Address test | Vista Chase", metaDescription: "A post used to test address changes in the SEO portal.", h1: "Address test", body, featuredImage: "/media/site/x.webp", featuredImageAlt: "A test image" })).status).toBe(200);
    expect((await as(seo).post(`/api/seo/admin/pages/${id}/status`, { action: "publish" })).status).toBe(200);

    // Published posts change through a draft, like any live page.
    const newSlug = `${slug}-renamed`;
    expect((await as(seo).put(`${P}/pages/${id}/draft`, { slug: newSlug })).status).toBe(200);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id } })).path).toBe(`/blog-post/${slug}`);
    expect((await as(seo).post(`${P}/pages/${id}/draft/publish`, {})).status).toBe(200);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id } })).path).toBe(`/blog-post/${newSlug}`);
    const redirect = await prisma.seoRedirect.findUnique({ where: { fromPath: `/blog-post/${slug}` } });
    expect(redirect).toMatchObject({ toPath: `/blog-post/${newSlug}`, statusCode: 301, active: true });

    const pub = await request(app).get(`/api/seo/public/blog/${newSlug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.post ?? pub.body.page ?? pub.body).toMatchObject({ featuredImage: "/media/site/x.webp" });
  });
});
