// Deposit payments (docs/DEPOSITS.md): a 20% deposit at checkout for departures 15+ days away, the
// balance paid later from the voucher page, refunds that keep only the deposit, and the hourly
// reminders that end in a staff flag 72 hours before departure (never an automatic cancel).

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { cancelBooking, createBooking } from "@/modules/bookings/booking.repository";
import { sendBalanceReminders, startBalancePayment } from "@/modules/bookings/deposit-payments";
import { depositTerms } from "@/modules/bookings/deposit";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { signBookingLink } from "@/lib/security/signed-links";
import { signToken } from "@/lib/auth/auth";
import { dateOnly, getMountainTimeInstant, timeOfDay } from "@/lib/utils/time";

const app = createApp();
const WEBHOOK_SECRET = "whsec_deposit_test";
const unique = () => crypto.randomBytes(5).toString("hex");
let tourId = "";
let day = 0;

// Behaves like Stripe: the guest pays in the browser, and an unfinished intent can be resumed.
const intents = new Map<string, { amount: number; currency: string }>();
const refunds: { transactionId: string; amount?: number }[] = [];
const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    const intentId = `pi_${req.idempotencyKey ?? `booking-${req.bookingReference}`}`;
    intents.set(intentId, { amount: req.amount, currency: req.currency });
    return { clientSecret: `${intentId}_secret`, intentId, amount: req.amount, currency: req.currency, paid: false };
  },
  async retrievePaymentIntent(intentId) {
    const i = intents.get(intentId);
    return i ? { clientSecret: `${intentId}_secret`, intentId, amount: i.amount, currency: i.currency, paid: false } : null;
  },
  async refundPayment(transactionId, amount) {
    refunds.push({ transactionId, amount });
    return { success: true, refundId: `re_${unique()}` };
  },
};

/** A departure `daysAhead` days from now (Banff date, 08:30), $200 a seat. */
async function departure(daysAhead = 60) {
  day += 1;
  const date = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay(`${String(6 + (day % 12)).padStart(2, "0")}:30`), capacityTotal: 12, price: 20000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

const guest = (departureId: string) => ({
  departureId,
  customerName: "Deposit Guest",
  customerEmail: `deposit.${unique()}@example.com`,
  customerPhone: "+1 403 555 0177",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
});

function send(type: string, intentId: string, reference: string, amount: number, kind?: string) {
  const payload = JSON.stringify({
    id: `evt_${unique()}`,
    object: "event",
    type,
    data: { object: { id: intentId, object: "payment_intent", amount, amount_received: type === "payment_intent.succeeded" ? amount : 0, currency: "cad", metadata: { bookingReference: reference, ...(kind ? { kind } : {}) } } },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return request(app).post("/api/webhooks/stripe").set("Stripe-Signature", header).set("Content-Type", "application/json").send(payload);
}

/** A confirmed deposit booking (deposit paid through the webhook). */
async function depositBooking(daysAhead = 60) {
  setPaymentProviderForTests(browserPays);
  const dep = await departure(daysAhead);
  const created = await createBooking({ ...guest(dep.id), paymentPlan: "DEPOSIT" });
  expect(created.success).toBe(true);
  const reference = created.booking!.bookingReference;
  const payment = await prisma.payment.findFirstOrThrow({ where: { booking: { bookingReference: reference } } });
  expect((await send("payment_intent.succeeded", payment.transactionId, reference, payment.amount, "DEPOSIT")).status).toBe(200);
  return { dep, reference, created, depositPayment: payment };
}

const load = (reference: string) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: reference }, include: { payments: true, flags: true, tourDeparture: true } });

beforeAll(async () => {
  tourId = (await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } })).id;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});
afterEach(() => setPaymentProviderForTests(null));
afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("deposit terms", () => {
  it("20% now, balance due 14 days before, only 15+ days ahead", () => {
    const now = new Date("2027-01-01T12:00:00Z");
    const leaves = new Date("2027-01-20T15:30:00Z");
    expect(depositTerms(40000, leaves, now)).toEqual({ depositCents: 8000, balanceDueAt: new Date("2027-01-06T15:30:00Z") });
    expect(depositTerms(40000, new Date("2027-01-15T12:00:00Z"), now)).toBeNull();
    expect(depositTerms(0, leaves, now)).toBeNull();
  });
});

describe("checkout with a deposit", () => {
  it("charges only the deposit and confirms on it; the booking shows what is still owed", async () => {
    const { reference, created, depositPayment } = await depositBooking();
    expect(created.payment?.amount).toBe(80); // 20% of $400
    expect(created.booking?.paymentPlan).toBe("DEPOSIT");
    expect(depositPayment).toMatchObject({ amount: 8000, kind: "DEPOSIT" });

    const booking = await load(reference);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.depositAmount).toBe(8000);
    const due = getMountainTimeInstant(booking.tourDeparture.date, booking.tourDeparture.departureTime).getTime() - 14 * 86_400_000;
    expect(booking.balanceDueAt?.getTime()).toBe(due);

    const read = await request(app).get(`/api/bookings?ref=${reference}&t=${signBookingLink(reference, "voucher")}`);
    expect(read.body.booking).toMatchObject({ paymentPlan: "DEPOSIT", depositAmount: 80, amountPaid: 80, balanceDue: 320 });
  });

  it("My trips shows dollars and what is still owed", async () => {
    const { reference } = await depositBooking();
    const { customerEmail: email } = await load(reference);
    const user = await prisma.user.create({ data: { email, name: "Deposit Guest", passwordHash: "x", role: "CUSTOMER", emailVerified: true } });
    const cookie = `vc_token=${signToken({ userId: user.id, email, role: "CUSTOMER", name: user.name })}`;
    const res = await request(app).get("/api/account/trips").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const trip = res.body.bookings.find((b: { bookingReference: string }) => b.bookingReference === reference);
    expect(trip).toMatchObject({ totalAmount: 400, paymentPlan: "DEPOSIT", depositAmount: 80, amountPaid: 80, balanceDue: 320 });
    expect(trip.payments).toBeUndefined();
  });

  it("is refused for a departure under 15 days away", async () => {
    const dep = await departure(10);
    const result = await createBooking({ ...guest(dep.id), paymentPlan: "DEPOSIT" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("at least 15 days away");
  });

  it("a payment of the full total doesn't confirm a deposit booking (amount mismatch)", async () => {
    setPaymentProviderForTests(browserPays);
    const dep = await departure();
    const created = await createBooking({ ...guest(dep.id), paymentPlan: "DEPOSIT" });
    const reference = created.booking!.bookingReference;
    const payment = await prisma.payment.findFirstOrThrow({ where: { booking: { bookingReference: reference } } });
    await send("payment_intent.succeeded", payment.transactionId, reference, 40000);
    const booking = await load(reference);
    expect(booking.status).toBe("PENDING_PAYMENT");
    expect(booking.flags.map((f) => f.type)).toContain("PAYMENT_AMOUNT_MISMATCH");
  });
});

describe("paying the balance", () => {
  it("resumes one payment for what is owed, records it from the webhook, and a decline leaves the booking alone", async () => {
    const { reference } = await depositBooking();
    const first = await startBalancePayment(reference);
    expect(first).toMatchObject({ ok: true, paid: false, amount: 320 });
    const again = await startBalancePayment(reference);
    expect(again).toMatchObject({ ok: true, paid: false, amount: 320 });
    const balance = await prisma.payment.findMany({ where: { booking: { bookingReference: reference }, kind: "BALANCE" } });
    expect(balance).toHaveLength(1);

    // A declined card: the payment fails, the booking stays confirmed, and the guest can retry.
    await send("payment_intent.payment_failed", balance[0].transactionId, reference, 32000, "BALANCE");
    expect((await load(reference)).status).toBe("CONFIRMED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: balance[0].id } })).status).toBe("FAILED");

    const retry = await startBalancePayment(reference);
    expect(retry).toMatchObject({ ok: true, paid: false, amount: 320 });
    const pending = await prisma.payment.findFirstOrThrow({ where: { booking: { bookingReference: reference }, kind: "BALANCE", status: "PENDING" } });
    await send("payment_intent.succeeded", pending.transactionId, reference, 32000, "BALANCE");
    await send("payment_intent.succeeded", pending.transactionId, reference, 32000, "BALANCE"); // retried delivery

    const paid = await load(reference);
    expect(paid.balancePaidAt).not.toBeNull();
    expect(paid.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0)).toBe(40000);
    expect(await startBalancePayment(reference)).toMatchObject({ ok: true, paid: true });
  });

  it("the voucher page's Pay balance works with the signed link only", async () => {
    const { reference } = await depositBooking();
    expect((await request(app).post("/api/bookings/pay-balance").send({ bookingReference: reference })).status).toBe(404);
    const res = await request(app).post("/api/bookings/pay-balance").send({ bookingReference: reference, t: signBookingLink(reference, "voucher") });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, paid: false, amount: 320, currency: "CAD" });
    expect(res.body.clientSecret).toBeTruthy();
  });

  it("with the instant test provider, the deposit confirms and the balance is paid at once", async () => {
    const dep = await departure();
    const created = await createBooking({ ...guest(dep.id), paymentPlan: "DEPOSIT" });
    expect(created.booking?.status).toBe("CONFIRMED");
    const res = await startBalancePayment(created.booking!.bookingReference);
    expect(res).toMatchObject({ ok: true, paid: true });
    expect((await load(created.booking!.bookingReference)).balancePaidAt).not.toBeNull();
  });
});

describe("cancelling a deposit booking", () => {
  it("paid in full: refunds 80% (the balance) and keeps the deposit", async () => {
    const { reference } = await depositBooking();
    await startBalancePayment(reference);
    const pending = await prisma.payment.findFirstOrThrow({ where: { booking: { bookingReference: reference }, kind: "BALANCE", status: "PENDING" } });
    await send("payment_intent.succeeded", pending.transactionId, reference, 32000, "BALANCE");

    refunds.length = 0;
    setPaymentProviderForTests(browserPays);
    const booking = await load(reference);
    const result = await cancelBooking(reference, booking.customerEmail);
    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(320);
    expect(refunds).toEqual([{ transactionId: pending.transactionId, amount: 32000 }]);
    const after = await load(reference);
    expect(after.payments.find((p) => p.kind === "DEPOSIT")?.status).toBe("SUCCEEDED");
    expect(after.payments.find((p) => p.kind === "BALANCE" && p.id === pending.id)?.status).toBe("REFUNDED");
  });

  it("deposit only: nothing to refund, seats released", async () => {
    const { reference, dep } = await depositBooking();
    refunds.length = 0;
    setPaymentProviderForTests(browserPays);
    const result = await cancelBooking(reference, (await load(reference)).customerEmail);
    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(0);
    expect(refunds).toHaveLength(0);
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).capacityBooked).toBe(0);
  });
});

describe("balance reminders", () => {
  it("reminds 3 days before the due date, on the due date, then flags staff 72 hours before departure, once each", async () => {
    const { reference } = await depositBooking(30);
    const booking = await load(reference);
    const due = booking.balanceDueAt!.getTime();
    const leaves = getMountainTimeInstant(booking.tourDeparture.date, booking.tourDeparture.departureTime).getTime();
    const stage = async () => (await load(reference)).balanceReminderStage;

    await sendBalanceReminders(new Date(due - 5 * 86_400_000));
    expect(await stage()).toBe(0);
    await sendBalanceReminders(new Date(due - 2 * 86_400_000));
    expect(await stage()).toBe(1);
    await sendBalanceReminders(new Date(due - 1 * 86_400_000));
    expect(await stage()).toBe(1);
    await sendBalanceReminders(new Date(due + 3_600_000));
    expect(await stage()).toBe(2);
    await sendBalanceReminders(new Date(leaves - 71 * 3_600_000));
    await sendBalanceReminders(new Date(leaves - 70 * 3_600_000));
    const after = await load(reference);
    expect(after.balanceReminderStage).toBe(3);
    expect(after.status).toBe("CONFIRMED"); // never cancelled automatically
    const flags = after.flags.filter((f) => f.type === "PAYMENT_DUE");
    expect(flags).toHaveLength(1);
    expect(flags[0].amountCents).toBe(32000);
  });

  it("sends only the latest notice when several are due at once, and nothing once paid", async () => {
    const late = await depositBooking(30);
    const lb = await load(late.reference);
    await sendBalanceReminders(new Date(lb.balanceDueAt!.getTime() + 3_600_000));
    expect((await load(late.reference)).balanceReminderStage).toBe(2);

    const paid = await depositBooking(30);
    await startBalancePayment(paid.reference);
    const pending = await prisma.payment.findFirstOrThrow({ where: { booking: { bookingReference: paid.reference }, kind: "BALANCE", status: "PENDING" } });
    await send("payment_intent.succeeded", pending.transactionId, paid.reference, 32000, "BALANCE");
    const pb = await load(paid.reference);
    await sendBalanceReminders(new Date(pb.balanceDueAt!.getTime() + 3_600_000));
    expect((await load(paid.reference)).balanceReminderStage).toBe(0);
  });

  it("a balance paid after staff were flagged closes the flag", async () => {
    const { reference } = await depositBooking(30);
    const b = await load(reference);
    const leaves = getMountainTimeInstant(b.tourDeparture.date, b.tourDeparture.departureTime).getTime();
    await sendBalanceReminders(new Date(leaves - 48 * 3_600_000));
    await startBalancePayment(reference);
    const pending = await prisma.payment.findFirstOrThrow({ where: { booking: { bookingReference: reference }, kind: "BALANCE", status: "PENDING" } });
    await send("payment_intent.succeeded", pending.transactionId, reference, 32000, "BALANCE");
    expect((await load(reference)).flags.find((f) => f.type === "PAYMENT_DUE")?.status).toBe("RESOLVED");
  });
});
