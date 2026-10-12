// Partner commission ledger: rules, earning on verified payment only, idempotency, refund
// reversals, approval, payouts, admin controls, partner data isolation, clicks and reports.
// Mock payment provider and a test database only: nothing is charged or paid out.

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { applyAffiliate } from "@/modules/affiliates/affiliate.repository";
import { approveMaturedCommissions, commissionFor, commissionTotals, resolveRule, reverseCommissionForRefund } from "@/modules/affiliates/commission";
import { createPayout, markPayoutPaid, cancelPayout } from "@/modules/affiliates/payouts";
import { cancelBooking, confirmPaidBooking, createBooking } from "@/modules/bookings/booking.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const app = createApp();
const unique = () => Math.random().toString(36).slice(2, 8);
const WEBHOOK_SECRET = "whsec_ledger_test";

let adminCookie = "";
let adminId = "";

const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_${req.bookingReference}_secret`, intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment() {
    return { success: true, refundId: `re_${unique()}` };
  },
};

const cookieFor = (u: { id: string; email: string; role: string; name: string }) =>
  `vc_token=${signToken({ userId: u.id, email: u.email, role: u.role as "ADMIN", name: u.name })}`;

async function activePartner(rate = 0.1) {
  const id = unique();
  const email = `partner-${id}@example.com`;
  const applied = await applyAffiliate({ name: `Lodge ${id}`, contactName: `Owner ${id}`, email, password: "a-long-password", type: "HOTEL" });
  if (!applied.success) throw new Error("apply failed");
  const affiliate = await prisma.affiliate.update({ where: { code: applied.affiliate.code }, data: { status: "ACTIVE", commissionRate: rate }, include: { user: true } });
  return { affiliate, cookie: cookieFor(affiliate.user), email };
}

async function departure(date = "2027-09-15", price = 10000) {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("09:00"), capacityTotal: 40, price, status: "ACTIVE" },
  });
}

function bookFor(code: string, departureId: string, adults = 1) {
  const id = unique();
  return createBooking({ departureId, customerName: "Guest Ledger", customerEmail: `guest-${id}@example.com`, customerPhone: "+1-403-555-0100", adultsCount: adults, childrenCount: 0, infantsCount: 0, affiliateCode: code });
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminId = admin.id;
  adminCookie = cookieFor(admin);
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});
afterEach(() => setPaymentProviderForTests(null));
afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("commission rules", () => {
  it("uses the most specific active rule, and the partner's own rate when there is none", async () => {
    const { affiliate } = await activePartner(0.1);
    const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } });
    expect(await resolveRule(prisma, affiliate, tour)).toMatchObject({ ruleId: null, percentBps: 1000 });

    const category = await prisma.commissionRule.create({ data: { name: `shared ${unique()}`, affiliateId: affiliate.id, category: "SHARED", percentBps: 1500 } });
    const fixed = await prisma.commissionRule.create({ data: { name: `tour ${unique()}`, affiliateId: affiliate.id, tourId: tour.id, fixedCents: 2500 } });
    expect((await resolveRule(prisma, affiliate, tour)).ruleId).toBe(fixed.id);
    await prisma.commissionRule.update({ where: { id: fixed.id }, data: { active: false } });
    expect((await resolveRule(prisma, affiliate, tour)).ruleId).toBe(category.id);
    // A rule for another category doesn't apply.
    const privateTour = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } });
    expect((await resolveRule(prisma, affiliate, privateTour)).ruleId).toBeNull();
  });

  it("computes a percentage rounded half up and caps a fixed amount at the amount paid", () => {
    expect(commissionFor(10005, { percentBps: 1000, fixedCents: null })).toBe(1001); // 1000.5 → 1001
    expect(commissionFor(10000, { percentBps: null, fixedCents: 2500 })).toBe(2500);
    expect(commissionFor(1000, { percentBps: null, fixedCents: 2500 })).toBe(1000);
    expect(commissionFor(0, { percentBps: 1000, fixedCents: null })).toBe(0);
  });

  it("refuses a rule that is both, or neither, a percentage and a fixed amount (database check)", async () => {
    await expect(prisma.commissionRule.create({ data: { name: "bad", percentBps: 1000, fixedCents: 100 } })).rejects.toThrow();
    await expect(prisma.commissionRule.create({ data: { name: "bad" } })).rejects.toThrow();
  });
});

describe("earning and reversing commission", () => {
  it("earns once, only on a verified payment, and a rate change doesn't rewrite it", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure();

    setPaymentProviderForTests(browserPays);
    const pending = await bookFor(affiliate.code, dep.id, 2);
    expect(pending.booking!.status).toBe("PENDING_PAYMENT");
    expect(await prisma.commissionLedger.count({ where: { affiliateId: affiliate.id } })).toBe(0); // a submitted form earns nothing

    const verified = { amount: pending.booking!.totalAmount * 100, currency: "CAD", transactionId: `pi_${pending.booking!.bookingReference}` };
    // Webhook retried three times at once.
    await Promise.all([1, 2, 3].map(() => confirmPaidBooking(pending.booking!.bookingReference, verified)));
    const lines = await prisma.commissionLedger.findMany({ where: { affiliateId: affiliate.id } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ type: "EARNED", status: "PENDING", basisCents: 20000, amountCents: 2000 });

    await prisma.affiliate.update({ where: { id: affiliate.id }, data: { commissionRate: 0.3 } });
    expect((await commissionTotals(affiliate.id)).netCents).toBe(2000);
  });

  it("does not confirm or earn when the paid amount doesn't match", async () => {
    const { affiliate } = await activePartner();
    const dep = await departure();
    setPaymentProviderForTests(browserPays);
    const b = await bookFor(affiliate.code, dep.id);
    await confirmPaidBooking(b.booking!.bookingReference, { amount: 1, currency: "CAD", transactionId: `pi_${b.booking!.bookingReference}` });
    expect(await prisma.commissionLedger.count({ where: { affiliateId: affiliate.id } })).toBe(0);
  });

  it("reverses in proportion to each refund, once per refund id, never more than earned", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure();
    const b = await bookFor(affiliate.code, dep.id, 2); // $200 paid, $20 commission
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: b.booking!.bookingReference } });

    const first = await reverseCommissionForRefund(booking.id, "re_part_1", 5000, "partial refund");
    expect(first!.amountCents).toBe(-500);
    expect(await reverseCommissionForRefund(booking.id, "re_part_1", 5000, "retry")).toMatchObject({ id: first!.id }); // same refund: no new line
    await reverseCommissionForRefund(booking.id, "re_part_2", 50000, "over-refund"); // more than paid
    const totals = await commissionTotals(affiliate.id);
    expect(totals.netCents).toBe(0);
    expect(totals.reversedCents).toBe(2000);
  });

  it("a refund after payout comes off the next payout", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure();
    const b = await bookFor(affiliate.code, dep.id);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: b.booking!.bookingReference } });
    await prisma.commissionLedger.updateMany({ where: { bookingId: booking.id }, data: { status: "APPROVED" } });
    const payout = await createPayout({ affiliateId: affiliate.id, staffId: adminId });
    expect(payout.ok && payout.payout.amountCents).toBe(1000);
    if (!payout.ok) return;
    await markPayoutPaid({ payoutId: payout.payout.id, reference: "ETR-1", staffId: adminId });

    const reversal = await reverseCommissionForRefund(booking.id, `re_${unique()}`, 10000, "refund in Stripe");
    expect(reversal).toMatchObject({ status: "APPROVED", amountCents: -1000, payoutId: null });
    // Nothing positive is payable now, so no payout can be drafted.
    expect((await createPayout({ affiliateId: affiliate.id, staffId: adminId })).ok).toBe(false);
  });

  it("guest cancellation reverses through the provider's refund id, and the Stripe webhook for it is a no-op", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure();
    const refundId = `re_${unique()}`;
    setPaymentProviderForTests({ ...browserPays, async refundPayment() { return { success: true, refundId }; } });
    const b = await bookFor(affiliate.code, dep.id);
    const reference = b.booking!.bookingReference;
    const intentId = `pi_${reference}`;
    await confirmPaidBooking(reference, { amount: b.booking!.totalAmount * 100, currency: "CAD", transactionId: intentId });
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: reference } });
    expect((await cancelBooking(reference, booking.customerEmail)).success).toBe(true);
    expect((await commissionTotals(affiliate.id)).netCents).toBe(0);

    const payload = JSON.stringify({
      id: `evt_${unique()}`,
      object: "event",
      type: "charge.refunded",
      data: { object: { id: `ch_${reference}`, object: "charge", payment_intent: intentId, refunds: { object: "list", data: [{ id: refundId, object: "refund", amount: 10000, status: "succeeded" }] } } },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const res = await request(app).post("/api/webhooks/stripe").set("Stripe-Signature", header).set("Content-Type", "application/json").send(payload);
    expect(res.status).toBe(200);
    expect(await prisma.commissionLedger.count({ where: { bookingId: booking.id, type: "REVERSAL" } })).toBe(1);
  });

  it("a refund made in the Stripe dashboard reverses commission through the webhook", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure();
    setPaymentProviderForTests(browserPays);
    const b = await bookFor(affiliate.code, dep.id, 2);
    const reference = b.booking!.bookingReference;
    await confirmPaidBooking(reference, { amount: b.booking!.totalAmount * 100, currency: "CAD", transactionId: `pi_${reference}` });
    const payload = JSON.stringify({
      id: `evt_${unique()}`,
      object: "event",
      type: "charge.refunded",
      data: { object: { id: `ch_${reference}`, object: "charge", payment_intent: `pi_${reference}`, refunds: { object: "list", data: [{ id: `re_${unique()}`, object: "refund", amount: 10000, status: "succeeded" }] } } },
    });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    expect((await request(app).post("/api/webhooks/stripe").set("Stripe-Signature", header).set("Content-Type", "application/json").send(payload)).status).toBe(200);
    expect((await commissionTotals(affiliate.id)).netCents).toBe(1000); // half of $20
  });

  it("commission becomes payable only after the tour date", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure("2027-03-10");
    await bookFor(affiliate.code, dep.id);
    await approveMaturedCommissions(new Date("2027-03-10T18:00:00Z")); // the tour day itself
    expect((await commissionTotals(affiliate.id)).pendingCents).toBe(1000);
    await approveMaturedCommissions(new Date("2027-03-11T18:00:00Z"));
    expect((await commissionTotals(affiliate.id)).approvedCents).toBe(1000);
  });
});

describe("payouts", () => {
  it("drafts from approved lines only, can be cancelled, and marking paid is final", async () => {
    const { affiliate } = await activePartner(0.1);
    const dep = await departure();
    await bookFor(affiliate.code, dep.id);
    await bookFor(affiliate.code, dep.id);
    expect((await createPayout({ affiliateId: affiliate.id, staffId: adminId })).ok).toBe(false); // still pending

    await prisma.commissionLedger.updateMany({ where: { affiliateId: affiliate.id }, data: { status: "APPROVED" } });
    const draft = await createPayout({ affiliateId: affiliate.id, staffId: adminId, method: "Interac e-Transfer" });
    if (!draft.ok) throw new Error(draft.error);
    expect(draft.payout.amountCents).toBe(2000);
    expect((await createPayout({ affiliateId: affiliate.id, staffId: adminId })).ok).toBe(false); // lines are taken

    expect((await cancelPayout({ payoutId: draft.payout.id, staffId: adminId })).ok).toBe(true);
    const again = await createPayout({ affiliateId: affiliate.id, staffId: adminId });
    if (!again.ok) throw new Error(again.error);
    expect((await markPayoutPaid({ payoutId: again.payout.id, reference: "ETR-77", staffId: adminId })).ok).toBe(true);
    expect((await markPayoutPaid({ payoutId: again.payout.id, reference: "ETR-78", staffId: adminId })).ok).toBe(false);
    expect((await cancelPayout({ payoutId: again.payout.id, staffId: adminId })).ok).toBe(false);
    expect((await commissionTotals(affiliate.id)).paidCents).toBe(2000);
    expect(await prisma.auditLog.count({ where: { entityId: again.payout.id, action: "PAYOUT_PAID" } })).toBe(1);
  });
});

describe("partner API", () => {
  it("shows a partner only their own bookings and commissions, without guest details", async () => {
    const a = await activePartner();
    const b = await activePartner();
    const dep = await departure();
    const mine = await bookFor(a.affiliate.code, dep.id);
    await bookFor(b.affiliate.code, dep.id);

    const bookings = await request(app).get("/api/affiliates/me/bookings").set("Cookie", a.cookie);
    expect(bookings.status).toBe(200);
    expect(bookings.body.bookings.map((x: { reference: string }) => x.reference)).toEqual([mine.booking!.bookingReference]);
    expect(JSON.stringify(bookings.body)).not.toMatch(/Guest Ledger|@example\.com|\+1-403/);

    const commissions = await request(app).get("/api/affiliates/me/commissions").set("Cookie", a.cookie);
    expect(commissions.body.lines).toHaveLength(1);
    expect(commissions.body.totals.pending).toBe(10);

    const me = await request(app).get("/api/affiliates/me").set("Cookie", a.cookie);
    expect(me.body.totals).toMatchObject({ bookings: 1, revenue: 100, commission: 10 });
  });

  it("lets a partner edit their profile but not their code, status or rate", async () => {
    const { affiliate, cookie } = await activePartner();
    const ok = await request(app).patch("/api/affiliates/me").set("Cookie", cookie).send({ phone: "+1 403 555 0199", payoutEmail: "pay@example.com" });
    expect(ok.status).toBe(200);
    for (const body of [{ code: "HACKED" }, { status: "ACTIVE" }, { commissionRate: 0.5 }]) {
      expect((await request(app).patch("/api/affiliates/me").set("Cookie", cookie).send(body)).status).toBe(400);
    }
    const after = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliate.id } });
    expect(after).toMatchObject({ phone: "+1 403 555 0199", payoutEmail: "pay@example.com", code: affiliate.code, commissionRate: 0.1 });
  });

  it("keeps partners and customers out of admin routes", async () => {
    const { cookie } = await activePartner();
    for (const path of ["/api/affiliates/admin", "/api/affiliates/admin/commissions", "/api/affiliates/admin/payouts", "/api/affiliates/admin/rules"]) {
      expect((await request(app).get(path).set("Cookie", cookie)).status).toBe(403);
    }
    expect((await request(app).post("/api/affiliates/admin/commissions/adjust").set("Cookie", cookie).send({ affiliateId: "x", amount: 100, reason: "give me money" })).status).toBe(403);
    expect((await request(app).get("/api/affiliates/me/commissions")).status).toBe(401);
  });

  it("ignores a partner code or id sent in the booking body; only the referral cookie counts", async () => {
    const { affiliate } = await activePartner();
    const dep = await departure();
    const res = await request(app)
      .post("/api/bookings")
      .send({ departureId: dep.id, customerName: "Body Trick", customerEmail: `trick-${unique()}@example.com`, customerPhone: "+1-403-555-0100", adultsCount: 1, childrenCount: 0, infantsCount: 0, affiliateCode: affiliate.code, affiliateId: affiliate.id });
    expect([200, 201]).toContain(res.status);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: res.body.booking.bookingReference } });
    expect(booking.affiliateId).toBeNull();
  });
});

describe("admin API", () => {
  it("creates partners, rules and adjustments with audit rows", async () => {
    const id = unique();
    const created = await request(app)
      .post("/api/affiliates/admin")
      .set("Cookie", adminCookie)
      .send({ name: `Desk ${id}`, contactName: "Front Desk", email: `desk-${id}@example.com`, password: "a-long-password", type: "HOTEL", status: "ACTIVE" });
    expect(created.status).toBe(201);
    const affiliateId = created.body.affiliate.id;
    expect(await prisma.auditLog.count({ where: { entityId: affiliateId, action: "PARTNER_CREATED" } })).toBe(1);

    const both = await request(app).post("/api/affiliates/admin/rules").set("Cookie", adminCookie).send({ name: "bad", percent: 10, fixedAmount: 5 });
    expect(both.status).toBe(400);
    const rule = await request(app).post("/api/affiliates/admin/rules").set("Cookie", adminCookie).send({ name: `Desk rate ${id}`, affiliateId, percent: 12.5 });
    expect(rule.status).toBe(201);
    expect(rule.body.rule.percent).toBe(12.5);

    const noReason = await request(app).post("/api/affiliates/admin/commissions/adjust").set("Cookie", adminCookie).send({ affiliateId, amount: 15 });
    expect(noReason.status).toBe(400);
    const adjust = await request(app).post("/api/affiliates/admin/commissions/adjust").set("Cookie", adminCookie).send({ affiliateId, amount: 15, reason: "Welcome bonus agreed by phone" });
    expect(adjust.status).toBe(201);
    expect(await prisma.auditLog.count({ where: { entityId: adjust.body.id, action: "COMMISSION_ADJUSTED" } })).toBe(1);
    expect((await commissionTotals(affiliateId)).approvedCents).toBe(1500);

    const suspended = await request(app).patch(`/api/affiliates/admin/${affiliateId}`).set("Cookie", adminCookie).send({ status: "SUSPENDED" });
    expect(suspended.status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: affiliateId, action: "PARTNER_UPDATED" } });
    expect(audit.details).toMatchObject({ status: { from: "ACTIVE", to: "SUSPENDED" } });
  });

  it("reports per partner, with a CSV safe to open in a spreadsheet", async () => {
    const { affiliate } = await activePartner();
    await prisma.affiliate.update({ where: { id: affiliate.id }, data: { name: "=HYPERLINK(evil)" } });
    const dep = await departure();
    await bookFor(affiliate.code, dep.id);
    const from = new Date(Date.now() - 3600_000).toISOString();
    const to = new Date(Date.now() + 3600_000).toISOString();
    const json = await request(app).get(`/api/affiliates/admin/report?from=${from}&to=${to}`).set("Cookie", adminCookie);
    const row = json.body.rows.find((r: { affiliateId: string }) => r.affiliateId === affiliate.id);
    expect(row).toMatchObject({ paidBookings: 1, sales: 100, commissionEarned: 10, commissionNet: 10 });
    const csv = await request(app).get(`/api/affiliates/admin/report?from=${from}&to=${to}&format=csv`).set("Cookie", adminCookie);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.text).toContain(`"'=HYPERLINK(evil)"`);
  });
});

describe("referral clicks", () => {
  it("records one click per visitor per day, ignores bots and unknown codes, and never earns", async () => {
    const { affiliate } = await activePartner();
    const send = (ua: string, code = affiliate.code) => request(app).post("/api/affiliates/click").set("User-Agent", ua).send({ code, path: "/shared-tours" });
    const browser = `Mozilla/5.0 (ledger ${unique()})`;
    expect((await send(browser)).status).toBe(204);
    await send(browser);
    await send("Googlebot/2.1");
    await send(browser, "NOSUCHCODE");
    expect(await prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } })).toBe(1);
    expect(await prisma.commissionLedger.count({ where: { affiliateId: affiliate.id } })).toBe(0);
  });
});
