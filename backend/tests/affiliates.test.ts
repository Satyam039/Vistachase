import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { applyAffiliate, getAffiliateDashboard, findActiveAffiliateByCode } from "@/modules/affiliates/affiliate.repository";
import { createBooking } from "@/modules/bookings/booking.repository";

const unique = () => Math.random().toString(36).slice(2, 8);

async function openDeparture() {
  const dep = await prisma.tourDeparture.findFirst({
    where: { status: "ACTIVE", tour: { category: "SHARED" } },
    orderBy: { date: "asc" },
  });
  if (!dep) throw new Error("seed has no shared departure");
  return dep;
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

  it("earns commission only on paid bookings, not unpaid, cancelled or refunded ones", async () => {
    const id = unique();
    const applied = await applyAffiliate({ name: `Ledger ${id}`, contactName: "L", email: `ledger-${id}@example.com`, password: "a-long-password", type: "AGENT" });
    if (!applied.success) throw new Error("apply failed");
    const affiliate = await prisma.affiliate.update({ where: { code: applied.affiliate.code }, data: { status: "ACTIVE", commissionRate: 0.1 } });
    const dep = await openDeparture();
    const statuses = ["CONFIRMED", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"] as const;
    for (const status of statuses) {
      const r = await createBooking({ departureId: dep.id, customerName: "Guest", customerEmail: `g-${status}-${id}@example.com`, customerPhone: "+1-403-555-0100", adultsCount: 1, childrenCount: 0, infantsCount: 0, affiliateCode: affiliate.code });
      expect(r.success).toBe(true);
      await prisma.booking.update({ where: { bookingReference: r.booking!.bookingReference }, data: { status, totalAmount: 100 } });
    }
    const dashboard = await getAffiliateDashboard(affiliate.userId);
    expect(dashboard!.totals.bookings).toBe(1);
    expect(dashboard!.totals.revenue).toBe(100);
    expect(dashboard!.totals.commission).toBe(10);
    const byStatus = Object.fromEntries(dashboard!.recentBookings.map((b) => [b.status, b.commission]));
    expect(byStatus).toEqual({ CONFIRMED: 10, PENDING_PAYMENT: 0, CANCELLED: 0, REFUNDED: 0 });
  });

  it("shows partners their totals and bookings without guest names or contact details", async () => {
    const user = await prisma.user.findUnique({ where: { email: "partner.demo@example.com" } });
    const dashboard = await getAffiliateDashboard(user!.id);
    expect(dashboard?.affiliate.code).toBe("BANFFLODGE");
    expect(dashboard!.totals.bookings).toBeGreaterThan(0);
    expect(dashboard!.totals.commission).toBeCloseTo(dashboard!.totals.revenue * 0.1, 1);
    const json = JSON.stringify(dashboard);
    expect(json).not.toMatch(/@example\.com|Sarah Jenkins|\+1-403/);
  });
});
