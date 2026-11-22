// Partner coupons (affiliate account → Coupons, owner 2026-11-22): a partner makes their own coupon
// codes (percent, dates, active, where it applies), guests use them at checkout, and bookings made
// with one credit that partner. Partners only see and change their own coupons.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { applyAffiliate } from "@/modules/affiliates/affiliate.repository";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
let partnerCookie = "";
let otherCookie = "";
let pendingCookie = "";
let partnerId = "";
let day = 0;

async function makePartner(status: "ACTIVE" | "PENDING") {
  const id = unique();
  const r = await applyAffiliate({ name: `Coupon Hotel ${id}`, contactName: "Casey Partner", email: `coupon-${id}@example.com`, password: "a-long-password", type: "HOTEL" });
  if (!r.success) throw new Error("apply failed");
  const aff = await prisma.affiliate.update({ where: { code: r.affiliate.code }, data: { status } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: `coupon-${id}@example.com` } });
  return { id: aff.id, cookie: `vc_token=${signToken({ userId: user.id, email: user.email, role: user.role as never, name: user.name })}` };
}

async function departure(category: "SHARED" | "SHUTTLE") {
  day += 1;
  const tour = await prisma.tour.findFirstOrThrow({ where: { category } });
  return prisma.tourDeparture.create({
    data: { tourId: tour.id, date: dateOnly(new Date(Date.UTC(2028, 6, 1 + day)).toISOString().slice(0, 10)), departureTime: timeOfDay("08:30"), capacityTotal: 20, price: 10000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

const guest = (departureId: string, promoCode?: string) => ({
  departureId,
  customerName: "Coupon Guest",
  customerEmail: `guest-${unique()}@example.com`,
  customerPhone: "+1 403 555 0101",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  promoCode,
});

const post = (cookie: string, body: object) => request(app).post("/api/affiliates/me/coupons").set("Cookie", cookie).send(body);

beforeAll(async () => {
  const a = await makePartner("ACTIVE");
  partnerCookie = a.cookie;
  partnerId = a.id;
  otherCookie = (await makePartner("ACTIVE")).cookie;
  pendingCookie = (await makePartner("PENDING")).cookie;
});

describe("partner coupons", () => {
  it("a partner creates a coupon; guests get the discount and the booking credits the partner", async () => {
    const made = await post(partnerCookie, { code: "hotel15", percentOff: 15, startsOn: null, endsOn: "2099-12-31", appliesTo: ["SHUTTLE"] });
    expect(made.status).toBe(201);
    expect(made.body.coupon.code).toBe("HOTEL15");

    const list = await request(app).get("/api/affiliates/me/coupons").set("Cookie", partnerCookie);
    expect(list.body.coupons).toHaveLength(1);
    expect(list.body.coupons[0]).toMatchObject({ code: "HOTEL15", percentOff: 15, appliesTo: ["SHUTTLE"], state: "ACTIVE", endsOn: "2099-12-31" });

    const shuttle = await departure("SHUTTLE");
    const quote = await request(app).post("/api/pricing/quote").set("X-Forwarded-For", "203.0.113.7").send({ departureId: shuttle.id, adultsCount: 2, promoCode: "HOTEL15" });
    expect(quote.body).toMatchObject({ success: true, discountPercent: 15 });

    const booked = await createBooking(guest(shuttle.id, "HOTEL15"));
    expect(booked.success).toBe(true);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: booked.booking!.id } });
    expect(b.affiliateId).toBe(partnerId);
    expect(b.totalAmount).toBe(17000);

    // Where it applies: not on a shared tour.
    const shared = await departure("SHARED");
    const refused = await createBooking(guest(shared.id, "HOTEL15"));
    expect(refused.success).toBe(false);
    expect(refused.error).toMatch(/shuttles only/);
  });

  it("deactivate, activate, edit and delete; only the partner's own coupons", async () => {
    const made = await post(partnerCookie, { code: "LAKE10", percentOff: 10, appliesTo: ["SHARED", "PRIVATE"] });
    const id = made.body.coupon.id;
    const shared = await departure("SHARED");

    expect((await request(app).patch(`/api/affiliates/me/coupons/${id}`).set("Cookie", partnerCookie).send({ isActive: false })).status).toBe(200);
    expect((await createBooking(guest(shared.id, "LAKE10"))).error).toMatch(/no longer active/);
    await request(app).patch(`/api/affiliates/me/coupons/${id}`).set("Cookie", partnerCookie).send({ isActive: true, percentOff: 12 });
    const ok = await createBooking(guest(shared.id, "LAKE10"));
    expect(ok.success).toBe(true);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: ok.booking!.id } })).totalAmount).toBe(17600);

    // Another partner can't see, change or delete it.
    expect((await request(app).get("/api/affiliates/me/coupons").set("Cookie", otherCookie)).body.coupons).toHaveLength(0);
    expect((await request(app).patch(`/api/affiliates/me/coupons/${id}`).set("Cookie", otherCookie).send({ isActive: false })).status).toBe(404);
    expect((await request(app).delete(`/api/affiliates/me/coupons/${id}`).set("Cookie", otherCookie)).status).toBe(404);
    expect((await request(app).delete(`/api/affiliates/me/coupons/${id}`).set("Cookie", partnerCookie)).status).toBe(200);
    expect(await prisma.promoCode.findUnique({ where: { code: "LAKE10" } })).toBeNull();
  });

  it("checks the percent cap, dates, where it applies, duplicates and the partner's status", async () => {
    expect((await post(partnerCookie, { code: "TOOBIG", percentOff: 50, appliesTo: ["SHARED"] })).body.error).toMatch(/at most 20%/);
    expect((await post(partnerCookie, { code: "NOWHERE", percentOff: 10, appliesTo: [] })).status).toBe(400);
    expect((await post(partnerCookie, { code: "BACKWARDS", percentOff: 10, appliesTo: ["SHARED"], startsOn: "2027-05-10", endsOn: "2027-05-01" })).status).toBe(400);
    expect((await post(partnerCookie, { code: "BANFF10", percentOff: 10, appliesTo: ["SHARED"] })).status).toBe(409); // server setting code
    expect((await post(otherCookie, { code: "HOTEL15", percentOff: 10, appliesTo: ["SHARED"] })).status).toBe(409);
    expect((await post(pendingCookie, { code: "PENDING5", percentOff: 5, appliesTo: ["SHARED"] })).status).toBe(403);
    expect((await request(app).get("/api/affiliates/me/coupons")).status).toBe(401);

    // A suspended partner's coupons stop working at checkout.
    await prisma.affiliate.update({ where: { id: partnerId }, data: { status: "SUSPENDED" } });
    const shuttle = await departure("SHUTTLE");
    expect((await createBooking(guest(shuttle.id, "HOTEL15"))).error).toMatch(/no longer active/);
    await prisma.affiliate.update({ where: { id: partnerId }, data: { status: "ACTIVE" } });
  });
});
