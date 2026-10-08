// The paid booking flow: the server prices everything in cents, bookings wait in PENDING_PAYMENT
// until the payment provider confirms, and only a correctly signed Stripe webhook confirms them.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { createBooking, expireUnpaidBookings, refundableAmount } from "@/modules/bookings/booking.repository";
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
    data: { tourId: tour.id, date: dateOnly("2027-05-04"), departureTime: timeOfDay("08:30"), capacityTotal: 12, capacityBooked: 0, capacityHeld: 0, price: 19900, status: "ACTIVE" },
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

function signedEvent(type: string, reference: string) {
  const payload = JSON.stringify({
    id: `evt_${reference}`,
    object: "event",
    type,
    data: { object: { id: `pi_${reference}`, object: "payment_intent", metadata: { bookingReference: reference }, latest_charge: `ch_${reference}` } },
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

  it("keeps the 20% deposit for 7+ guests and multi-day trips", () => {
    expect(refundableAmount(10000, 4, "SHARED")).toBe(10000);
    expect(refundableAmount(10000, 7, "SHARED")).toBe(8000);
    expect(refundableAmount(10000, 2, "MULTIDAY")).toBe(8000);
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

    const { payload, header } = signedEvent("payment_intent.payment_failed", failed);
    await request(createApp()).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", header).send(payload);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: failed } })).status).toBe("CANCELLED");

    expect(await expireUnpaidBookings(new Date(Date.now() + 31 * 60 * 1000))).toBeGreaterThanOrEqual(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { bookingReference: abandoned } })).status).toBe("CANCELLED");
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

  it("does not let the browser choose prices or the payment provider", async () => {
    const res = await request(createApp())
      .post("/api/bookings")
      .send({ ...guest(5), addOns: [{ id: "lunch", price: 0 }], paymentProvider: "mock", totalAmount: 1 });
    expect(res.status).toBe(200);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: res.body.booking.bookingReference } });
    expect(stored.totalAmount).toBe(39800 + 2200 * 2);
  });
});
