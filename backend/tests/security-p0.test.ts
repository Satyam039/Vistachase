// P0 security fixes (docs/SECURITY_HARDENING.md): bookings follow a verified email, guests cancel
// only with the signed voucher link or as the signed-in owner, an unverified account made staff is
// reset and its sign-ins end, a password reset ends earlier sign-ins, a failed guest refund leaves a
// "Refund owed" flag, Stripe refunds update the payment and flag active bookings, and email logs hide
// link tokens.

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { createBooking } from "@/modules/bookings/booking.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { signBookingLink } from "@/lib/security/signed-links";
import { redactTokens } from "@/lib/email/email.provider";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const app = createApp();
const WEBHOOK_SECRET = "whsec_security_p0";
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const unique = () => crypto.randomBytes(5).toString("hex");
let tourId = "";
let adminCookie = "";
let day = 0;

const cookieFor = (u: { id: string; email: string; role: string; name: string }, iat?: number) =>
  `vc_token=${
    iat === undefined
      ? signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name })
      : jwt.sign({ userId: u.id, email: u.email, role: u.role, name: u.name, iat }, process.env.JWT_SECRET!, { expiresIn: "7d" })
  }`;

async function departure() {
  day += 1;
  const date = new Date(Date.UTC(2028, 6, 1 + day)).toISOString().slice(0, 10);
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay("08:30"), capacityTotal: 10, price: 15000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

/** A paid, confirmed guest booking (the test payment provider pays at once). */
async function guestBooking(email: string) {
  const dep = await departure();
  const result = await createBooking({ departureId: dep.id, customerName: "Guest Owner", customerEmail: email, customerPhone: "+1 403 555 0100", adultsCount: 2, childrenCount: 0, infantsCount: 0 });
  expect(result.booking?.status).toBe("CONFIRMED");
  return prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id }, include: { payments: true } });
}

async function customer(email: string, extra: Partial<{ emailVerified: boolean; verificationToken: string; resetToken: string; resetTokenExpiry: Date }> = {}) {
  return prisma.user.create({ data: { email, name: "Someone", passwordHash: "x", role: "CUSTOMER", ...extra } });
}

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  tourId = (await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } })).id;
  adminCookie = cookieFor(await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }));
});
afterEach(() => setPaymentProviderForTests(null));
afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("email verification", () => {
  it("an unverified account can't see, open or cancel bookings made with its email; verifying links them", async () => {
    const email = `victim.${unique()}@example.com`;
    const booking = await guestBooking(email);
    const token = crypto.randomBytes(32).toString("hex");
    const attacker = await customer(email, { verificationToken: sha256(token) });
    const cookie = cookieFor(attacker);

    const trips = await request(app).get("/api/account/trips").set("Cookie", cookie);
    expect(trips.status).toBe(200);
    expect(trips.body.emailVerified).toBe(false);
    expect(trips.body.bookings).toHaveLength(0);
    expect((await request(app).get(`/api/bookings?ref=${booking.bookingReference}`).set("Cookie", cookie)).status).toBe(404);
    expect((await request(app).post("/api/bookings/cancel").set("Cookie", cookie).send({ bookingReference: booking.bookingReference })).status).toBe(403);

    // The link in the welcome email proves the inbox: now the bookings are the account's.
    expect((await request(app).post("/api/auth/verify-email").send({ token })).status).toBe(200);
    expect((await request(app).post("/api/auth/verify-email").send({ token })).status).toBe(400); // works once
    const after = await request(app).get("/api/account/trips").set("Cookie", cookie);
    expect(after.body.emailVerified).toBe(true);
    expect(after.body.bookings.map((b: { bookingReference: string }) => b.bookingReference)).toContain(booking.bookingReference);
    expect(after.body.bookings[0]).not.toHaveProperty("adminNotes");
    expect(after.body.bookings[0]).not.toHaveProperty("trackingToken");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).customerId).toBe(attacker.id);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).body.user.emailVerified).toBe(true);
  });

  it("registering sends a confirmation and links nothing until it is used", async () => {
    const email = `new.${unique()}@example.com`;
    const booking = await guestBooking(email);
    const res = await request(app).post("/api/auth/register").send({ name: "New Person", email, password: "longpassword1" });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.verificationToken).toMatch(/^[a-f0-9]{64}$/);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).customerId).toBeNull();
  });
});

describe("guest cancel", () => {
  it("needs the voucher link's token: the booking email alone is refused", async () => {
    const email = `cancel.${unique()}@example.com`;
    const booking = await guestBooking(email);
    const byEmail = await request(app).post("/api/bookings/cancel").send({ bookingReference: booking.bookingReference, email });
    expect(byEmail.status).toBe(403);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");

    const byLink = await request(app).post("/api/bookings/cancel").send({ bookingReference: booking.bookingReference, t: signBookingLink(booking.bookingReference, "voucher") });
    expect(byLink.status).toBe(200);
    expect(byLink.body.success).toBe(true);
  });

  it("a refund that fails leaves a Refund owed flag for staff", async () => {
    const email = `refundfail.${unique()}@example.com`;
    const booking = await guestBooking(email);
    const failing: IPaymentProvider = {
      name: "mock",
      async createPaymentIntent(req) {
        return { clientSecret: "x", intentId: `mock_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: true };
      },
      async refundPayment() {
        throw new Error("card_declined");
      },
    };
    setPaymentProviderForTests(failing);
    const res = await request(app).post("/api/bookings/cancel").send({ bookingReference: booking.bookingReference, t: signBookingLink(booking.bookingReference, "voucher") });
    expect(res.status).toBe(200);
    const flags = await prisma.bookingFlag.findMany({ where: { bookingId: booking.id } });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ type: "REFUND_DUE", status: "OPEN", amountCents: booking.payments[0].amount });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
  });
});

describe("sessions and staff accounts", () => {
  it("making an unverified account staff resets its password and ends its sign-ins", async () => {
    const email = `future.staff.${unique()}@example.com`;
    const squatter = await customer(email);
    const oldCookie = cookieFor(squatter, Math.floor(Date.now() / 1000) - 60);

    const res = await request(app).post("/api/admin/staff").set("Cookie", adminCookie).send({ email, role: "OPERATOR" });
    expect(res.status).toBe(200);
    expect(res.body.invited).toBe(true);
    expect(res.body.setupLink).toMatch(/reset-password\?token=[a-f0-9]{64}$/);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: squatter.id } });
    expect(after.role).toBe("OPERATOR");
    expect(after.passwordHash).not.toBe("x");
    expect(after.sessionsValidAfter).not.toBeNull();
    // The squatter's earlier sign-in no longer works, so it never reaches staff pages.
    expect((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).body.authenticated).toBe(false);
    expect((await request(app).get("/api/admin/staff").set("Cookie", oldCookie)).status).toBe(403);
  });

  it("making a verified account staff keeps its password", async () => {
    const email = `verified.staff.${unique()}@example.com`;
    const owner = await customer(email, { emailVerified: true });
    const res = await request(app).post("/api/admin/staff").set("Cookie", adminCookie).send({ email, role: "VIEWER" });
    expect(res.status).toBe(200);
    expect(res.body.invited).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).passwordHash).toBe("x");
  });

  it("a password reset ends earlier sign-ins and verifies the email", async () => {
    const token = crypto.randomBytes(32).toString("hex");
    const user = await customer(`reset.${unique()}@example.com`, { resetToken: sha256(token), resetTokenExpiry: new Date(Date.now() + 3600_000) });
    const oldCookie = cookieFor(user, Math.floor(Date.now() / 1000) - 60);
    expect((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).body.authenticated).toBe(true);

    expect((await request(app).post("/api/auth/reset-password").send({ token, newPassword: "a-new-password" })).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).body.authenticated).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "a-new-password" });
    expect(login.status).toBe(200);
    const fresh = String(login.headers["set-cookie"]).split(";")[0];
    expect((await request(app).get("/api/auth/me").set("Cookie", fresh)).body.authenticated).toBe(true);
  });
});

describe("Stripe refund webhook", () => {
  const send = (type: string, object: Record<string, unknown>) => {
    const payload = JSON.stringify({ id: `evt_${unique()}`, object: "event", type, data: { object } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return request(app).post("/api/webhooks/stripe").set("Stripe-Signature", header).set("Content-Type", "application/json").send(payload);
  };

  it("a dashboard refund on an active booking marks the payment and raises one flag", async () => {
    const booking = await guestBooking(`stripe.${unique()}@example.com`);
    const payment = booking.payments[0];
    const charge = { id: `ch_${unique()}`, object: "charge", payment_intent: payment.transactionId, amount: payment.amount, amount_refunded: payment.amount, refunds: { object: "list", data: [] } };
    expect((await send("charge.refunded", charge)).status).toBe(200);
    expect((await send("charge.refunded", charge)).status).toBe(200); // retried delivery

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("REFUNDED");
    const flags = await prisma.bookingFlag.findMany({ where: { bookingId: booking.id } });
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe("OTHER");
    expect(flags[0].note).toContain("refunded in Stripe");
  });

  it("a partial refund leaves the payment as paid", async () => {
    const booking = await guestBooking(`partial.${unique()}@example.com`);
    const payment = booking.payments[0];
    const charge = { id: `ch_${unique()}`, object: "charge", payment_intent: payment.transactionId, amount: payment.amount, amount_refunded: 1000, refunds: { object: "list", data: [] } };
    expect((await send("charge.refunded", charge)).status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
  });

  it("accepts refund.* events", async () => {
    const booking = await guestBooking(`refundevt.${unique()}@example.com`);
    const res = await send("refund.created", { id: `re_${unique()}`, object: "refund", amount: 500, status: "succeeded", payment_intent: booking.payments[0].transactionId });
    expect(res.status).toBe(200);
  });
});

describe("email logs", () => {
  it("hide every kind of link token", () => {
    const hex64 = "a".repeat(64);
    const out = redactTokens(`reset ${hex64} voucher https://x/booking/VC-1/voucher?t=0123456789abcdef0123456789abcdef checkin ?ref=VC-1&sig=abc`);
    expect(out).not.toContain(hex64);
    expect(out).not.toContain("0123456789abcdef");
    expect(out).not.toContain("sig=abc");
    expect(out).toContain("VC-1");
  });
});
