// Blog bulk actions (Select mode) and AI Generate. The AI tests use a fake Anthropic client, so no
// request leaves the machine.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { setAiClientForTests } from "@/modules/seo/portal/ai-generate";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
const P = "/api/seo/portal";

type U = { id: string; email: string; role: string; name: string };
const cookieFor = (u: U) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;
const post = (cookie: string, url: string, body: object) => request(app).post(url).set("Cookie", cookie).send(body);

let seo = "";
let editor = "";
const tag = unique();
const ids: Record<string, string> = {};
const longBody = `## Why go\n\n${"Lake Louise and Moraine Lake are the classic Banff day out with a local guide. ".repeat(20)}`;

beforeAll(async () => {
  seo = cookieFor(await prisma.user.create({ data: { email: `bulk-seo-${tag}@example.com`, passwordHash: "x", name: "Bulk SEO", role: "SEO_MANAGER" } }));
  editor = cookieFor(await prisma.user.create({ data: { email: `bulk-editor-${tag}@example.com`, passwordHash: "x", name: "Bulk editor", role: "EDITOR" } }));
  const base = { pageType: "GUIDE" as const, source: "CMS" as const, seoTitle: "Lake Louise day trip guide | Vista Chase", metaDescription: "How to plan a day at Lake Louise and Moraine Lake from Banff, with the best times to go, where to stop and what to pack for the trip." };
  const rows = {
    ready: { path: `/blog-post/ready-${tag}`, label: `Ready ${tag}`, h1: "Lake Louise day trip", body: longBody, status: "DRAFT" as const },
    empty: { path: `/blog-post/empty-${tag}`, label: `Empty ${tag}`, h1: null, body: null, seoTitle: null, metaDescription: null, status: "DRAFT" as const },
    live: { path: `/blog-post/live-${tag}`, label: `Live ${tag}`, h1: "Live post", body: longBody, status: "PUBLISHED" as const, publishedAt: new Date() },
  };
  for (const [key, data] of Object.entries(rows)) ids[key] = (await prisma.seoPage.create({ data: { ...base, ...data } })).id;
  ids.static = (await prisma.seoPage.create({ data: { path: `/bulk-static-${tag}`, label: "Static", pageType: "STATIC", source: "STATIC_ROUTE", status: "PUBLISHED", publishedAt: new Date() } })).id;
});

describe("blog bulk actions", () => {
  it("are for SEO managers only", async () => {
    expect((await post(editor, `${P}/blog/bulk`, { ids: [ids.ready], action: "feature" })).status).toBe(403);
    expect((await post(seo, `${P}/blog/bulk`, { ids: [ids.ready], action: "delete" })).status).toBe(400);
    expect((await post(seo, `${P}/blog/bulk`, { ids: [], action: "feature" })).status).toBe(400);
  });

  it("publishes what passes its checks and reports the rest", async () => {
    const res = await post(seo, `${P}/blog/bulk`, { ids: [ids.ready, ids.empty, ids.live, ids.static], action: "publish" });
    expect(res.status).toBe(200);
    const by = Object.fromEntries(res.body.results.map((r: { id: string }) => [r.id, r]));
    expect(by[ids.ready]).toMatchObject({ ok: true });
    expect(by[ids.live]).toMatchObject({ ok: true, skipped: true });
    expect(by[ids.empty].ok).toBe(false);
    expect(by[ids.empty].error).toMatch(/Fix these/);
    expect(by[ids.static]).toMatchObject({ ok: false, error: "Not a blog post." });
    expect(res.body).toMatchObject({ done: 1, skipped: 1, failed: 2 });
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.ready } })).status).toBe("PUBLISHED");
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.empty } })).status).toBe("DRAFT");
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.static } })).status).toBe("PUBLISHED");
    expect(await prisma.auditLog.count({ where: { action: "SEO_PAGE_PUBLISH", entityId: ids.ready } })).toBe(1);
  });

  it("features, unfeatures and archives", async () => {
    await post(seo, `${P}/blog/bulk`, { ids: [ids.ready, ids.live], action: "feature" });
    expect((await prisma.seoPage.findMany({ where: { id: { in: [ids.ready, ids.live] } } })).every((p) => p.featured)).toBe(true);
    await post(seo, `${P}/blog/bulk`, { ids: [ids.live], action: "unfeature" });
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.live } })).featured).toBe(false);
    const archived = await post(seo, `${P}/blog/bulk`, { ids: [ids.live], action: "archive" });
    expect(archived.body.done).toBe(1);
    expect((await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.live } })).status).toBe("ARCHIVED");
  });
});

describe("AI generate", () => {
  const key = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    setAiClientForTests(null);
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  });

  const fake = (reply: object) => {
    const calls: Record<string, unknown>[] = [];
    setAiClientForTests({ beta: { messages: { create: async (params: Record<string, unknown>) => (calls.push(params), reply) } } } as never);
    return calls;
  };

  it("says when it isn't set up", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await request(app).get(`${P}/ai/status`).set("Cookie", seo)).body.configured).toBe(false);
    const res = await post(seo, `${P}/ai/generate`, { pageId: ids.ready, field: "seoTitle" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("is for SEO managers only", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect((await post(editor, `${P}/ai/generate`, { pageId: ids.ready, field: "seoTitle" })).status).toBe(403);
    expect((await post(seo, `${P}/ai/generate`, { pageId: ids.ready, field: "body" })).status).toBe(400);
  });

  it("returns suggestions from the page's content without saving them", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const calls = fake({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ suggestions: ["Lake Louise Day Trip from Banff | Vista Chase", "\"Lake Louise Day Trip from Banff | Vista Chase\"", "A Lake Louise and Moraine Lake day trip guide for first-timers | Vista Chase"] }) }],
    });
    const before = await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.ready } });
    const res = await post(seo, `${P}/ai/generate`, { pageId: ids.ready, field: "seoTitle", draft: { focusKeyword: "lake louise day trip" } });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([
      { text: "Lake Louise Day Trip from Banff | Vista Chase", length: 45, fits: true },
      { text: "A Lake Louise and Moraine Lake day trip guide for first-timers | Vista Chase", length: 76, fits: false },
    ]);
    const params = calls[0];
    expect(params).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect(JSON.stringify(params.messages)).toContain("Focus keyword: lake louise day trip");
    expect(JSON.stringify(params.messages)).toContain("Lake Louise and Moraine Lake are the classic");
    const after = await prisma.seoPage.findUniqueOrThrow({ where: { id: ids.ready } });
    expect(after.seoTitle).toBe(before.seoTitle);
  });

  it("handles a refusal", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fake({ model: "claude-opus-5-5", stop_reason: "refusal", content: [] });
    const res = await post(seo, `${P}/ai/generate`, { pageId: ids.ready, field: "metaDescription" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/declined/);
  });
});
