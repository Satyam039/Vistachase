// A paid booking is confirmed even when Stripe's webhook never arrives (the checkout's poll, the
// voucher and the expiry sweep ask Stripe), and the voucher downloads as a real PDF.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import { PDFDocument } from "pdf-lib";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { createBooking } from "@/modules/bookings/booking.repository";
import { freeExpiredSeats } from "@/modules/departures/inventory";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { signBookingLink } from "@/lib/security/signed-links";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

/** Behaves like Stripe; `paidIntents` are the intents Stripe reports as succeeded. */
const paidIntents = new Map<string, number>();
const stripeLike: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_${req.bookingReference}_secret`, intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async retrievePaymentIntent(intentId) {
    const received = paidIntents.get(intentId);
    return { clientSecret: `${intentId}_secret`, intentId, amount: received ?? 0, currency: "CAD", paid: received !== undefined, amountReceived: received ?? 0, metadata: { kind: "FULL" } };
  },
  async refundPayment() {
    return { success: true, refundId: "re_test" };
  },
};

let tourId = "";
let day = 0;

async function departure() {
  day += 1;
  return prisma.tourDeparture.create({
    data: {
      tourId,
      date: dateOnly(new Date(Date.UTC(2027, 9, 1 + day)).toISOString().slice(0, 10)),
      departureTime: timeOfDay("08:30"),
      returnTime: timeOfDay("17:00"),
      capacityTotal: 6,
      price: 15000,
      childPrice: 9000,
      status: "ACTIVE",
      inventorySource: "LOCAL",
    },
  });
}

async function pendingBooking(n: number) {
  const dep = await departure();
  const result = await createBooking({
    departureId: dep.id,
    customerName: `Sync Guest ${n} Ünïcødé ☃`,
    customerEmail: `sync.guest${n}@example.com`,
    customerPhone: "+1 403 555 0101",
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
  });
  expect(result.success).toBe(true);
  const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: result.booking!.bookingReference } });
  expect(booking.status).toBe("PENDING_PAYMENT");
  return { dep, booking };
}

beforeAll(async () => {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
  tourId = tour.id;
});

afterEach(() => {
  setPaymentProviderForTests(null);
  paidIntents.clear();
});

describe("payment confirmed without the webhook", () => {
  it("the checkout's poll confirms a booking Stripe says is paid", async () => {
    setPaymentProviderForTests(stripeLike);
    const { booking } = await pendingBooking(1);
    const app = createApp();
    const url = `/api/bookings?ref=${booking.bookingReference}&t=${signBookingLink(booking.bookingReference, "voucher")}`;

    // Not paid yet: stays pending.
    expect((await request(app).get(url)).body.booking.status).toBe("PENDING_PAYMENT");

    paidIntents.set(`pi_${booking.bookingReference}`, booking.totalAmount);
    const res = await request(app).get(url);
    expect(res.body.booking.status).toBe("CONFIRMED");
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(payment.status).toBe("SUCCEEDED");
  });

  it("never confirms a payment for the wrong amount", async () => {
    setPaymentProviderForTests(stripeLike);
    const { booking } = await pendingBooking(2);
    paidIntents.set(`pi_${booking.bookingReference}`, 100);
    const res = await request(createApp()).get(`/api/bookings?ref=${booking.bookingReference}&t=${signBookingLink(booking.bookingReference, "voucher")}`);
    expect(res.body.booking.status).toBe("PENDING_PAYMENT");
    expect(await prisma.bookingFlag.count({ where: { bookingId: booking.id, type: "PAYMENT_AMOUNT_MISMATCH" } })).toBe(1);
  });

  it("the expiry sweep confirms a paid booking instead of releasing its seats", async () => {
    setPaymentProviderForTests(stripeLike);
    const { dep, booking } = await pendingBooking(3);
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
    paidIntents.set(`pi_${booking.bookingReference}`, booking.totalAmount);

    await freeExpiredSeats({ departureId: dep.id });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe("CONFIRMED");
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).capacityBooked).toBe(2);
  });

  it("the expiry sweep still expires an unpaid booking", async () => {
    setPaymentProviderForTests(stripeLike);
    const { dep, booking } = await pendingBooking(4);
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
    await freeExpiredSeats({ departureId: dep.id });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("EXPIRED");
  });
});

describe("voucher PDF", () => {
  it("downloads a valid one-page PDF with the voucher link's token", async () => {
    setPaymentProviderForTests(stripeLike);
    const { booking } = await pendingBooking(5);
    paidIntents.set(`pi_${booking.bookingReference}`, booking.totalAmount);
    const res = await request(createApp())
      .get(`/api/bookings/voucher.pdf?ref=${booking.bookingReference}&t=${signBookingLink(booking.bookingReference, "voucher")}`)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`vista-chase-voucher-${booking.bookingReference}.pdf`);
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(body);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toContain(booking.bookingReference);
  });

  it("is refused without the token, a session or staff", async () => {
    setPaymentProviderForTests(stripeLike);
    const { booking } = await pendingBooking(6);
    const res = await request(createApp()).get(`/api/bookings/voucher.pdf?ref=${booking.bookingReference}`);
    expect(res.status).toBe(404);
    const forged = await request(createApp()).get(`/api/bookings/voucher.pdf?ref=${booking.bookingReference}&t=nope`);
    expect(forged.status).toBe(404);
  });
});
