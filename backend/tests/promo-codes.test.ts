// Promo codes staff create in Admin → Promo codes: the checkout's Apply button, the booking's
// price, date windows, on/off, use limits (expired unpaid bookings give their use back), fixed
// amounts capped at the fare, the PROMO_CODES setting still working, and admin-only editing.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { createBooking } from "@/modules/bookings/booking.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { dateOnly, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

const app = createApp();
let adminCookie = "";
let dispatcherCookie = "";
let tourId = "";
let day = 0;

const cookieFor = (u: { id: string; email: string; role: string; name: string }) =>
  `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name })}`;

async function departure(capacityTotal = 8) {
  day += 1;
  const date = new Date(Date.UTC(2028, 4, 1 + day)).toISOString().slice(0, 10);
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay("08:30"), capacityTotal, price: 20000, childPrice: 10000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

const guest = (departureId: string, n: number, promoCode?: string) => ({
  departureId,
  customerName: `Promo Guest ${n}`,
  customerEmail: `promo.guest${n}@example.com`,
  customerPhone: "+1 403 555 0177",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  promoCode,
});

const unpaid: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: "cs", intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment() {
    return { success: true, refundId: "re" };
  },
};

const create = (body: Record<string, unknown>) => request(app).post("/api/admin/promo-codes").set("Cookie", adminCookie).send(body);
const quote = (departureId: string, promoCode: string) => request(app).post("/api/pricing/quote").send({ departureId, adultsCount: 2, promoCode });

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const dispatcher = await prisma.user.findFirstOrThrow({ where: { role: "DISPATCHER" } });
  adminCookie = cookieFor(admin);
  dispatcherCookie = cookieFor(dispatcher);
  tourId = (await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } })).id;
});

afterEach(() => setPaymentProviderForTests(null));

describe("promo codes", () => {
  it("an admin creates a percent code; Apply succeeds and the booking is charged the discounted price", async () => {
    const made = await create({ code: "welcome15", kind: "PERCENT", value: 15, note: "Newsletter" });
    expect(made.status).toBe(201);
    expect(made.body.promo.code).toBe("WELCOME15");

    const dep = await departure();
    const q = await quote(dep.id, " Welcome15 ");
    expect(q.status).toBe(200);
    expect(q.body).toMatchObject({ success: true, promoCode: "WELCOME15", discountPercent: 15, amountOff: 0, discountAmount: 60 });
    expect(q.body.message).toContain("15% off");

    const result = await createBooking(guest(dep.id, 1, "welcome15"));
    expect(result.success).toBe(true);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id } });
    expect(b.totalAmount).toBe(34000);
    expect(b.priceSnapshot).toMatchObject({ fareCents: 40000, discountCents: 6000, promo: { code: "WELCOME15", percent: 15 } });

    const list = await request(app).get("/api/admin/promo-codes").set("Cookie", adminCookie);
    const row = list.body.promos.find((p: { code: string }) => p.code === "WELCOME15");
    expect(row).toMatchObject({ kind: "PERCENT", value: 15, uses: 1, paidBookings: 1, state: "LIVE", label: "15% off" });
    expect(list.body.fromSettings.map((p: { code: string }) => p.code)).toContain("BANFF10");
  });

  it("a fixed-amount code takes off at most the fare", async () => {
    expect((await create({ code: "SAVE50", kind: "AMOUNT", value: 50 })).status).toBe(201);
    expect((await create({ code: "HUGE", kind: "AMOUNT", value: 5000 })).status).toBe(201);
    const dep = await departure();
    const q = await quote(dep.id, "save50");
    expect(q.body).toMatchObject({ success: true, discountPercent: 0, amountOff: 50, discountAmount: 50 });
    const r = await createBooking(guest(dep.id, 2, "SAVE50"));
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: r.booking!.id } })).totalAmount).toBe(35000);

    const dep2 = await departure();
    const r2 = await createBooking(guest(dep2.id, 3, "HUGE"));
    expect(r2.success).toBe(true);
    const b2 = await prisma.booking.findUniqueOrThrow({ where: { id: r2.booking!.id } });
    expect(b2.totalAmount).toBe(0);
    expect(b2.status).toBe("CONFIRMED"); // free bookings need no payment
  });

  it("refuses codes that are off, not started, expired or used up, with a clear message", async () => {
    const today = todayInMountainTime();
    const plus = (n: number) => {
      const d = dateOnly(today);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    await create({ code: "OFFCODE", kind: "PERCENT", value: 10, isActive: false });
    await create({ code: "LATER", kind: "PERCENT", value: 10, startsOn: plus(3) });
    await create({ code: "OLD", kind: "PERCENT", value: 10, startsOn: plus(-10), endsOn: plus(-1) });
    await create({ code: "TODAYONLY", kind: "PERCENT", value: 10, startsOn: today, endsOn: today });
    const dep = await departure();
    expect((await quote(dep.id, "OFFCODE")).body.error).toMatch(/no longer active/);
    expect((await quote(dep.id, "LATER")).body.error).toMatch(/isn't active yet/);
    expect((await quote(dep.id, "OLD")).body.error).toMatch(/expired/);
    expect((await quote(dep.id, "TODAYONLY")).status).toBe(200);
    expect((await quote(dep.id, "NOPE123")).status).toBe(404);

    // A code applied at checkout that expires before the guest pays: the booking is refused, not overcharged.
    const refused = await createBooking(guest(dep.id, 4, "OLD"));
    expect(refused.success).toBe(false);
    expect(refused.error).toMatch(/expired/);
    // An unknown code (e.g. a partner voucher) is ignored, as before.
    const ignored = await createBooking(guest(dep.id, 5, "NOPE123"));
    expect(ignored.success).toBe(true);
  });

  it("counts uses; an unpaid booking that expires gives its use back", async () => {
    await create({ code: "ONCE", kind: "PERCENT", value: 20, maxUses: 1 });
    setPaymentProviderForTests(unpaid);
    const dep = await departure();
    const first = await createBooking(guest(dep.id, 6, "ONCE"));
    expect(first.success).toBe(true);
    expect((await quote(dep.id, "ONCE")).body.error).toMatch(/fully used/);
    const second = await createBooking(guest(dep.id, 7, "ONCE"));
    expect(second.success).toBe(false);

    await prisma.booking.update({ where: { id: first.booking!.id }, data: { status: "EXPIRED" } });
    expect((await quote(dep.id, "ONCE")).status).toBe(200);
  });

  it("still accepts codes from the PROMO_CODES setting, and a table code overrides one", async () => {
    const dep = await departure();
    expect((await quote(dep.id, "banff10")).body).toMatchObject({ success: true, discountPercent: 10 });
    const off = await create({ code: "BANFF10", kind: "PERCENT", value: 10, isActive: false });
    expect(off.status).toBe(201);
    expect((await quote(dep.id, "BANFF10")).status).toBe(404);
    await request(app).delete(`/api/admin/promo-codes/${off.body.promo.id}`).set("Cookie", adminCookie);
    expect((await quote(dep.id, "BANFF10")).status).toBe(200);
  });

  it("only admins create, edit and delete; values and dates are checked", async () => {
    expect((await request(app).post("/api/admin/promo-codes").set("Cookie", dispatcherCookie).send({ code: "NOPE", kind: "PERCENT", value: 5 })).status).toBe(403);
    expect((await request(app).get("/api/admin/promo-codes").set("Cookie", dispatcherCookie)).status).toBe(403);
    expect((await create({ code: "BAD CODE", kind: "PERCENT", value: 5 })).status).toBe(400);
    expect((await create({ code: "TOOMUCH", kind: "PERCENT", value: 150 })).status).toBe(400);
    expect((await create({ code: "BACKWARDS", kind: "PERCENT", value: 5, startsOn: "2027-05-10", endsOn: "2027-05-01" })).status).toBe(400);
    const made = await create({ code: "EDITME", kind: "PERCENT", value: 5 });
    expect((await create({ code: "editme", kind: "PERCENT", value: 5 })).status).toBe(409);
    const edited = await request(app).patch(`/api/admin/promo-codes/${made.body.promo.id}`).set("Cookie", adminCookie).send({ kind: "AMOUNT", value: 25, maxUses: 3 });
    expect(edited.status).toBe(200);
    expect(edited.body.promo).toMatchObject({ percentOff: null, amountOffCents: 2500, maxUses: 3 });
    expect(await prisma.auditLog.count({ where: { entityType: "PromoCode", entityId: made.body.promo.id } })).toBe(2);
  });
});
