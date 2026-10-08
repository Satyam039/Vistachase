// Admin API over HTTP: staff-only access with the site's session cookie, named-field edits only,
// no password hashes, signed QR check-in, and the dashboard routes the admin pages call.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { signBookingLink } from "@/lib/security/signed-links";

const app = createApp();
let adminCookie = "";
let dispatcherCookie = "";
let customerCookie = "";
let bookingId = "";
let reference = "";

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const dispatcher = await prisma.user.findFirstOrThrow({ where: { role: "DISPATCHER" } });
  const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
  const cookie = (u: typeof admin) => `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role, name: u.name })}`;
  adminCookie = cookie(admin);
  dispatcherCookie = cookie(dispatcher);
  customerCookie = cookie(customer);
  const booking = await prisma.booking.findFirstOrThrow({ where: { status: "CONFIRMED" } });
  bookingId = booking.id;
  reference = booking.bookingReference;
});

describe("admin API", () => {
  it("refuses anonymous callers and customers", async () => {
    expect((await request(app).get("/api/admin/metrics")).status).toBe(403);
    expect((await request(app).get("/api/admin/metrics").set("Cookie", customerCookie)).status).toBe(403);
  });

  it("serves the dashboard and dispatch board to staff with the session cookie", async () => {
    const metrics = await request(app).get("/api/admin/metrics").set("Cookie", dispatcherCookie);
    expect(metrics.status).toBe(200);
    expect(metrics.body.metrics.totalBookings).toBeGreaterThan(0);
    const dispatch = await request(app).get("/api/admin/dispatch").set("Cookie", dispatcherCookie);
    expect(dispatch.status).toBe(200);
    expect(Array.isArray(dispatch.body.manifests)).toBe(true);
  });

  it("edits only named booking fields and records who did it", async () => {
    const refused = await request(app).patch(`/api/admin/bookings/${bookingId}`).set("Cookie", adminCookie).send({ status: "REFUNDED", totalAmount: 1 });
    expect(refused.status).toBe(400);

    const ok = await request(app).patch(`/api/admin/bookings/${bookingId}`).set("Cookie", adminCookie).send({ adminNotes: "Window seat" });
    expect(ok.status).toBe(200);
    expect(ok.body.booking.adminNotes).toBe("Window seat");
    const log = await prisma.auditLog.findFirst({ where: { entityId: bookingId, action: "UPDATE_BOOKING" }, orderBy: { createdAt: "desc" } });
    expect(log?.userId).toBeTruthy();
  });

  it("lists staff without password hashes, for admins only", async () => {
    expect((await request(app).get("/api/admin/staff").set("Cookie", dispatcherCookie)).status).toBe(403);
    const res = await request(app).get("/api/admin/staff").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("checks guests in only with a validly signed voucher QR code", async () => {
    const forged = await request(app).post("/api/admin/checkin").set("Cookie", dispatcherCookie).send({ ref: reference, sig: "0".repeat(32) });
    expect(forged.status).toBe(400);
    const ok = await request(app).post("/api/admin/checkin").set("Cookie", dispatcherCookie).send({ ref: reference, sig: signBookingLink(reference, "checkin") });
    expect(ok.status).toBe(200);
    expect(ok.body.booking.isBoarded).toBe(true);
  });
});
