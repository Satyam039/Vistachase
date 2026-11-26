// Booking changes (modules/bookings/booking-changes.ts): the guest asks for fewer or more guests, a
// new date, a new email or guest names; staff preview and apply it, and the backend moves the seats,
// re-prices the invoice and records the refund or the extra amount due. Also the 3-day sign-in
// lifetime (lib/auth/auth.ts).

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken, verifyToken } from "@/lib/auth/auth";
import { signBookingLink } from "@/lib/security/signed-links";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import { createBooking } from "@/modules/bookings/booking.repository";
import { applyBookingChange, planBookingChange, planSummary, repriceBooking, requestBookingChange } from "@/modules/bookings/booking-changes";
import { markRefunded } from "@/modules/admin/booking-admin";

const app = createApp();
let tourId = "";
let privateTourId = "";
let adminCookie = "";
let adminId = "";
let n = 0;

const cookieFor = (u: { id: string; email: string; role: string; name: string }) =>
  `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name })}`;

/** A LOCAL departure `hoursAhead` hours from now, $100 a seat. */
async function departure(hoursAhead: number, opts: { price?: number; tour?: string; capacity?: number } = {}) {
  n += 1;
  const at = new Date(Date.now() + hoursAhead * 3_600_000);
  // Mountain Time date and clock of `at`, so "hours ahead" holds whatever the server's zone.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return prisma.tourDeparture.create({
    data: {
      tourId: opts.tour ?? tourId,
      date: dateOnly(`${get("year")}-${get("month")}-${get("day")}`),
      departureTime: timeOfDay(`${get("hour")}:${String((Number(get("minute")) + n) % 60).padStart(2, "0")}`),
      capacityTotal: opts.capacity ?? 12,
      price: opts.price ?? 10000,
      status: "ACTIVE",
      inventorySource: "LOCAL",
    },
  });
}

async function book(dep: { id: string }, adults = 6) {
  const result = await createBooking({
    departureId: dep.id,
    customerName: "Meera Kapoor",
    customerEmail: `change.guest.${n}@example.com`,
    customerPhone: "+1 403 555 0177",
    adultsCount: adults,
    childrenCount: 0,
    infantsCount: 0,
  });
  expect(result.success).toBe(true);
  return prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id }, include: { payments: true } });
}

const reload = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id }, include: { payments: true, flags: true } });
const seats = async (id: string) => (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).capacityBooked;
const paid = (b: { payments: { status: string; amount: number }[] }) => b.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0);

beforeAll(async () => {
  tourId = (await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } })).id;
  privateTourId = (await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } })).id;
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminId = admin.id;
  adminCookie = cookieFor(admin);
});

afterEach(() => {
  delete process.env.STAFF_REFUNDS_VIA_PROVIDER;
  delete process.env.SESSION_MAX_DAYS;
});

describe("Guest change request", () => {
  it("sends one request for fewer guests with an estimate, and leaves the booking as it is", async () => {
    const dep = await departure(24 * 20);
    const b = await book(dep);
    const t = signBookingLink(b.bookingReference, "voucher");
    const res = await request(app)
      .post("/api/bookings/manage/change-request")
      .send({ bookingReference: b.bookingReference, t, guests: { adults: 5 }, guestNames: "Meera, Arjun, Kavya, Rohan, Isha", note: "One of us can't come" });
    expect(res.status).toBe(201);
    expect(res.body.estimate).toMatchObject({ total: 500, current: 600, paid: 600 });
    const row = await reload(b.id);
    expect(row.adultsCount).toBe(6);
    const flag = row.flags.find((f) => f.note.startsWith("Change request"))!;
    expect(flag).toMatchObject({ type: "OTHER", status: "OPEN" });
    expect(flag.note).toContain("guests 6 adults to 5 adults");

    const again = await request(app).post("/api/bookings/manage/change-request").send({ bookingReference: b.bookingReference, t, guests: { adults: 4 } });
    expect(again.status).toBe(409);
    const denied = await request(app).post("/api/bookings/manage/change-request").send({ bookingReference: b.bookingReference, t: "nope", guests: { adults: 4 } });
    expect(denied.status).toBe(403);

    const list = await request(app).get("/api/admin/requests").set("Cookie", adminCookie);
    const listed = list.body.changes.find((c: { id: string }) => c.id === flag.id);
    expect(listed.asked).toMatchObject({ guests: { adults: 5, children: 0, infants: 0 }, estimate: 500, guestNames: "Meera, Arjun, Kavya, Rohan, Isha" });
  });

  it("refuses an empty request and a party bigger than a private vehicle", async () => {
    const b = await book(await departure(24 * 20), 2);
    const ask = (guests: { adults: number; children: number; infants: number }, ref = b.bookingReference) =>
      requestBookingChange(ref, { guests, preferredTime: "", guestNames: "", note: "" }, null);
    expect((await ask({ adults: 2, children: 0, infants: 0 })).status).toBe(400);
    expect((await ask({ adults: 0, children: 0, infants: 0 })).status).toBe(400);

    const vehicle = await book(await departure(24 * 20, { tour: privateTourId, capacity: 6, price: 129900 }), 2);
    expect((await ask({ adults: 30, children: 0, infants: 0 }, vehicle.bookingReference)).status).toBe(400);
  });
});

describe("Staff apply a change", () => {
  it("one guest can't join (before the deadline): 6 → 5 seats, invoice $600 → $500, $100 refund owed, request answered", async () => {
    const dep = await departure(24 * 20);
    const b = await book(dep);
    expect((await requestBookingChange(b.bookingReference, { guests: { adults: 5, children: 0, infants: 0 }, preferredTime: "", guestNames: "", note: "" }, null)).status).toBe(201);
    const flag = (await reload(b.id)).flags.find((f) => f.note.startsWith("Change request"))!;

    const preview = await request(app)
      .post(`/api/admin/bookings/${b.id}/change/preview`)
      .set("Cookie", adminCookie)
      .send({ guests: { adults: 5 }, requestId: flag.id });
    expect(preview.status).toBe(200);
    expect(preview.body.preview).toMatchObject({ invoice: { total: 500 }, paid: 600, refund: 100, due: 0, seats: { before: 6, after: 5 } });
    expect((await reload(b.id)).totalAmount).toBe(60000); // preview saves nothing

    const res = await request(app).post(`/api/admin/bookings/${b.id}/change`).set("Cookie", adminCookie).send({ guests: { adults: 5 }, requestId: flag.id, notifyGuest: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refund: 100, refundOwed: 100, refunded: 0 });
    const row = await reload(b.id);
    expect(row).toMatchObject({ adultsCount: 5, totalSeats: 5, totalAmount: 50000, subtotal: 50000, status: "CONFIRMED" });
    expect(await seats(dep.id)).toBe(5);
    expect(row.flags.find((f) => f.id === flag.id)!.status).toBe("RESOLVED");
    const refundFlag = row.flags.find((f) => f.type === "REFUND_DUE")!;
    expect(refundFlag.amountCents).toBe(10000);
    const snap = row.priceSnapshot as { changes: { totalFromCents: number; totalToCents: number }[]; party: { adults: number } };
    expect(snap.party.adults).toBe(5);
    expect(snap.changes.at(-1)).toMatchObject({ totalFromCents: 60000, totalToCents: 50000 });
    expect(await prisma.auditLog.count({ where: { action: "BOOKING_CHANGED", entityId: b.id } })).toBe(1);

    // Staff send the $100 by hand: the booking stays live and now counts $500 paid.
    const marked = await markRefunded(refundFlag.id, { reference: "ET-123" }, adminId);
    expect(marked.status).toBe(200);
    const after = await reload(b.id);
    expect(after.status).toBe("CONFIRMED");
    expect(paid(after)).toBe(50000);
  });

  it("refunds through the payment provider when staff refunds are switched on, and lowers the payment", async () => {
    process.env.STAFF_REFUNDS_VIA_PROVIDER = "true";
    const b = await book(await departure(24 * 20), 4);
    const res = await applyBookingChange(b.id, { guests: { adults: 3, children: 0, infants: 0 }, repricing: "KEEP", refund: "POLICY", notifyGuest: false }, adminId);
    expect(res).toMatchObject({ status: 200, refunded: 100, refundOwed: 0 });
    const row = await reload(b.id);
    expect(paid(row)).toBe(30000);
    expect(row.flags.filter((f) => f.type === "REFUND_DUE")).toHaveLength(0);
  });

  it("inside the deadline the policy keeps the money: total stays what was paid, with the kept part shown", async () => {
    const dep = await departure(10); // shared tour, 24-hour rule
    const b = await book(dep, 3);
    // Staff may still give it back.
    const full = await planBookingChange(b.id, { guests: { adults: 2, children: 0, infants: 0 }, repricing: "KEEP", refund: "FULL", notifyGuest: false });
    expect(full.status === 200 && full.refundCents).toBe(10000);
    const plan = await planBookingChange(b.id, { guests: { adults: 2, children: 0, infants: 0 }, repricing: "KEEP", refund: "POLICY", notifyGuest: false });
    expect(plan.status).toBe(200);
    if (plan.status !== 200) return;
    expect(planSummary(plan)).toMatchObject({ refund: 0, keptNow: 100, invoice: { total: 300, kept: 100 } });
    const res = await applyBookingChange(b.id, { guests: { adults: 2, children: 0, infants: 0 }, repricing: "KEEP", refund: "POLICY", notifyGuest: false }, adminId);
    expect(res.status).toBe(200);
    const row = await reload(b.id);
    expect(row).toMatchObject({ totalSeats: 2, totalAmount: 30000 });
    expect(row.flags.filter((f) => f.type === "REFUND_DUE")).toHaveLength(0);
    expect(await seats(dep.id)).toBe(2);
  });

  it("an extra guest: seat taken, $100 due, and the guest pays it from the voucher (Pay balance)", async () => {
    const dep = await departure(24 * 20);
    const b = await book(dep, 2);
    const res = await applyBookingChange(b.id, { guests: { adults: 3, children: 0, infants: 0 }, repricing: "KEEP", refund: "POLICY", notifyGuest: false }, adminId);
    expect(res).toMatchObject({ status: 200, due: 100 });
    const row = await reload(b.id);
    expect(row.totalAmount).toBe(30000);
    expect(row.flags.find((f) => f.type === "PAYMENT_DUE" && f.status === "OPEN")!.amountCents).toBe(10000);
    expect(await seats(dep.id)).toBe(3);

    const voucher = await request(app).get(`/api/bookings?ref=${b.bookingReference}&t=${signBookingLink(b.bookingReference, "voucher")}`);
    expect(voucher.body.booking).toMatchObject({ paymentPlan: "FULL", amountPaid: 200, balanceDue: 100 });

    const pay = await request(app).post("/api/bookings/pay-balance").send({ bookingReference: b.bookingReference, t: signBookingLink(b.bookingReference, "voucher") });
    expect(pay.status).toBe(200);
    expect(pay.body).toMatchObject({ paid: true });
    const settled = await reload(b.id);
    expect(paid(settled)).toBe(30000);
    expect(settled.flags.find((f) => f.type === "PAYMENT_DUE")!.status).toBe("RESOLVED");
  });

  it("refuses more guests than the departure has seats", async () => {
    const dep = await departure(24 * 20, { capacity: 3 });
    const b = await book(dep, 2);
    const res = await applyBookingChange(b.id, { guests: { adults: 5, children: 0, infants: 0 }, repricing: "KEEP", refund: "POLICY", notifyGuest: false }, adminId);
    expect(res.status).toBe(409);
    expect((await reload(b.id)).totalSeats).toBe(2);
  });

  it("reschedules to another date at that date's price, moving the seats", async () => {
    const from = await departure(24 * 20);
    const to = await departure(24 * 25, { price: 12000 });
    const b = await book(from, 2);
    const keep = await planBookingChange(b.id, { departureId: to.id, repricing: "KEEP", refund: "POLICY", notifyGuest: false });
    expect(keep.status === 200 && keep.newTotal).toBe(20000);
    const res = await applyBookingChange(b.id, { departureId: to.id, repricing: "NEW", refund: "POLICY", notifyGuest: false }, adminId);
    expect(res).toMatchObject({ status: 200, due: 40 });
    const row = await reload(b.id);
    expect(row).toMatchObject({ tourDepartureId: to.id, totalAmount: 24000 });
    expect(await seats(from.id)).toBe(0);
    expect(await seats(to.id)).toBe(2);
  });

  it("changes the lead name and email and records the guests' names", async () => {
    const b = await book(await departure(24 * 20), 2);
    const res = await applyBookingChange(
      b.id,
      { customerName: "Arjun Kapoor", customerEmail: "arjun.k@example.com", guestNames: "Arjun Kapoor, Meera Kapoor", repricing: "KEEP", refund: "POLICY", notifyGuest: false },
      adminId,
    );
    expect(res.status).toBe(200);
    const row = await reload(b.id);
    expect(row).toMatchObject({ customerName: "Arjun Kapoor", customerEmail: "arjun.k@example.com", totalAmount: 20000 });
    expect(row.specialRequests).toContain("Guest names: Arjun Kapoor, Meera Kapoor");
  });

  it("a private vehicle costs the same with fewer guests", async () => {
    const dep = await departure(24 * 20, { tour: privateTourId, capacity: 6, price: 129900 });
    const b = await book(dep, 4);
    const res = await applyBookingChange(b.id, { guests: { adults: 3, children: 0, infants: 0 }, repricing: "KEEP", refund: "POLICY", notifyGuest: false }, adminId);
    expect(res).toMatchObject({ status: 200, refund: 0, due: 0 });
    const row = await reload(b.id);
    expect(row).toMatchObject({ adultsCount: 3, totalAmount: b.totalAmount });
    expect(await seats(dep.id)).toBe(6); // the whole vehicle stays booked
  });

  it("staff decline a request with a reason; dispatchers can't change bookings", async () => {
    const b = await book(await departure(24 * 20), 2);
    const newDate = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    expect((await requestBookingChange(b.bookingReference, { newDate, preferredTime: "", guestNames: "", note: "" }, null)).status).toBe(201);
    const flag = (await reload(b.id)).flags.find((f) => f.note.startsWith("Change request"))!;
    const dispatcher = await prisma.user.findFirstOrThrow({ where: { role: "DISPATCHER" } });
    const refused = await request(app).post(`/api/admin/bookings/${b.id}/change`).set("Cookie", cookieFor(dispatcher)).send({ guests: { adults: 1 } });
    expect(refused.status).toBe(403);
    const res = await request(app).post(`/api/admin/requests/${flag.id}/decline-change`).set("Cookie", adminCookie).send({ reason: "That date is sold out", notifyGuest: false });
    expect(res.status).toBe(200);
    expect((await reload(b.id)).flags.find((f) => f.id === flag.id)!.status).toBe("RESOLVED");
  });
});

describe("repriceBooking", () => {
  const dep = { price: 10000, childPrice: 8000, infantPrice: null, capacityTotal: 12, tour: { category: "SHARED" } };
  const booking = {
    totalAmount: 25200,
    subtotal: 25200,
    addOnsTotal: 0,
    adultsCount: 2,
    childrenCount: 1,
    infantsCount: 0,
    totalSeats: 3,
    priceSnapshot: { pricing: "PER_GUEST", adultUnitCents: 10000, childUnitCents: 8000, infantUnitCents: null, fareCents: 28000, discountCents: 2800, promo: { code: "BANFF10", percent: 10 }, addOnsCents: 0 },
  };
  it("keeps the booked unit prices and the percentage discount", () => {
    expect(repriceBooking(booking, dep, dep, { adults: 1, children: 1, infants: 0 })).toMatchObject({ fareCents: 18000, discountCents: 1800, totalCents: 16200 });
  });
  it("keeps a fixed-amount code fixed", () => {
    const fixed = { ...booking, priceSnapshot: { ...booking.priceSnapshot, discountCents: 5000, promo: { code: "TAKE50", amountOffCents: 5000 } } };
    expect(repriceBooking(fixed, dep, dep, { adults: 1, children: 0, infants: 0 }).totalCents).toBe(5000);
  });
});

describe("Sign-in lifetime", () => {
  it("a sign-in lasts 3 days: older tokens, even ones issued for 7 days, are refused", async () => {
    const payload = { userId: "u1", email: "a@example.com", role: "CUSTOMER" as const, name: "A" };
    const fresh = signToken(payload);
    expect(verifyToken(fresh)).not.toBeNull();
    expect(verifyToken(fresh, Date.now() + 2.9 * 86_400_000)).not.toBeNull();
    expect(verifyToken(fresh, Date.now() + 3.1 * 86_400_000)).toBeNull();
    const old = jwt.sign({ ...payload, iat: Math.floor(Date.now() / 1000) - 4 * 86_400 }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    expect(verifyToken(old)).toBeNull();
    process.env.SESSION_MAX_DAYS = "2";
    expect(verifyToken(fresh, Date.now() + 2.5 * 86_400_000)).toBeNull();
  });

  it("the sign-in cookie ends after 3 days", async () => {
    const { hashPassword } = await import("@/lib/auth/auth");
    const user = await prisma.user.create({ data: { email: `lifetime.${process.pid}@example.com`, name: "Life Time", role: "CUSTOMER", emailVerified: true, passwordHash: await hashPassword("Correct-Horse-9") } });
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: "Correct-Horse-9" });
    expect(res.status).toBe(200);
    const cookie = String(res.headers["set-cookie"]).match(/vc_token=[^;]+;[^,]*Max-Age=(\d+)/);
    expect(Number(cookie?.[1])).toBe(3 * 86_400);
  });
});
