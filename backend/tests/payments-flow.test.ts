// The paid booking flow: the server prices everything in cents, bookings wait in PENDING_PAYMENT
// until the payment provider confirms, and only a correctly signed Stripe webhook confirms them.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { getEmailProvider } from "@/lib/email/email.provider";
import { createBooking, expireUnpaidBookings } from "@/modules/bookings/booking.repository";
import { cancellationTerms, eligibleRefundCents, policyDecision } from "@/modules/bookings/cancellation-policy";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { priceBooking, promoPercent } from "@/modules/pricing/booking-pricing";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

// A provider that behaves like Stripe: the guest still has to pay in the browser.
const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_${req.bookingReference}_secret`, intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment() {
    return { success: true, refundId: "re_test" };
  },
};

const WEBHOOK_SECRET = "whsec_test_secret";
let departureId = "";

beforeAll(async () => {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } });
  const departure = await prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly("2027-05-04"), departureTime: timeOfDay("08:30"), capacityTotal: 12, capacityBooked: 0, capacityHeld: 0, price: 19900, status: "ACTIVE" },
  });
  departureId = departure.id;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterEach(() => setPaymentProviderForTests(null));
afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

const guest = (n: number) => ({
  departureId,
  customerName: `Payer ${n}`,
  customerEmail: `payer${n}@example.com`,
  customerPhone: "+1 403 555 0101",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
});

function signedEvent(type: string, reference: string, amount = 39800, currency = "cad") {
  const payload = JSON.stringify({
    id: `evt_${reference}`,
    object: "event",
    type,
    data: { object: { id: `pi_${reference}`, object: "payment_intent", amount, amount_received: type === "payment_intent.succeeded" ? amount : 0, currency, metadata: { bookingReference: reference }, latest_charge: `ch_${reference}` } },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

describe("pricing", () => {
  it("prices fares, add-ons and promo codes on the server, with no sales tax", () => {
    const totals = priceBooking({ price: 19900, capacityTotal: 12, tour: { category: "SHARED" } }, 2, [{ id: "lunch" }, { id: "parkPass" }, { id: "lunch" }, { name: "Unknown" }], "banff10");
    expect(totals.fareCents).toBe(39800);
    expect(totals.discountCents).toBe(3980);
    expect(totals.addOnsCents).toBe(2200 * 2 + 2500); // lunch per guest, pass once; duplicates ignored
    expect(totals.totalCents).toBe(39800 - 3980 + 6900);
  });

  it("keeps the 100%-off test code out of production", () => {
    const env = process.env.NODE_ENV;
    expect(promoPercent("TESTVISTA100")).toBe(100);
    process.env.NODE_ENV = "production";
    expect(promoPercent("TESTVISTA100")).toBeNull();
    expect(promoPercent("BANFF10")).toBe(10);
    process.env.NODE_ENV = env;
  });

  it("follows the Booking & Cancellation Policy per product type", () => {
    expect(cancellationTerms("SHARED")).toEqual({ cutoffHours: 24, keepPercent: 0 });
    expect(cancellationTerms("SHUTTLE")).toEqual({ cutoffHours: 24, keepPercent: 0 });
    expect(cancellationTerms("PRIVATE")).toEqual({ cutoffHours: 72, keepPercent: 0 });
    expect(cancellationTerms("PRIVATE", true)).toEqual({ cutoffHours: 72, keepPercent: 20 });
    expect(cancellationTerms("MULTIDAY")).toEqual({ cutoffHours: 72, keepPercent: 20 });
    // Group size no longer matters; a private package keeps 20% of the total, not of an instalment.
    expect(eligibleRefundCents(10000, 10000, 0)).toBe(10000);
    expect(eligibleRefundCents(10000, 10000, 20)).toBe(8000);
    expect(eligibleRefundCents(2000, 10000, 20)).toBe(0);
    expect(eligibleRefundCents(2000, 10000, 0)).toBe(2000);
  });

  it("measures the deadline from departure: 24 hours for shared tours, 72 for private, 80% back on packages", async () => {
    const at = new Date("2028-06-10T12:00:00Z");
    const booking = (category: string, hoursAhead: number) => {
      const start = new Date(at.getTime() + hoursAhead * 3_600_000);
      const mt = new Date(start.getTime() - 6 * 3_600_000); // MDT is UTC-6 in June
      return {
        bookingReference: "VC-POLICY",
        totalAmount: 10000,
        priceSnapshot: {},
        payments: [{ status: "SUCCEEDED", amount: 10000 }],
        tourDeparture: { date: dateOnly(mt.toISOString().slice(0, 10)), departureTime: timeOfDay(mt.toISOString().slice(11, 16)), tour: { category } },
      };
    };
    expect((await policyDecision(booking("SHARED", 30), at)).refundCents).toBe(10000);
    expect((await policyDecision(booking("SHUTTLE", 20), at)).refundCents).toBe(0);
    expect((await policyDecision(booking("PRIVATE", 48), at)).refundCents).toBe(0);
    expect((await policyDecision(booking("PRIVATE", 80), at)).refundCents).toBe(10000);
    expect((await policyDecision(booking("MULTIDAY", 80), at)).refundCents).toBe(8000);
  });
});

describe("paid booking flow", () => {
  it("waits for payment, ignores client prices, and stores cents", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createBooking({ ...guest(1), addOns: [{ id: "parkPass", ...({ price: 0.01 } as object) }] });
    expect(result.success).toBe(true);
    expect(result.booking?.status).toBe("PENDING_PAYMENT");
    expect(result.payment?.clientSecret).toMatch(/^pi_/);

    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: result.booking!.bookingReference }, include: { payments: true, items: true } });
    expect(stored.totalAmount).toBe(39800 + 2500);
    expect(stored.items[0].price).toBe(2500);
    expect(stored.payments[0]).toMatchObject({ amount: 42300, status: "PENDING", provider: "stripe" });
  });

  it("confirms only on a correctly signed Stripe webhook", async () => {
    setPaymentProviderForTests(browserPays);
    const { booking } = await createBooking(guest(2));
    const reference = booking!.bookingReference;
    const app = createApp();

    const forged = await request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", "t=1,v1=bad").send(signedEvent("payment_intent.succeeded", reference).payload);
    expect(forged.status).toBe(400);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: reference } })).status).toBe("PENDING_PAYMENT");

    const { payload, header } = signedEvent("payment_intent.succeeded", reference);
    const ok = await request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", header).send(payload);
    expect(ok.status).toBe(200);
    const confirmed = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: reference }, include: { payments: true } });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.payments[0].status).toBe("SUCCEEDED");

    // Stripe retries are harmless.
    const again = await request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", header).send(payload);
    expect(again.status).toBe(200);
  });

  it("releases the seats when the payment fails or is never completed", async () => {
    setPaymentProviderForTests(browserPays);
    const failed = (await createBooking(guest(3))).booking!.bookingReference;
    const abandoned = (await createBooking(guest(4))).booking!.bookingReference;

    const send = vi.spyOn(getEmailProvider(), "sendEmail");
    const { payload, header } = signedEvent("payment_intent.payment_failed", failed);
    await request(createApp()).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", header).send(payload);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: failed } })).status).toBe("CANCELLED");
    // The guest is told once; Stripe retrying the event sends nothing more.
    await request(createApp()).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", header).send(payload);
    const told = send.mock.calls.filter(([e]) => e.subject.includes("payment didn't go through") && e.subject.includes(failed));
    expect(told).toHaveLength(1);
    send.mockRestore();

    // Back-date the payment window of this departure's unpaid bookings only: expiring "31 minutes
    // from now" would also expire other test files' pending bookings running at the same time.
    await prisma.booking.updateMany({ where: { tourDepartureId: departureId, status: "PENDING_PAYMENT" }, data: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireUnpaidBookings()).toBeGreaterThanOrEqual(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: abandoned } })).status).toBe("EXPIRED");
    // Seats still taken are exactly those of paid (confirmed) bookings.
    const paid = await prisma.booking.aggregate({ where: { tourDepartureId: departureId, status: "CONFIRMED" }, _sum: { totalSeats: true } });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: departureId } })).capacityBooked).toBe(paid._sum.totalSeats ?? 0);
  });
});

describe("API protections", () => {
  it("refuses state-changing requests from another site", async () => {
    const res = await request(createApp()).post("/api/bookings/cancel").set("Origin", "https://evil.example").send({ bookingReference: "VC-2026-AAAAAAAA" });
    expect(res.status).toBe(403);
  });

  it("does not let the browser choose prices, add-ons or the payment provider", async () => {
    const res = await request(createApp())
      .post("/api/bookings")
      .send({ ...guest(5), addOns: [{ id: "lunch", price: 0 }], paymentProvider: "mock", totalAmount: 1 });
    expect(res.status).toBe(200);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: res.body.booking.bookingReference } });
    // Checkout has no add-ons any more: the lunch the request asked for is not charged.
    expect(stored.totalAmount).toBe(39800);
  });
});
