// Partner sign-in and application management (owner, 2026-11-18, Trello "Affiliates: partner
// sign-up & login fixes"): every application field is required, partners not yet approved get a
// clear "not approved yet" answer instead of a code, and staff can reject or delete applications.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { hashPassword, signToken } from "@/lib/auth/auth";
import { applyAffiliate } from "@/modules/affiliates/affiliate.repository";
import { issueFormToken } from "@/modules/enquiries/spam";

const app = createApp();
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const PASSWORD = "a-long-password";
let adminCookie = "";

async function partner(status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED") {
  const id = unique();
  const email = `approval-${id}@example.com`;
  const applied = await applyAffiliate({ name: `Approval Lodge ${id}`, contactName: "Sam Partner", email, password: PASSWORD, type: "HOTEL" });
  if (!applied.success) throw new Error("apply failed");
  const row = await prisma.affiliate.findUniqueOrThrow({ where: { code: applied.affiliate.code } });
  if (status !== "PENDING") await prisma.affiliate.update({ where: { id: row.id }, data: { status } });
  return { email, id: row.id };
}

const login = (email: string, password = PASSWORD) =>
  request(app).post("/api/auth/login").set("X-Forwarded-For", ip()).send({ email, password, expectedPortal: "affiliate", enforceOtp: true });

beforeAll(async () => {
  const admin = await prisma.user.create({ data: { email: `approval-admin-${unique()}@example.com`, passwordHash: await hashPassword(PASSWORD), name: "Admin", role: "ADMIN" } });
  adminCookie = `vc_token=${signToken({ userId: admin.id, email: admin.email, role: "ADMIN", name: admin.name })}`;
});

describe("partner application fields", () => {
  it("requires a website and a phone number with its country code", async () => {
    const email = `fields-${unique()}@example.com`;
    const body = { name: "Rundlestone Lodge", contactName: "Priya Sharma", email, password: PASSWORD, type: "HOTEL", formToken: issueFormToken(Date.now() - 5_000) };
    const missing = await request(app).post("/api/affiliates/apply").set("X-Forwarded-For", ip()).send(body);
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.fields)).toEqual(expect.arrayContaining(["website", "phone"]));
    const noCountry = await request(app)
      .post("/api/affiliates/apply")
      .set("X-Forwarded-For", ip())
      .send({ ...body, website: "https://rundlestone.example.com", phone: "403 555 0100" });
    expect(noCountry.status).toBe(400);
    expect(Object.keys(noCountry.body.fields)).toEqual(["phone"]);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});

describe("partner sign-in waits for approval", () => {
  it.each(["PENDING", "REJECTED", "SUSPENDED"] as const)("tells a %s partner instead of sending a code", async (status) => {
    const { email } = await partner(status);
    const res = await login(email);
    expect(res.status).toBe(403);
    expect(res.body.partnerStatus).toBe(status);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.loginOtp).toBeNull();
  });

  it("doesn't reveal the status to a wrong password", async () => {
    const { email } = await partner("PENDING");
    const res = await login(email, "not-the-password");
    expect(res.status).toBe(401);
    expect(res.body.partnerStatus).toBeUndefined();
  });

  it("emails an approved partner a code, and the code signs them in", async () => {
    const { email } = await partner("ACTIVE");
    const res = await login(email);
    expect(res.status).toBe(200);
    expect(res.body.requireOtp).toBe(true);
    // The emailed code is stored hashed; put a known one in place to finish the sign-in.
    const crypto = await import("node:crypto");
    await prisma.user.update({ where: { email }, data: { loginOtp: crypto.createHash("sha256").update("123456").digest("hex") } });
    const verified = await request(app).post("/api/auth/verify-otp").set("X-Forwarded-For", ip()).send({ email, otp: "123456", expectedPortal: "affiliate" });
    expect(verified.status).toBe(200);
    expect(String(verified.headers["set-cookie"])).toContain("vc_token=");
  });

  it("won't finish a pending partner's sign-in with a code from Resend", async () => {
    const { email } = await partner("PENDING");
    const crypto = await import("node:crypto");
    await prisma.user.update({ where: { email }, data: { loginOtp: crypto.createHash("sha256").update("654321").digest("hex"), loginOtpExpiry: new Date(Date.now() + 60_000) } });
    const res = await request(app).post("/api/auth/verify-otp").set("X-Forwarded-For", ip()).send({ email, otp: "654321", expectedPortal: "affiliate" });
    expect(res.status).toBe(403);
    expect(res.body.partnerStatus).toBe("PENDING");
  });
});

describe("staff reject and delete", () => {
  const admin = () => ({ "Cookie": adminCookie, "Origin": "http://localhost:3000" });

  it("rejects an application", async () => {
    const { id } = await partner("PENDING");
    const res = await request(app).patch(`/api/affiliates/admin/${id}`).set(admin()).send({ status: "REJECTED" });
    expect(res.status).toBe(200);
    expect((await prisma.affiliate.findUniqueOrThrow({ where: { id } })).status).toBe("REJECTED");
  });

  it("deletes an application with no history, and its sign-in account", async () => {
    const { id, email } = await partner("PENDING");
    const res = await request(app).delete(`/api/affiliates/admin/${id}`).set(admin());
    expect(res.status).toBe(200);
    expect(res.body.accountRemoved).toBe(true);
    expect(await prisma.affiliate.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { action: "PARTNER_DELETED", entityId: id } });
    expect(log).not.toBeNull();
  });

  it("refuses to delete a partner with bookings", async () => {
    const { id } = await partner("ACTIVE");
    const booking = await prisma.booking.findFirst({ where: { affiliateId: null } });
    if (!booking) return; // the seed always has bookings; guard for an empty database
    await prisma.booking.update({ where: { id: booking.id }, data: { affiliateId: id } });
    try {
      const res = await request(app).delete(`/api/affiliates/admin/${id}`).set(admin());
      expect(res.status).toBe(409);
      expect(await prisma.affiliate.findUnique({ where: { id } })).not.toBeNull();
    } finally {
      await prisma.booking.update({ where: { id: booking.id }, data: { affiliateId: null } });
    }
  });

  it("is admin-only", async () => {
    const { id } = await partner("PENDING");
    expect((await request(app).delete(`/api/affiliates/admin/${id}`).set("Origin", "http://localhost:3000")).status).toBe(403);
  });
});
