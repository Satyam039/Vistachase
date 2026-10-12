import prisma from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/auth";

/**
 * Partner (affiliate) program. Partners share links with ?ref=<code>; the frontend keeps the
 * code in the vc_ref cookie for 30 days and bookings made meanwhile are credited to the partner.
 * Partners see their referred bookings without guest names or contact details.
 */

export const AFFILIATE_TYPES = ["HOTEL", "AGENT", "CREATOR", "OTHER"] as const;
export type AffiliateType = (typeof AFFILIATE_TYPES)[number];
export const AFFILIATE_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;

function codeBase(name: string) {
  return (
    name
      .normalize("NFKD")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 10) || "PARTNER"
  );
}

async function uniqueCode(name: string) {
  const base = codeBase(name);
  for (let i = 0; i < 20; i++) {
    const code = i === 0 ? base : `${base}${Math.floor(100 + Math.random() * 900)}`;
    if (!(await prisma.affiliate.findUnique({ where: { code } }))) return code;
  }
  return `${base}${Date.now().toString(36).toUpperCase()}`;
}

export async function applyAffiliate(input: {
  name: string;
  contactName: string;
  email: string;
  password: string;
  type: AffiliateType;
  website?: string;
}) {
  const email = input.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { success: false as const, error: "An account with this email already exists. Sign in instead." };
  }
  const user = await prisma.user.create({
    data: { email, name: input.contactName, passwordHash: await hashPassword(input.password), role: "AFFILIATE" },
  });
  const affiliate = await prisma.affiliate.create({
    data: {
      userId: user.id,
      name: input.name,
      type: input.type,
      website: input.website || null,
      code: await uniqueCode(input.name),
    },
  });
  return { success: true as const, affiliate: { code: affiliate.code, status: affiliate.status } };
}

export async function findActiveAffiliateByCode(code: string | undefined | null) {
  if (!code) return null;
  const affiliate = await prisma.affiliate.findUnique({ where: { code: code.toUpperCase() }, include: { user: { select: { email: true } } } });
  return affiliate?.status === "ACTIVE" ? affiliate : null;
}

/**
 * The partner to credit for a booking: an ACTIVE partner whose code is in the vc_ref cookie, and
 * never the partner themself (self-referral: the booking is made by the partner's own account or
 * with the partner account's email).
 */
export async function referringAffiliateId(code: string | undefined | null, customer: { customerId?: string; customerEmail: string }) {
  const affiliate = await findActiveAffiliateByCode(code);
  if (!affiliate) return null;
  if (customer.customerId && customer.customerId === affiliate.userId) return null;
  if (affiliate.user.email.toLowerCase() === customer.customerEmail.trim().toLowerCase()) return null;
  return affiliate.id;
}

/** Bookings that earn commission: paid (or being finished by staff after payment), not unpaid, cancelled or refunded. */
export const COMMISSION_STATUSES = ["CONFIRMED", "COMPLETED", "PAID_UNSYNCED"] as const;
const earnsCommission = (status: string) => (COMMISSION_STATUSES as readonly string[]).includes(status);

/** A partner's own dashboard: profile, totals and recent referred bookings (no guest PII). */
export async function getAffiliateDashboard(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) return null;

  const bookings = await prisma.booking.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: "desc" },
    include: { tourDeparture: { include: { tour: { select: { title: true, slug: true } }, shuttleRoute: { select: { name: true } } } } },
  });
  const counted = bookings.filter((b) => earnsCommission(b.status));
  const revenue = counted.reduce((sum, b) => sum + b.totalAmount, 0);

  return {
    affiliate: {
      name: affiliate.name,
      code: affiliate.code,
      type: affiliate.type,
      status: affiliate.status,
      commissionRate: affiliate.commissionRate,
      bokunChannelId: affiliate.bokunChannelId,
      createdAt: affiliate.createdAt,
    },
    totals: {
      bookings: counted.length,
      guests: counted.reduce((sum, b) => sum + b.totalSeats, 0),
      revenue: Math.round(revenue * 100) / 100,
      commission: Math.round(revenue * affiliate.commissionRate * 100) / 100,
      currency: "CAD",
    },
    recentBookings: bookings.slice(0, 25).map((b) => ({
      reference: b.bookingReference,
      experience: b.tourDeparture.tour?.title ?? b.tourDeparture.shuttleRoute?.name ?? "Experience",
      slug: b.tourDeparture.tour?.slug ?? null,
      date: b.tourDeparture.date,
      guests: b.totalSeats,
      total: b.totalAmount,
      commission: earnsCommission(b.status) ? Math.round(b.totalAmount * affiliate.commissionRate * 100) / 100 : 0,
      status: b.status,
      bookedAt: b.createdAt,
    })),
  };
}

export async function listAffiliates() {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } }, _count: { select: { bookings: true } } },
  });
  return affiliates.map((a) => ({
    id: a.id,
    name: a.name,
    contactName: a.user.name,
    email: a.user.email,
    code: a.code,
    type: a.type,
    website: a.website,
    status: a.status,
    commissionRate: a.commissionRate,
    bokunChannelId: a.bokunChannelId,
    bookings: a._count.bookings,
    createdAt: a.createdAt,
  }));
}

export async function updateAffiliate(id: string, data: { status?: any; commissionRate?: number; bokunChannelId?: string | null }) {
  return prisma.affiliate.update({ where: { id }, data });
}
