import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { applyAffiliate, getAffiliateDashboard, findActiveAffiliateByCode } from "@/modules/affiliates/affiliate.repository";
import { cancelBooking, createBooking } from "@/modules/bookings/booking.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const unique = () => Math.random().toString(36).slice(2, 8);

// Behaves like Stripe: the guest still has to pay in the browser, so nothing is confirmed yet.
const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_${req.bookingReference}_secret`, intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment() {
    return { success: true, refundId: `re_${unique()}` };
  },
};

// Its own bookable departure, so seats taken by other test files running at the same time
// never get in the way.
async function openDeparture() {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly("2027-08-20"), departureTime: timeOfDay("09:00"), capacityTotal: 30, price: 10000, status: "ACTIVE" },
  });
}

describe("Partner (affiliate) program", () => {
  it("creates new partners as PENDING with a unique referral code", async () => {
    const id = unique();
    const result = await applyAffiliate({
      name: `Canmore Inn ${id}`,
      contactName: "Alex Partner",
      email: `inn-${id}@example.com`,
      password: "a-long-password",
      type: "HOTEL",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.affiliate.status).toBe("PENDING");
    expect(result.affiliate.code).toMatch(/^CANMOREINN/);
    const user = await prisma.user.findUnique({ where: { email: `inn-${id}@example.com` } });
    expect(user?.role).toBe("AFFILIATE");
  });

  it("rejects an application for an email that already has an account", async () => {
    const result = await applyAffiliate({
      name: "Duplicate",
      contactName: "Dup",
      email: "partner.demo@example.com",
      password: "a-long-password",
      type: "AGENT",
    });
    expect(result.success).toBe(false);
  });

  it("credits bookings only to ACTIVE partners", async () => {
    expect(await findActiveAffiliateByCode("BANFFLODGE")).not.toBeNull();

    const id = unique();
    const pending = await applyAffiliate({ name: `Pending ${id}`, contactName: "P", email: `p-${id}@example.com`, password: "a-long-password", type: "CREATOR" });
    expect(pending.success).toBe(true);
    if (!pending.success) return;
    expect(await findActiveAffiliateByCode(pending.affiliate.code)).toBeNull();

    const dep = await openDeparture();
    const base = { departureId: dep.id, customerName: "Guest Test", customerEmail: `guest-${id}@example.com`, customerPhone: "+1-403-555-0100", adultsCount: 1, childrenCount: 0, infantsCount: 0 };
    const credited = await createBooking({ ...base, affiliateCode: "banfflodge" });
    const notCredited = await createBooking({ ...base, affiliateCode: pending.affiliate.code });
    expect(credited.success && notCredited.success).toBe(true);
    const a = await prisma.booking.findUnique({ where: { bookingReference: credited.booking!.bookingReference } });
    const b = await prisma.booking.findUnique({ where: { bookingReference: notCredited.booking!.bookingReference } });
    expect(a?.affiliateId).toBeTruthy();
    expect(b?.affiliateId).toBeNull();
  });

  it("never credits a partner for their own booking (self-referral)", async () => {
    const partner = await prisma.user.findUniqueOrThrow({ where: { email: "partner.demo@example.com" } });
    const dep = await openDeparture();
    const base = { departureId: dep.id, customerName: "Demo Partner", customerPhone: "+1-403-555-0100", adultsCount: 1, childrenCount: 0, infantsCount: 0, affiliateCode: "BANFFLODGE" };
    const byEmail = await createBooking({ ...base, customerEmail: "Partner.Demo@example.com" });
    const byAccount = await createBooking({ ...base, customerEmail: `other-${unique()}@example.com`, customerId: partner.id });
    expect(byEmail.success && byAccount.success).toBe(true);
    for (const r of [byEmail, byAccount]) {
      const b = await prisma.booking.findUnique({ where: { bookingReference: r.booking!.bookingReference } });
      expect(b?.affiliateId).toBeNull();
    }
  });

  it("earns commission only on paid bookings, not unpaid ones, and takes it back on a refund", async () => {
    const id = unique();
    const applied = await applyAffiliate({ name: `Ledger ${id}`, contactName: "L", email: `ledger-${id}@example.com`, password: "a-long-password", type: "AGENT" });
    if (!applied.success) throw new Error("apply failed");
    const affiliate = await prisma.affiliate.update({ where: { code: applied.affiliate.code }, data: { status: "ACTIVE", commissionRate: 0.1 } });
    const dep = await openDeparture();
    const book = (tag: string) =>
      createBooking({ departureId: dep.id, customerName: "Guest", customerEmail: `g-${tag}-${id}@example.com`, customerPhone: "+1-403-555-0100", adultsCount: 1, childrenCount: 0, infantsCount: 0, affiliateCode: affiliate.code });

    // The mock provider pays at once, so these two are confirmed by a verified payment.
    const paid = await book("paid");
    const refunded = await book("refunded");
    // A payment the guest never finishes: stays PENDING_PAYMENT, earns nothing.
    setPaymentProviderForTests(browserPays);
    const unpaid = await book("unpaid");
    setPaymentProviderForTests(null);
    expect(paid.booking!.status).toBe("CONFIRMED");
    expect(unpaid.booking!.status).toBe("PENDING_PAYMENT");
    const cancelled = await cancelBooking(refunded.booking!.bookingReference, `g-refunded-${id}@example.com`);
    expect(cancelled.success).toBe(true);

    const dashboard = await getAffiliateDashboard(affiliate.userId);
    expect(dashboard!.totals.bookings).toBe(1);
    expect(dashboard!.totals.revenue).toBe(100); // dollars: one $100 booking
    expect(dashboard!.totals.commission).toBe(10);
    expect(dashboard!.totals.reversed).toBe(10);
    const byStatus = Object.fromEntries(dashboard!.recentBookings.map((b) => [b.status, b.commission]));
    expect(byStatus).toEqual({ CONFIRMED: 10, PENDING_PAYMENT: 0, REFUNDED: 0 });
  });

  it("shows partners their totals and bookings without guest names or contact details", async () => {
    const user = await prisma.user.findUnique({ where: { email: "partner.demo@example.com" } });
    const dashboard = await getAffiliateDashboard(user!.id);
    expect(dashboard?.affiliate.code).toBe("BANFFLODGE");
    expect(dashboard!.totals.bookings).toBeGreaterThan(0);
    expect(dashboard!.totals.commission).toBeCloseTo(dashboard!.totals.revenue * 0.1, 1);
    const json = JSON.stringify({ totals: dashboard!.totals, recentBookings: dashboard!.recentBookings }); // the partner's own profile email is expected
    expect(json).not.toMatch(/@example\.com|Sarah Jenkins|\+1-403/);
  });
});
