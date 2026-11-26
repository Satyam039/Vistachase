// Partner coupons. Since 2026-11-26 (owner) only the Vista Chase team creates coupon codes, in
// Admin → Promo codes, optionally for a partner: guests use them at checkout and bookings made with
// one credit that partner. The partner sees their own coupons (read-only) in the affiliate portal.

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
let otherId = "";
let pendingId = "";
let adminCookie = "";
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

// Staff make coupons; a partner's coupon carries affiliateId.
const post = (_cookie: string, body: object) => request(app).post("/api/admin/promo-codes").set("Cookie", adminCookie).send(body);
const forPartner = (affiliateId: string, b: { code: string; percentOff: number; appliesTo: string[]; startsOn?: string | null; endsOn?: string | null }) => ({
  code: b.code,
  kind: "PERCENT",
  value: b.percentOff,
  appliesTo: b.appliesTo,
  ...(b.startsOn !== undefined ? { startsOn: b.startsOn } : {}),
  ...(b.endsOn !== undefined ? { endsOn: b.endsOn } : {}),
  affiliateId,
});

beforeAll(async () => {
  const a = await makePartner("ACTIVE");
  partnerCookie = a.cookie;
  partnerId = a.id;
  const o = await makePartner("ACTIVE");
  otherCookie = o.cookie;
  otherId = o.id;
  const p = await makePartner("PENDING");
  pendingCookie = p.cookie;
  pendingId = p.id;
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminCookie = `vc_token=${signToken({ userId: admin.id, email: admin.email, role: admin.role as never, name: admin.name })}`;
});

describe("partner coupons", () => {
  it("partners can no longer create, change or delete coupons", async () => {
    for (const cookie of [partnerCookie, pendingCookie]) {
      const made = await request(app).post("/api/affiliates/me/coupons").set("Cookie", cookie).send({ code: "SELFMADE", percentOff: 10, appliesTo: ["SHARED"] });
      expect(made.status).toBe(403);
      expect(made.body.error).toMatch(/Vista Chase team/);
    }
    expect((await request(app).patch("/api/affiliates/me/coupons/x").set("Cookie", partnerCookie).send({ isActive: false })).status).toBe(403);
    expect((await request(app).delete("/api/affiliates/me/coupons/x").set("Cookie", partnerCookie)).status).toBe(403);
    expect(await prisma.promoCode.findUnique({ where: { code: "SELFMADE" } })).toBeNull();
    expect((await request(app).get("/api/affiliates/me/coupons").set("Cookie", partnerCookie)).body.canCreate).toBe(false);
    // Only admins make codes.
    expect((await request(app).post("/api/admin/promo-codes").set("Cookie", partnerCookie).send(forPartner(partnerId, { code: "SNEAKY", percentOff: 10, appliesTo: ["SHARED"] }))).status).toBe(403);
  });

  it("staff create a coupon for a partner; guests get the discount and the booking credits the partner", async () => {
    const made = await post(partnerCookie, forPartner(partnerId, { code: "hotel15", percentOff: 15, startsOn: null, endsOn: "2099-12-31", appliesTo: ["SHUTTLE"] }));
    expect(made.status).toBe(201);
    expect(made.body.promo.code).toBe("HOTEL15");
    const staffList = await request(app).get("/api/admin/promo-codes").set("Cookie", adminCookie);
    expect(staffList.body.promos.find((p: { code: string }) => p.code === "HOTEL15").partner).toMatchObject({ id: partnerId });
    expect(staffList.body.partners.some((p: { id: string }) => p.id === partnerId)).toBe(true);

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

  it("staff turn a partner coupon off and on, edit and delete it; partners only see their own", async () => {
    const made = await post(partnerCookie, forPartner(partnerId, { code: "LAKE10", percentOff: 10, appliesTo: ["SHARED", "PRIVATE"] }));
    const id = made.body.promo.id;
    const shared = await departure("SHARED");

    expect((await request(app).patch(`/api/admin/promo-codes/${id}`).set("Cookie", adminCookie).send({ isActive: false })).status).toBe(200);
    expect((await createBooking(guest(shared.id, "LAKE10"))).error).toMatch(/no longer active/);
    await request(app).patch(`/api/admin/promo-codes/${id}`).set("Cookie", adminCookie).send({ isActive: true, kind: "PERCENT", value: 12 });
    const ok = await createBooking(guest(shared.id, "LAKE10"));
    expect(ok.success).toBe(true);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: ok.booking!.id } })).totalAmount).toBe(17600);

    // Another partner doesn't see it; staff can move it to them.
    expect((await request(app).get("/api/affiliates/me/coupons").set("Cookie", otherCookie)).body.coupons).toHaveLength(0);
    expect((await request(app).patch(`/api/admin/promo-codes/${id}`).set("Cookie", adminCookie).send({ affiliateId: otherId })).status).toBe(200);
    expect((await request(app).get("/api/affiliates/me/coupons").set("Cookie", otherCookie)).body.coupons).toHaveLength(1);
    expect((await request(app).delete(`/api/admin/promo-codes/${id}`).set("Cookie", adminCookie)).status).toBe(200);
    expect(await prisma.promoCode.findUnique({ where: { code: "LAKE10" } })).toBeNull();
  });

  it("checks dates, where it applies, duplicates and the partner's status", async () => {
    expect((await post(partnerCookie, forPartner(partnerId, { code: "NOWHERE", percentOff: 10, appliesTo: [] }))).status).toBe(400);
    expect((await post(partnerCookie, forPartner(partnerId, { code: "BACKWARDS", percentOff: 10, appliesTo: ["SHARED"], startsOn: "2027-05-10", endsOn: "2027-05-01" }))).status).toBe(400);
    expect((await post(partnerCookie, forPartner(partnerId, { code: "BANFF10", percentOff: 10, appliesTo: ["SHARED"] }))).status).toBe(409); // server setting code
    expect((await post(otherCookie, forPartner(otherId, { code: "HOTEL15", percentOff: 10, appliesTo: ["SHARED"] }))).status).toBe(409);
    const pending = await post(pendingCookie, forPartner(pendingId, { code: "PENDING5", percentOff: 5, appliesTo: ["SHARED"] }));
    expect(pending.status).toBe(400);
    expect(pending.body.error).toMatch(/isn't active/);
    expect((await request(app).get("/api/affiliates/me/coupons")).status).toBe(401);

    // A suspended partner's coupons stop working at checkout.
    await prisma.affiliate.update({ where: { id: partnerId }, data: { status: "SUSPENDED" } });
    const shuttle = await departure("SHUTTLE");
    expect((await createBooking(guest(shuttle.id, "HOTEL15"))).error).toMatch(/no longer active/);
    await prisma.affiliate.update({ where: { id: partnerId }, data: { status: "ACTIVE" } });
  });
});
