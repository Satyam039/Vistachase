// Admin → Security (owner, 2026-11-15): every public form records the sender's IP, admins see it
// and can block an IP or email, a blocked sender can't send forms (staff sign-in still works), and
// a visitor can't fake their IP with X-Forwarded-For.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Request } from "express";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { issueFormToken } from "@/modules/enquiries/spam";
import { clientIp, forgetBlocklist, isPrivateAddress } from "@/modules/security/visitor-log";

const app = createApp();
let adminCookie = "";
let dispatcherCookie = "";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const publicIp = () => `203.0.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
const settle = () => new Promise((r) => setTimeout(r, 150));

const enquiry = (ip: string, email: string, extra: Record<string, unknown> = {}) =>
  request(app)
    .post("/api/enquiries")
    .set("X-Forwarded-For", ip)
    .send({ name: "Priya Sharma", email, message: "Do you have seats on the Lake Louise tour next week?", formToken: issueFormToken(Date.now() - 5_000), ...extra });

beforeAll(async () => {
  const cookieFor = (u: { id: string; email: string; role: string; name: string | null }) =>
    `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name ?? "" })}`;
  adminCookie = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));
  dispatcherCookie = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "DISPATCHER" } }));
});

describe("client IP", () => {
  const fake = (remote: string, xff?: string) => ({ socket: { remoteAddress: remote }, headers: xff ? { "x-forwarded-for": xff } : {}, ip: remote }) as unknown as Request;

  it("takes the address our proxy added, not one the visitor wrote", () => {
    expect(clientIp(fake("127.0.0.1", "1.2.3.4, 198.51.100.7"))).toBe("198.51.100.7");
    expect(clientIp(fake("::ffff:127.0.0.1", "198.51.100.7, 127.0.0.1"))).toBe("198.51.100.7");
  });

  it("ignores the header when the request didn't come through a local proxy", () => {
    expect(clientIp(fake("198.51.100.9", "1.2.3.4"))).toBe("198.51.100.9");
  });

  it("knows private ranges exactly", () => {
    expect(isPrivateAddress("172.20.1.1")).toBe(true);
    expect(isPrivateAddress("172.217.3.4")).toBe(false);
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("fd00::1")).toBe(true);
  });
});

describe("security log and blocklist", () => {
  it("records accepted and spam enquiries with the sender's IP", async () => {
    const ip = publicIp();
    const email = `guest.${unique()}@example.com`;
    expect((await enquiry(ip, email)).status).toBe(201);
    expect((await enquiry(ip, `bot.${unique()}@example.com`, { website: "http://spam.example" })).status).toBe(201);
    await settle();
    const rows = await prisma.securityEvent.findMany({ where: { ip }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.form, r.outcome])).toEqual([
      ["ENQUIRY", "ACCEPTED"],
      ["ENQUIRY", "SPAM"],
    ]);
    expect(rows[0].email).toBe(email);
    expect(rows[1].reason).toBe("honeypot filled");
  });

  it("is admins only", async () => {
    expect((await request(app).get("/api/admin/security/events")).status).toBe(403);
    expect((await request(app).get("/api/admin/security/events").set("Cookie", dispatcherCookie)).status).toBe(403);
    expect((await request(app).post("/api/admin/security/blocked").set("Cookie", dispatcherCookie).send({ kind: "IP", value: "198.51.100.1" })).status).toBe(403);
    const res = await request(app).get("/api/admin/security/events?outcome=FLAGGED").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it("blocks an IP: its forms are refused, staff sign-in isn't, unblocking lets it back", async () => {
    const ip = publicIp();
    const block = await request(app).post("/api/admin/security/blocked").set("Cookie", adminCookie).send({ kind: "IP", value: ip, reason: "spam" });
    expect(block.status).toBe(201);
    expect(await prisma.auditLog.findFirst({ where: { action: "SENDER_BLOCKED", entityId: block.body.blocked.id } })).not.toBeNull();

    const email = `blocked.${unique()}@example.com`;
    expect((await enquiry(ip, email)).status).toBe(403);
    expect(await prisma.enquiry.findFirst({ where: { email } })).toBeNull();
    // Writing a different address in the header doesn't get around it: ours is the right-most.
    expect((await enquiry(`8.8.8.8, ${ip}`, email)).status).toBe(403);
    const login = await request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email: "nobody@example.com", password: "wrong-password" });
    expect(login.status).not.toBe(403);

    const events = await request(app).get(`/api/admin/security/events?q=${ip}`).set("Cookie", adminCookie);
    expect(events.body.events.some((e: { outcome: string; ipBlockId: string | null }) => e.outcome === "BLOCKED" && e.ipBlockId)).toBe(true);

    const unblock = await request(app).delete(`/api/admin/security/blocked/${block.body.blocked.id}`).set("Cookie", adminCookie);
    expect(unblock.status).toBe(200);
    expect((await enquiry(ip, email)).status).toBe(201);
  });

  it("blocks an email address", async () => {
    const email = `spammer.${unique()}@example.com`;
    expect((await request(app).post("/api/admin/security/blocked").set("Cookie", adminCookie).send({ kind: "EMAIL", value: email.toUpperCase() })).status).toBe(201);
    expect((await enquiry(publicIp(), email)).status).toBe(403);
    await prisma.blockedSender.deleteMany({ where: { value: email } });
    forgetBlocklist();
  });

  it("refuses blocks that could lock everyone out", async () => {
    const post = (value: string, kind = "IP", ip = "198.51.100.200") =>
      request(app).post("/api/admin/security/blocked").set("Cookie", adminCookie).set("X-Forwarded-For", ip).send({ kind, value });
    expect((await post("127.0.0.1")).status).toBe(400);
    expect((await post("10.0.0.5")).status).toBe(400);
    expect((await post("not-an-ip")).status).toBe(400);
    expect((await post("198.51.100.200")).status).toBe(400); // the admin's own address
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    expect((await post(admin.email, "EMAIL")).status).toBe(400);
  });
});
