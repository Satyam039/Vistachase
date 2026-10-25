// Two-Day Rockies Explorer: both day tours booked together, 10% off, one payment for both. Covers
// the API, the Stripe webhook confirming both days on the full amount, releasing day 1 when day 2
// can't be booked, and refunds of one day landing on that day's booking.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { setPaymentProviderForTests, stripeId, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { createPackageBooking } from "@/modules/bookings/package-booking";
import { cancelBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const refunds: { transactionId: string; amount?: number; metadata?: Record<string, string> }[] = [];
const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_pkg_${req.bookingReference}_secret`, intentId: `pi_pkg_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment(transactionId, amount, metadata) {
    refunds.push({ transactionId, amount, metadata });
    return { success: true, refundId: `re_${refunds.length}_${Date.now()}` };
  },
  async retrievePaymentIntent(intentId) {
    return { clientSecret: `${stripeId(intentId)}_secret`, intentId: stripeId(intentId), amount: 0, currency: "CAD", paid: false };
  },
};

const WEBHOOK_SECRET = "whsec_package_secret";
let day1 = "";
let day2 = "";
let day2Full = "";
let sameDay2 = "";

async function departure(slug: string, date: string, capacityBooked = 0) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  const d = await prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("08:30"), capacityTotal: 12, capacityBooked, capacityHeld: 0, price: slug === "banff-highlights-tour" ? 18900 : 22900, status: "ACTIVE" },
  });
  return d.id;
}

beforeAll(async () => {
  day1 = await departure("banff-highlights-tour", "2027-06-14");
  day2 = await departure("shared-tours-icefields-jasper", "2027-06-15");
  day2Full = await departure("shared-tours-icefields-jasper", "2027-06-16", 12);
  sameDay2 = await departure("shared-tours-icefields-jasper", "2027-06-14");
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterEach(() => setPaymentProviderForTests(null));
afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

const guest = (n: number, departureIds = [day1, day2]) => ({
  packageSlug: "two-day-rockies-explorer",
  departureIds,
  customerName: `Two Day ${n}`,
  customerEmail: `twoday${n}@example.com`,
  customerPhone: "+1 403 555 0101",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
});

function signed(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}_${Math.random()}`, object: "event", type, data: { object } });
  return { payload, header: Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) };
}

const post = (app: ReturnType<typeof createApp>, e: { payload: string; header: string }) =>
  request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", e.header).send(e.payload);

describe("two-day package", () => {
  it("books both days with 10% off and starts one payment for the sum", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createPackageBooking(guest(1));
    expect(result.success).toBe(true);
    expect(result.bookings).toHaveLength(2);
    // (2 x 189 - 10%) + (2 x 229 - 10%)
    expect(result.totalAmount).toBe(340.2 + 412.2);
    expect(result.payment?.amount).toBe(752.4);

    const [a, b] = await Promise.all(result.bookings!.map((x) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: x.bookingReference }, include: { payments: true } })));
    expect(a.tourDepartureId).toBe(day1);
    expect(b.tourDepartureId).toBe(day2);
    expect(a.payments[0]).toMatchObject({ amount: 34020, status: "PENDING" });
    expect(b.payments[0]).toMatchObject({ amount: 41220, status: "PENDING", transactionId: `${a.payments[0].transactionId}:2` });
    expect((a.priceSnapshot as { package?: { references: string[] } }).package?.references).toEqual([a.bookingReference, b.bookingReference]);
    expect(a.adminNotes).toContain(b.bookingReference);
  });

  it("confirms both days only when Stripe reports the full package amount", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createPackageBooking(guest(2));
    const refs = result.bookings!.map((b) => b.bookingReference);
    const intentId = `pi_pkg_${refs[0]}`;
    const app = createApp();
    const intent = (amount: number) => ({ id: intentId, object: "payment_intent", amount, amount_received: amount, currency: "cad", metadata: { bookingReference: refs[0], kind: "PACKAGE", packageRefs: refs.join(",") } });

    // Only day 1's share: not enough, nothing confirmed.
    expect((await post(app, signed("payment_intent.succeeded", intent(34020)))).status).toBe(200);
    const after = await prisma.booking.findMany({ where: { bookingReference: { in: refs } } });
    expect(after.map((b) => b.status)).toEqual(["PENDING_PAYMENT", "PENDING_PAYMENT"]);

    expect((await post(app, signed("payment_intent.succeeded", intent(75240)))).status).toBe(200);
    const paid = await prisma.booking.findMany({ where: { bookingReference: { in: refs } }, include: { payments: true } });
    expect(paid.map((b) => b.status)).toEqual(["CONFIRMED", "CONFIRMED"]);
    expect(paid.flatMap((b) => b.payments.map((p) => p.status))).toEqual(["SUCCEEDED", "SUCCEEDED"]);
  });

  it("releases day 1 when day 2 is sold out, and refuses the same date twice", async () => {
    setPaymentProviderForTests(browserPays);
    const before = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: day1 } });
    const full = await createPackageBooking(guest(3, [day1, day2Full]));
    expect(full.success).toBe(false);
    expect(full.error).toMatch(/^Day 2:/);
    const afterSeats = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: day1 } });
    expect(afterSeats.capacityBooked).toBe(before.capacityBooked);

    const same = await createPackageBooking(guest(4, [day1, sameDay2]));
    expect(same.success).toBe(false);
    expect(same.error).toMatch(/different days/);

    const swapped = await createPackageBooking(guest(5, [day2, day1]));
    expect(swapped.success).toBe(false);
  });

  it("answers a retried checkout with the same two bookings", async () => {
    setPaymentProviderForTests(browserPays);
    const app = createApp();
    const key = "pkg-retry-key-0123456789";
    const first = await request(app).post("/api/bookings/package").set("Idempotency-Key", key).send(guest(6));
    expect(first.status).toBe(200);
    const again = await request(app).post("/api/bookings/package").set("Idempotency-Key", key).send(guest(6));
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.bookings.map((b: { bookingReference: string }) => b.bookingReference)).toEqual(first.body.bookings.map((b: { bookingReference: string }) => b.bookingReference));
    expect(again.body.payment.amount).toBe(752.4);
  });

  it("refunds a cancelled day from the shared payment, tagged with that day's booking", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createPackageBooking(guest(7));
    const refs = result.bookings!.map((b) => b.bookingReference);
    const app = createApp();
    const intentId = `pi_pkg_${refs[0]}`;
    await post(app, signed("payment_intent.succeeded", { id: intentId, object: "payment_intent", amount: 75240, amount_received: 75240, currency: "cad", metadata: { bookingReference: refs[0], kind: "PACKAGE", packageRefs: refs.join(",") } }));

    refunds.length = 0;
    const cancelled = await cancelBooking(refs[1], "twoday7@example.com");
    expect(cancelled.success).toBe(true);
    expect(refunds).toEqual([{ transactionId: `${intentId}:2`, amount: 41220, metadata: { bookingReference: refs[1] } }]);

    // Stripe then reports the partial refund on the shared charge: day 1 stays confirmed, no flag.
    const charge = { id: `ch_${refs[0]}`, object: "charge", payment_intent: intentId, amount: 75240, amount_refunded: 41220, refunds: { data: [{ id: "re_x", amount: 41220, status: "succeeded", metadata: { bookingReference: refs[1] } }] } };
    expect((await post(app, signed("charge.refunded", charge))).status).toBe(200);
    const [a, b] = await Promise.all(refs.map((r) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: r }, include: { flags: true } })));
    expect(a.status).toBe("CONFIRMED");
    expect(a.flags).toHaveLength(0);
    expect(b.status).toBe("REFUNDED");

    // A refund made in the Stripe dashboard can't be pinned to a day: staff get one flag.
    const dashboard = { ...charge, amount_refunded: 51220, refunds: { data: [...charge.refunds.data, { id: "re_dash", amount: 10000, status: "succeeded", metadata: {} }] } };
    await post(app, signed("charge.refunded", dashboard));
    const flagged = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: refs[0] }, include: { flags: true } });
    expect(flagged.flags).toHaveLength(1);
    expect(flagged.flags[0].note).toContain("refunded in Stripe");
  });
});
