// The first-party booking engine: bookings, holds and seats live only in this database. Covers
// local creation and its price snapshot, input validation, idempotent retries, concurrent holds
// and bookings, hold and payment expiry with no job runner, payment verification, status rules,
// rollback on a database error, unverified inventory, and that none of it calls Bókun.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { cancelBooking, confirmPaidBooking, createBooking, failPendingBooking } from "@/modules/bookings/booking.repository";
import { canTransition, transitionBooking } from "@/modules/bookings/booking-status";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { getCheckoutDeparture } from "@/modules/departures/departure.repository";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

// Behaves like Stripe: the guest pays in the browser, and a retry can look the intent up again.
const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_${req.bookingReference}_secret`, intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async retrievePaymentIntent(intentId) {
    return { clientSecret: `${intentId}_secret`, intentId, amount: 0, currency: "CAD", paid: false };
  },
  async refundPayment() {
    return { success: true, refundId: "re_test" };
  },
};

let tourId = "";
let tourSlug = "";
let day = 0;

/** A fresh departure on its own date, so tests never share seats. */
async function departure(data: { capacityTotal?: number; inventorySource?: "LOCAL" | "EXTERNAL" | "UNVERIFIED" } = {}) {
  day += 1;
  const date = new Date(Date.UTC(2027, 8, 1 + day)).toISOString().slice(0, 10);
  return prisma.tourDeparture.create({
    data: {
      tourId,
      date: dateOnly(date),
      departureTime: timeOfDay("08:30"),
      capacityTotal: data.capacityTotal ?? 4,
      price: 15000,
      childPrice: 9000,
      status: "ACTIVE",
      inventorySource: data.inventorySource ?? "LOCAL",
    },
  });
}

const guest = (departureId: string, n: number, party = { adultsCount: 1, childrenCount: 0 }) => ({
  departureId,
  customerName: `Local Guest ${n}`,
  customerEmail: `local.guest${n}@example.com`,
  customerPhone: "+1 403 555 0199",
  infantsCount: 0,
  ...party,
});

const seats = async (id: string) => prisma.tourDeparture.findUniqueOrThrow({ where: { id }, select: { capacityBooked: true, capacityHeld: true } });

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeAll(async () => {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } });
  tourId = tour.id;
  tourSlug = tour.slug;
});

afterEach(() => setPaymentProviderForTests(null));
afterAll(() => fetchSpy.mockRestore());

describe("local booking creation", () => {
  it("saves the booking, its price snapshot and payment deadline, and confirms only after payment", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure();
    const result = await createBooking({ ...guest(dep.id, 1, { adultsCount: 2, childrenCount: 1 }), addOns: [{ id: "lunch" }], promoCode: "banff10" });
    expect(result.success).toBe(true);
    expect(result.booking?.status).toBe("PENDING_PAYMENT");
    expect(result.booking?.paymentStatus).toBe("PENDING");
    expect(result.nextStep).toBe("PAY");

    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: result.booking!.bookingReference }, include: { payments: true } });
    expect(stored.bookingReference).toMatch(/^VC-\d{4}-[0-9A-F]{8}$/);
    expect(stored.totalSeats).toBe(3);
    // 2 × 150 + 1 × 90 = 390, less 10% = 351, plus lunch 22 × 3 = 66
    expect(stored.totalAmount).toBe(35100 + 6600);
    expect(stored.priceSnapshot).toMatchObject({
      adultUnitCents: 15000,
      childUnitCents: 9000,
      fareCents: 39000,
      promo: { code: "BANFF10", percent: 10 },
      discountCents: 3900,
      addOnsCents: 6600,
      totalCents: 41700,
      inventorySource: "LOCAL",
    });
    expect(stored.paymentExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect(stored.externalSyncStatus).toBe("NOT_REQUIRED");
    expect(stored.bokunBookingId).toBeNull();
    expect(await seats(dep.id)).toEqual({ capacityBooked: 3, capacityHeld: 0 });

    // Confirmed only by a payment that matches the total.
    await confirmPaidBooking(stored.bookingReference, { amount: stored.totalAmount, currency: "cad", transactionId: stored.payments[0].transactionId });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: stored.id } })).status).toBe("CONFIRMED");
    const actions = (await prisma.auditLog.findMany({ where: { entityId: stored.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["BOOKING_CREATED", "BOOKING_CONFIRMED", "CONFIRMATION_EMAIL_SENT"]);
  });

  it("refuses invalid guest input at the API", async () => {
    const dep = await departure();
    const app = createApp();
    const post = (body: object, ip: string) => request(app).post("/api/bookings").set("X-Forwarded-For", ip).send(body);

    expect((await post({ ...guest(dep.id, 2), customerEmail: "not-an-email" }, "10.9.0.1")).status).toBe(400);
    expect((await post({ ...guest(dep.id, 2), adultsCount: 0, childrenCount: 2 }, "10.9.0.2")).status).toBe(400);
    expect((await post({ ...guest(dep.id, 2), customerName: "" }, "10.9.0.3")).status).toBe(400);
    expect((await post({ ...guest(dep.id, 2), adultsCount: 500 }, "10.9.0.4")).status).toBe(400);
    const badKey = await request(app).post("/api/bookings").set("X-Forwarded-For", "10.9.0.5").set("Idempotency-Key", "short").send(guest(dep.id, 2));
    expect(badKey.status).toBe(400);
    expect(await prisma.booking.count({ where: { tourDepartureId: dep.id } })).toBe(0);
  });
});

describe("idempotent submissions", () => {
  it("returns the same booking for a repeated key, over the API too, and resumes the same payment", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure();
    const key = "checkout-attempt-0001-abcdef";
    const first = await createBooking({ ...guest(dep.id, 3), idempotencyKey: key });
    const second = await createBooking({ ...guest(dep.id, 3), idempotencyKey: key });
    expect(second.replayed).toBe(true);
    expect(second.booking?.bookingReference).toBe(first.booking?.bookingReference);
    expect(second.payment?.clientSecret).toMatch(/^pi_VC-/);

    const viaApi = await request(createApp()).post("/api/bookings").set("X-Forwarded-For", "10.9.1.1").set("Idempotency-Key", key).send(guest(dep.id, 3));
    expect(viaApi.status).toBe(200);
    expect(viaApi.body.replayed).toBe(true);
    expect(viaApi.body.booking.bookingReference).toBe(first.booking?.bookingReference);

    expect(await prisma.booking.count({ where: { tourDepartureId: dep.id } })).toBe(1);
    expect((await seats(dep.id)).capacityBooked).toBe(1);
  });

  it("makes one booking when the same key arrives several times at once (double-click)", async () => {
    const dep = await departure();
    const key = "checkout-attempt-0002-abcdef";
    const results = await Promise.all(Array.from({ length: 5 }, () => createBooking({ ...guest(dep.id, 4), idempotencyKey: key })));
    expect(new Set(results.map((r) => r.booking?.bookingReference)).size).toBe(1);
    expect(results.every((r) => r.success)).toBe(true);
    expect(await prisma.booking.count({ where: { tourDepartureId: dep.id } })).toBe(1);
    expect((await seats(dep.id)).capacityBooked).toBe(1);
  });

  it("refuses a key reused for a different booking", async () => {
    const dep = await departure();
    const key = "checkout-attempt-0003-abcdef";
    await createBooking({ ...guest(dep.id, 5), idempotencyKey: key });
    const other = await createBooking({ ...guest(dep.id, 5, { adultsCount: 2, childrenCount: 0 }), idempotencyKey: key });
    expect(other.success).toBe(false);
    expect(await prisma.booking.count({ where: { tourDepartureId: dep.id } })).toBe(1);
  });
});

describe("capacity under simultaneous requests", () => {
  it("never holds more seats than exist (8 parallel holds on 4 seats)", async () => {
    const dep = await departure({ capacityTotal: 4 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createReservationHold({ departureId: dep.id, seatsCount: 1, customerName: `Racer ${i}`, customerEmail: `racer${i}@example.com` })),
    );
    expect(results.filter((r) => r.success)).toHaveLength(4);
    expect((await seats(dep.id)).capacityHeld).toBe(4);
    expect(await prisma.reservationHold.count({ where: { tourDepartureId: dep.id, status: "ACTIVE" } })).toBe(4);
  });

  it("never books more seats than exist (8 parallel bookings on 4 seats)", async () => {
    const dep = await departure({ capacityTotal: 4 });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createBooking(guest(dep.id, 100 + i))));
    expect(results.filter((r) => r.success)).toHaveLength(4);
    expect(results.filter((r) => !r.success).every((r) => /seats are available/.test(r.error!))).toBe(true);
    expect((await seats(dep.id)).capacityBooked).toBe(4);
  });

  it("turns one hold into one booking even when submitted twice at once", async () => {
    const dep = await departure({ capacityTotal: 4 });
    const hold = await createReservationHold({ departureId: dep.id, seatsCount: 2, customerName: "Twin", customerEmail: "twin@example.com" });
    const results = await Promise.all([1, 2].map(() => createBooking({ ...guest(dep.id, 6, { adultsCount: 2, childrenCount: 0 }), holdToken: hold.holdToken })));
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await seats(dep.id)).toEqual({ capacityBooked: 2, capacityHeld: 0 });
    const converted = await prisma.reservationHold.findUniqueOrThrow({ where: { holdToken: hold.holdToken! } });
    expect(converted.status).toBe("CONVERTED");
    expect(converted.bookingId).toBe(results.find((r) => r.success)!.booking!.id);
  });
});

describe("expiry with no job runner", () => {
  it("frees an expired hold's seats on the next hold, and forgets the guest's details", async () => {
    const dep = await departure({ capacityTotal: 2 });
    const stale = await createReservationHold({ departureId: dep.id, seatsCount: 2, customerName: "Slow", customerEmail: "slow@example.com" });
    await prisma.reservationHold.update({ where: { holdToken: stale.holdToken! }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const fresh = await createReservationHold({ departureId: dep.id, seatsCount: 2, customerName: "Next", customerEmail: "next@example.com" });
    expect(fresh.success).toBe(true);
    expect((await seats(dep.id)).capacityHeld).toBe(2);
    const expired = await prisma.reservationHold.findUniqueOrThrow({ where: { holdToken: stale.holdToken! } });
    expect(expired).toMatchObject({ status: "EXPIRED", customerEmail: "", customerName: "", customerPhone: null });
  });

  it("expires an unpaid booking after its payment window and gives the seats back", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure({ capacityTotal: 2 });
    const unpaid = await createBooking(guest(dep.id, 7, { adultsCount: 2, childrenCount: 0 }));
    await prisma.booking.update({ where: { id: unpaid.booking!.id }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });

    const next = await createBooking(guest(dep.id, 8, { adultsCount: 2, childrenCount: 0 }));
    expect(next.success).toBe(true);
    const old = await prisma.booking.findUniqueOrThrow({ where: { id: unpaid.booking!.id }, include: { payments: true } });
    expect(old.status).toBe("EXPIRED");
    expect(old.payments[0].status).toBe("FAILED");
    expect((await seats(dep.id)).capacityBooked).toBe(2);
  });
});

describe("payment results", () => {
  it("releases a failed payment's seats exactly once, even when reported twice at once", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure({ capacityTotal: 4 });
    await createBooking(guest(dep.id, 9));
    const failing = await createBooking(guest(dep.id, 10, { adultsCount: 2, childrenCount: 0 }));
    const outcomes = await Promise.all([1, 2].map(() => failPendingBooking(failing.booking!.bookingReference, "payment failed")));
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect((await seats(dep.id)).capacityBooked).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: failing.booking!.id } })).status).toBe("CANCELLED");
  });

  it("does not confirm when the paid amount or currency doesn't match, and flags it", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure();
    const r = await createBooking(guest(dep.id, 11));
    await confirmPaidBooking(r.booking!.bookingReference, { amount: 1, currency: "cad", transactionId: `pi_${r.booking!.bookingReference}` });
    await confirmPaidBooking(r.booking!.bookingReference, { amount: 15000, currency: "usd", transactionId: `pi_${r.booking!.bookingReference}` });
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: r.booking!.id }, include: { payments: true } });
    expect(stored.status).toBe("PENDING_PAYMENT");
    expect(stored.payments[0].status).toBe("PENDING");
    expect(await prisma.auditLog.count({ where: { entityId: stored.id, action: "PAYMENT_AMOUNT_MISMATCH" } })).toBe(2);
  });

  it("records a payment that arrives after the booking expired, without re-booking the seats", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure();
    const r = await createBooking(guest(dep.id, 12));
    await prisma.booking.update({ where: { id: r.booking!.id }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    await createReservationHold({ departureId: dep.id, seatsCount: 1, customerName: "Trigger", customerEmail: "trigger@example.com" }); // runs the lazy expiry

    await confirmPaidBooking(r.booking!.bookingReference, { amount: 15000, currency: "CAD", transactionId: `pi_${r.booking!.bookingReference}` });
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: r.booking!.id }, include: { payments: true } });
    expect(stored.status).toBe("EXPIRED");
    expect(stored.payments[0].status).toBe("SUCCEEDED");
    expect(stored.adminNotes).toMatch(/after the booking was expired/);
    expect(await seats(dep.id)).toEqual({ capacityBooked: 0, capacityHeld: 1 });
  });
});

describe("booking status rules", () => {
  it("allows only the documented moves", async () => {
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "EXPIRED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CANCELLED", "REFUNDED")).toBe(true);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("EXPIRED", "CONFIRMED")).toBe(false);
    expect(canTransition("REFUNDED", "CONFIRMED")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "COMPLETED")).toBe(false);
    await expect(prisma.$transaction((tx) => transitionBooking(tx, "any", ["EXPIRED"], "CONFIRMED"))).rejects.toThrow(/not allowed/);
  });

  it("never confirms from submitting the form, and a double cancel releases seats once", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure({ capacityTotal: 4 });
    const r = await createBooking(guest(dep.id, 13, { adultsCount: 2, childrenCount: 0 }));
    expect(r.booking?.status).toBe("PENDING_PAYMENT");
    await confirmPaidBooking(r.booking!.bookingReference, { amount: 30000, currency: "CAD", transactionId: `pi_${r.booking!.bookingReference}` });
    const both = await Promise.all([1, 2].map(() => cancelBooking(r.booking!.bookingReference, "local.guest13@example.com")));
    expect(both.filter((c) => c.success)).toHaveLength(1);
    expect((await seats(dep.id)).capacityBooked).toBe(0);
  });
});

describe("rollback", () => {
  it("leaves seats, the hold and bookings untouched when the database refuses the booking", async () => {
    const dep = await departure({ capacityTotal: 4 });
    const hold = await createReservationHold({ departureId: dep.id, seatsCount: 2, customerName: "Rollback", customerEmail: "rollback@example.com" });
    // A pickup stop that doesn't exist: the foreign key fails after the seats were taken in the transaction.
    await expect(createBooking({ ...guest(dep.id, 14, { adultsCount: 2, childrenCount: 0 }), holdToken: hold.holdToken, pickupStopId: "no-such-stop" })).rejects.toThrow();
    expect(await seats(dep.id)).toEqual({ capacityBooked: 0, capacityHeld: 2 });
    expect((await prisma.reservationHold.findUniqueOrThrow({ where: { holdToken: hold.holdToken! } })).status).toBe("ACTIVE");
    expect(await prisma.booking.count({ where: { tourDepartureId: dep.id } })).toBe(0);
  });
});

describe("inventory that can't be verified", () => {
  it("refuses holds and bookings on unverified or provider departures, and hides them from listings", async () => {
    for (const source of ["UNVERIFIED", "EXTERNAL"] as const) {
      const dep = await departure({ inventorySource: source });
      const hold = await createReservationHold({ departureId: dep.id, seatsCount: 1, customerName: "No", customerEmail: "no@example.com" });
      expect(hold.success).toBe(false);
      expect(hold.error).toMatch(/enquiry/);
      const booking = await createBooking(guest(dep.id, 15));
      expect(booking.success).toBe(false);
      expect(await seats(dep.id)).toEqual({ capacityBooked: 0, capacityHeld: 0 });

      const listed = (await getTourBySlug(tourSlug))?.departures.map((d) => d.id) ?? [];
      expect(listed).not.toContain(dep.id);
      const checkout = await getCheckoutDeparture(dep.id);
      expect(checkout?.departure.bookable).toBe(false);
      expect(checkout?.departure.notBookableReason).toMatch(/enquiry/);
    }
  });

  it("lists staff-confirmed departures with their source", async () => {
    const dep = await departure();
    const listed = (await getTourBySlug(tourSlug))?.departures.find((d) => d.id === dep.id);
    expect(listed?.inventorySource).toBe("LOCAL");
    expect((await getCheckoutDeparture(dep.id))?.departure.bookable).toBe(true);
  });
});

describe("no Bókun calls without Bókun keys", () => {
  it("holds, books, confirms and cancels without any outbound request", async () => {
    fetchSpy.mockClear();
    const dep = await departure();
    const hold = await createReservationHold({ departureId: dep.id, seatsCount: 1, customerName: "Quiet", customerEmail: "local.guest16@example.com" });
    const r = await createBooking({ ...guest(dep.id, 16), holdToken: hold.holdToken }); // mock payment confirms at once
    expect(r.booking?.status).toBe("CONFIRMED");
    await cancelBooking(r.booking!.bookingReference, "local.guest16@example.com");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.bookingSyncTask.count({ where: { bookingId: r.booking!.id } })).toBe(0);
  });

  it("talks to Bókun only from the Bókun module (docs/BOKUN.md), and keeps the Bókun fields", async () => {
    const files: string[] = [];
    const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : files.push(path.join(dir, e.name))));
    walk(path.resolve(__dirname, "../src"));
    const bokunModule = path.resolve(__dirname, "../src/modules/bokun");
    for (const file of files.filter((f) => !f.startsWith(bokunModule))) expect(fs.readFileSync(file, "utf8")).not.toMatch(/bokun\.(io|com)|api\.bokun/i);

    const dep = await departure();
    const r = await createBooking(guest(dep.id, 17));
    const ref = `BKN-TEST-${Date.now()}`;
    await prisma.booking.update({ where: { id: r.booking!.id }, data: { bokunBookingId: ref } });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: r.booking!.id } })).bokunBookingId).toBe(ref);
  });
});
