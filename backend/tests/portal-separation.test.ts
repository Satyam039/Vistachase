// Admin, SEO and partner portals stay separate at the API: every staff route is called by every
// role it isn't meant for and must be refused before it runs. The routes are read from the
// routers themselves, so a new route without a guard fails here.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Router } from "express";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken, hashPassword, type UserRole } from "@/lib/auth/auth";
import adminRoutes from "@/routes/admin.routes";
import operationsRoutes from "@/routes/operations.routes";
import seoRoutes from "@/routes/seo.routes";
import seoPortalRoutes from "@/routes/seo-portal.routes";
import contentRoutes from "@/routes/content.routes";
import affiliatesRoutes from "@/routes/affiliates.routes";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
const cookies: Partial<Record<UserRole, string>> = {};
const emails: Partial<Record<UserRole, string>> = {};
const TEST_PASSWORD = "ValidPassword123!";

type Layer = { route?: { path: string; methods: Record<string, boolean> } };
type Method = "get" | "post" | "put" | "patch" | "delete";

/** Every route a router declares, as [method, full path] with params filled in. */
function routesOf(router: Router, prefix: string, keep: (path: string) => boolean = () => true): [Method, string][] {
  const out: [Method, string][] = [];
  for (const layer of (router as unknown as { stack: Layer[] }).stack) {
    if (!layer.route || !keep(layer.route.path)) continue;
    const path = layer.route.path.replace(/:[A-Za-z]+/g, "clnotarealid0000000000");
    for (const method of Object.keys(layer.route.methods) as Method[]) out.push([method, prefix + path]);
  }
  return out;
}

const ADMIN_API = [...routesOf(adminRoutes, "/api/admin"), ...routesOf(operationsRoutes, "/api/operations")];
const PARTNER_ADMIN_API = routesOf(affiliatesRoutes, "/api/affiliates", (p) => p.startsWith("/admin"));
const SEO_API = [
  ...routesOf(seoRoutes, "/api/seo", (p) => !p.startsWith("/public")),
  ...routesOf(seoPortalRoutes, "/api/seo/portal"),
  ...routesOf(contentRoutes, "/api/content"),
];

async function call(cookie: string, [method, url]: [Method, string]) {
  return (await request(app)[method](url).set("Cookie", cookie).set("Origin", "http://localhost:3000").send({})).status;
}

async function refusedFor(role: UserRole, routes: [Method, string][]) {
  const allowed: string[] = [];
  for (const route of routes) {
    const status = await call(cookies[role]!, route);
    if (status !== 401 && status !== 403) allowed.push(`${route[0].toUpperCase()} ${route[1]} → ${status}`);
  }
  return allowed;
}

beforeAll(async () => {
  const hash = await hashPassword(TEST_PASSWORD);
  for (const role of ["ADMIN", "OPERATOR", "DISPATCHER", "SEO_MANAGER", "EDITOR", "VIEWER", "AFFILIATE", "CUSTOMER"] as UserRole[]) {
    const user = await prisma.user.create({ data: { email: `sep-${role.toLowerCase()}-${unique()}@example.com`, passwordHash: hash, name: `${role} sep`, role } });
    emails[role] = user.email;
    cookies[role] = `vc_token=${signToken({ userId: user.id, email: user.email, role, name: user.name })}`;
  }
});

describe("portal separation", () => {
  it("finds the routes it checks", () => {
    expect(ADMIN_API.length).toBeGreaterThan(30);
    expect(PARTNER_ADMIN_API.length).toBeGreaterThan(10);
    expect(SEO_API.length).toBeGreaterThan(50);
  });

  it.each(["AFFILIATE", "SEO_MANAGER", "EDITOR", "VIEWER", "CUSTOMER"] as UserRole[])("refuses %s on every admin and operations route", async (role) => {
    expect(await refusedFor(role, ADMIN_API)).toEqual([]);
  });

  it.each(["AFFILIATE", "OPERATOR", "DISPATCHER", "SEO_MANAGER", "EDITOR", "VIEWER", "CUSTOMER"] as UserRole[])("refuses %s on every partner management route", async (role) => {
    expect(await refusedFor(role, PARTNER_ADMIN_API)).toEqual([]);
  });

  it.each(["AFFILIATE", "OPERATOR", "DISPATCHER", "CUSTOMER"] as UserRole[])("refuses %s on every SEO and content route", async (role) => {
    expect(await refusedFor(role, SEO_API)).toEqual([]);
  });

  it("lets each portal's own roles in", async () => {
    expect(await call(cookies.ADMIN!, ["get", "/api/admin/metrics"])).toBe(200);
    expect(await call(cookies.DISPATCHER!, ["get", "/api/admin/metrics"])).toBe(200);
    expect(await call(cookies.SEO_MANAGER!, ["get", "/api/seo/portal/me"])).toBe(200);
    expect(await call(cookies.EDITOR!, ["get", "/api/content/me"])).toBe(200);
    expect(await call(cookies.ADMIN!, ["get", "/api/affiliates/admin"])).toBe(200);
  });

  it("tells the site which portal an account belongs to", async () => {
    const portal = async (role: UserRole) => (await request(app).get("/api/auth/me").set("Cookie", cookies[role]!)).body.user?.portal;
    expect(await portal("ADMIN")).toBe("admin");
    expect(await portal("DISPATCHER")).toBe("admin");
    expect(await portal("SEO_MANAGER")).toBe("seo");
    expect(await portal("VIEWER")).toBe("seo");
    expect(await portal("AFFILIATE")).toBe("partner");
    expect(await portal("CUSTOMER")).toBe("customer");
  });

  it("enforces portal isolation during login with expectedPortal", async () => {
    // 1. Customer attempting to log in on Admin portal
    const custOnAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: emails.CUSTOMER, password: TEST_PASSWORD, expectedPortal: "admin" });
    expect(custOnAdmin.status).toBe(403);
    expect(custOnAdmin.body.error).toContain("Access denied: this account does not have administrator");

    // 2. Affiliate attempting to log in on Admin portal
    const affOnAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: emails.AFFILIATE, password: TEST_PASSWORD, expectedPortal: "admin" });
    expect(affOnAdmin.status).toBe(403);
    expect(affOnAdmin.body.error).toContain("Access denied: this account does not have administrator");

    // 3. Customer attempting to log in on Affiliate portal
    const custOnAff = await request(app)
      .post("/api/auth/login")
      .send({ email: emails.CUSTOMER, password: TEST_PASSWORD, expectedPortal: "affiliate" });
    expect(custOnAff.status).toBe(403);
    expect(custOnAff.body.error).toContain("Access denied: this account is not registered as an affiliate");

    // 4. Admin logging into Admin portal succeeds
    const adminOnAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: emails.ADMIN, password: TEST_PASSWORD, expectedPortal: "admin" });
    expect(adminOnAdmin.status).toBe(200);
    expect(adminOnAdmin.body.success).toBe(true);
    expect(adminOnAdmin.body.user.portal).toBe("admin");

    // 5. Affiliate logging into Affiliate portal succeeds
    const affOnAff = await request(app)
      .post("/api/auth/login")
      .send({ email: emails.AFFILIATE, password: TEST_PASSWORD, expectedPortal: "affiliate" });
    expect(affOnAff.status).toBe(200);
    expect(affOnAff.body.success).toBe(true);
    expect(affOnAff.body.user.portal).toBe("partner");
  });
});
