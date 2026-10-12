import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/auth";
import { commissionTotals } from "@/modules/affiliates/commission";
import { payoutDto } from "@/modules/affiliates/payouts";
import { sendApplicationEmails } from "@/modules/affiliates/partner-emails";

/**
 * Partner (affiliate / associate) program. Partners share links with ?ref=<code>; the frontend
 * keeps the code in the vc_ref cookie for 30 days and bookings made meanwhile are credited to the
 * partner. Commission is stored in the ledger (commission.ts) when a payment is verified.
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
    const code = i === 0 ? base : `${base}${crypto.randomInt(100, 1000)}`;
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
  phone?: string;
}) {
  const email = input.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { success: false as const, error: "An account with this email already exists. Sign in instead." };
  }
  const passwordHash = await hashPassword(input.password);
  const code = await uniqueCode(input.name);
  const affiliate = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.contactName, passwordHash, role: "AFFILIATE" } });
    return tx.affiliate.create({
      data: { userId: user.id, name: input.name, type: input.type, website: input.website || null, phone: input.phone || null, code },
    });
  });
  sendApplicationEmails({ name: input.name, contactName: input.contactName, email, code: affiliate.code, type: input.type });
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

/** Bookings that count as sales: paid (or being finished by staff after payment), not unpaid, cancelled or refunded. */
export const COMMISSION_STATUSES = ["CONFIRMED", "COMPLETED", "PAID_UNSYNCED"] as const;
const isSale = (status: string) => (COMMISSION_STATUSES as readonly string[]).includes(status);

/** Money leaves the API in dollars, like the rest of the API; the database keeps cents. */
const dollars = (cents: number) => Math.round(cents) / 100;

const CLICK_WINDOW_DAYS = 30;

/** Commission per booking (net of reversals), from the ledger. */
async function commissionByBooking(affiliateId: string, bookingIds: string[]) {
  if (bookingIds.length === 0) return new Map<string, number>();
  const rows = await prisma.commissionLedger.groupBy({
    by: ["bookingId"],
    where: { affiliateId, bookingId: { in: bookingIds } },
    _sum: { amountCents: true },
  });
  return new Map(rows.map((r) => [r.bookingId as string, r._sum.amountCents ?? 0]));
}

const bookingInclude = {
  tourDeparture: { include: { tour: { select: { title: true, slug: true } }, shuttleRoute: { select: { name: true } } } },
} as const;

type PartnerBooking = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** A referred booking as a partner may see it: no guest name, email or phone. */
function partnerBookingDto(b: PartnerBooking, commissionCents: number) {
  return {
    reference: b.bookingReference,
    experience: b.tourDeparture.tour?.title ?? b.tourDeparture.shuttleRoute?.name ?? "Experience",
    slug: b.tourDeparture.tour?.slug ?? null,
    date: b.tourDeparture.date,
    guests: b.totalSeats,
    total: dollars(b.totalAmount),
    commission: dollars(commissionCents),
    status: b.status,
    bookedAt: b.createdAt,
  };
}

/** A partner's own dashboard: profile, totals (from the ledger) and recent referred bookings (no guest PII). */
export async function getAffiliateDashboard(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId }, include: { user: { select: { name: true, email: true } } } });
  if (!affiliate) return null;

  const since = new Date(Date.now() - CLICK_WINDOW_DAYS * 86_400_000);
  const [bookings, totals, clicks, salesSince] = await Promise.all([
    prisma.booking.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" }, include: bookingInclude }),
    commissionTotals(affiliate.id),
    prisma.affiliateClick.count({ where: { affiliateId: affiliate.id, createdAt: { gte: since } } }),
    prisma.booking.count({ where: { affiliateId: affiliate.id, createdAt: { gte: since }, status: { in: [...COMMISSION_STATUSES] } } }),
  ]);
  const sales = bookings.filter((b) => isSale(b.status));
  const recent = bookings.slice(0, 25);
  const perBooking = await commissionByBooking(affiliate.id, recent.map((b) => b.id));

  return {
    affiliate: {
      name: affiliate.name,
      contactName: affiliate.user.name,
      email: affiliate.user.email,
      phone: affiliate.phone,
      website: affiliate.website,
      payoutEmail: affiliate.payoutEmail,
      code: affiliate.code,
      type: affiliate.type,
      status: affiliate.status,
      commissionRate: affiliate.commissionRate,
      bokunChannelId: affiliate.bokunChannelId,
      createdAt: affiliate.createdAt,
    },
    totals: {
      bookings: sales.length,
      guests: sales.reduce((sum, b) => sum + b.totalSeats, 0),
      revenue: dollars(sales.reduce((sum, b) => sum + b.totalAmount, 0)),
      commission: dollars(totals.netCents),
      pending: dollars(totals.pendingCents),
      approved: dollars(totals.approvedCents),
      paid: dollars(totals.paidCents),
      reversed: dollars(totals.reversedCents),
      clicks30d: clicks,
      conversion30d: clicks > 0 ? Math.round((salesSince / clicks) * 1000) / 10 : null, // percent
      currency: "CAD",
    },
    recentBookings: recent.map((b) => partnerBookingDto(b, perBooking.get(b.id) ?? 0)),
  };
}

export const PARTNER_PROFILE_FIELDS = ["name", "contactName", "phone", "website", "payoutEmail"] as const;

/** The partner edits their own profile. Code, status, rate and email change only through staff. */
export async function updateAffiliateProfile(
  userId: string,
  data: { name?: string; contactName?: string; phone?: string | null; website?: string | null; payoutEmail?: string | null },
) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId } });
  if (!affiliate) return null;
  return prisma.$transaction(async (tx) => {
    if (data.contactName) await tx.user.update({ where: { id: userId }, data: { name: data.contactName } });
    const updated = await tx.affiliate.update({
      where: { id: affiliate.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.website !== undefined ? { website: data.website || null } : {}),
        ...(data.payoutEmail !== undefined ? { payoutEmail: data.payoutEmail || null } : {}),
      },
    });
    await tx.auditLog.create({ data: { userId, action: "PARTNER_PROFILE_UPDATED", entityType: "Affiliate", entityId: affiliate.id, details: { fields: Object.keys(data) } } });
    return updated;
  });
}

/** The partner's referred bookings, newest first, with optional status filter and paging. */
export async function listPartnerBookings(userId: string, opts: { status?: string; page: number; pageSize: number }) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true } });
  if (!affiliate) return null;
  const where: Prisma.BookingWhereInput = { affiliateId: affiliate.id, ...(opts.status ? { status: opts.status as Prisma.EnumBookingStatusFilter["equals"] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize, include: bookingInclude }),
  ]);
  const perBooking = await commissionByBooking(affiliate.id, rows.map((b) => b.id));
  return { total, page: opts.page, pageSize: opts.pageSize, bookings: rows.map((b) => partnerBookingDto(b, perBooking.get(b.id) ?? 0)) };
}

/** Ledger lines as the partner sees them: booking reference and experience, never guest details. */
function ledgerDto(l: Prisma.CommissionLedgerGetPayload<{ include: { booking: { include: typeof bookingInclude } } }>) {
  return {
    id: l.id,
    type: l.type,
    status: l.status,
    amount: dollars(l.amountCents),
    basis: dollars(l.basisCents),
    currency: l.currency,
    rule: l.ruleSnapshot,
    reason: l.reason,
    bookingReference: l.booking?.bookingReference ?? null,
    experience: l.booking ? l.booking.tourDeparture.tour?.title ?? l.booking.tourDeparture.shuttleRoute?.name ?? "Experience" : null,
    tourDate: l.booking?.tourDeparture.date ?? null,
    payoutId: l.payoutId,
    createdAt: l.createdAt,
    approvedAt: l.approvedAt,
    paidAt: l.paidAt,
  };
}

export async function listCommissionLines(where: Prisma.CommissionLedgerWhereInput, opts: { page: number; pageSize: number }) {
  const [total, rows] = await Promise.all([
    prisma.commissionLedger.count({ where }),
    prisma.commissionLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: { booking: { include: bookingInclude } },
    }),
  ]);
  return { total, page: opts.page, pageSize: opts.pageSize, lines: rows.map(ledgerDto) };
}

export async function listPartnerCommissions(userId: string, opts: { status?: "PENDING" | "APPROVED" | "PAID"; page: number; pageSize: number }) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true } });
  if (!affiliate) return null;
  const [list, totals] = await Promise.all([
    listCommissionLines({ affiliateId: affiliate.id, ...(opts.status ? { status: opts.status } : {}) }, opts),
    commissionTotals(affiliate.id),
  ]);
  return {
    ...list,
    totals: {
      pending: dollars(totals.pendingCents),
      approved: dollars(totals.approvedCents),
      paid: dollars(totals.paidCents),
      reversed: dollars(totals.reversedCents),
      net: dollars(totals.netCents),
      currency: "CAD",
    },
  };
}

export async function listPartnerPayouts(userId: string) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true } });
  if (!affiliate) return null;
  const payouts = await prisma.affiliatePayout.findMany({ where: { affiliateId: affiliate.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } });
  return payouts.map(payoutDto);
}

// ---------------------------------------------------------------------------------------------
// Referral clicks: one row per visitor per partner per day. The visitor is a salted hash of IP and
// user agent (no raw values stored); bots are ignored. Clicks never earn anything.

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|curl|wget|python|monitor/i;

function visitorHash(ip: string, userAgent: string) {
  const salt = process.env.VOUCHER_SECRET || process.env.JWT_SECRET || "vista-chase-clicks";
  return crypto.createHmac("sha256", salt).update(`${ip}|${userAgent}`).digest("hex").slice(0, 40);
}

export async function recordAffiliateClick(input: { code: string; ip: string; userAgent: string; path: string }) {
  if (!input.userAgent || BOT_UA.test(input.userAgent)) return { recorded: false };
  const affiliate = await findActiveAffiliateByCode(input.code);
  if (!affiliate) return { recorded: false };
  const hash = visitorHash(input.ip, input.userAgent);
  const recent = await prisma.affiliateClick.findFirst({
    where: { affiliateId: affiliate.id, visitorHash: hash, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    select: { id: true },
  });
  if (recent) return { recorded: false };
  await prisma.affiliateClick.create({ data: { affiliateId: affiliate.id, visitorHash: hash, landingPath: input.path.slice(0, 300) } });
  return { recorded: true };
}

/** Clicks older than 13 months are deleted (privacy). */
export async function pruneOldClicks(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 13);
  const { count } = await prisma.affiliateClick.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: count };
}

// ---------------------------------------------------------------------------------------------
// Admin

export async function listAffiliates() {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } }, _count: { select: { bookings: true } } },
  });
  const ledger = await prisma.commissionLedger.groupBy({ by: ["affiliateId", "status"], _sum: { amountCents: true } });
  const sum = (id: string, status: string) => ledger.find((r) => r.affiliateId === id && r.status === status)?._sum.amountCents ?? 0;
  return affiliates.map((a) => ({
    id: a.id,
    name: a.name,
    contactName: a.user.name,
    email: a.user.email,
    phone: a.phone,
    payoutEmail: a.payoutEmail,
    code: a.code,
    type: a.type,
    website: a.website,
    status: a.status,
    commissionRate: a.commissionRate,
    bokunChannelId: a.bokunChannelId,
    bookings: a._count.bookings,
    commission: { pending: dollars(sum(a.id, "PENDING")), approved: dollars(sum(a.id, "APPROVED")), paid: dollars(sum(a.id, "PAID")) },
    createdAt: a.createdAt,
  }));
}

/** Admin creates a partner directly (for example a hotel signed up in person). */
export async function createAffiliateByAdmin(
  input: { name: string; contactName: string; email: string; password: string; type: AffiliateType; website?: string; phone?: string; status: "PENDING" | "ACTIVE"; commissionRate?: number },
  staffId: string,
) {
  const email = input.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { success: false as const, error: "An account with this email already exists." };
  }
  const passwordHash = await hashPassword(input.password);
  const code = await uniqueCode(input.name);
  const affiliate = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.contactName, passwordHash, role: "AFFILIATE" } });
    const created = await tx.affiliate.create({
      data: {
        userId: user.id,
        name: input.name,
        type: input.type,
        website: input.website || null,
        phone: input.phone || null,
        status: input.status,
        code,
        ...(input.commissionRate !== undefined ? { commissionRate: input.commissionRate } : {}),
      },
    });
    await tx.auditLog.create({ data: { userId: staffId, action: "PARTNER_CREATED", entityType: "Affiliate", entityId: created.id, details: { code, status: input.status } } });
    return created;
  });
  return { success: true as const, affiliate: { id: affiliate.id, code: affiliate.code, status: affiliate.status } };
}

export async function updateAffiliate(id: string, data: { status?: (typeof AFFILIATE_STATUSES)[number]; commissionRate?: number; bokunChannelId?: string | null; name?: string; phone?: string | null; payoutEmail?: string | null; website?: string | null }, staffId?: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.affiliate.findUniqueOrThrow({ where: { id } });
    const updated = await tx.affiliate.update({ where: { id }, data });
    const changes = Object.fromEntries(
      Object.keys(data).map((k) => [k, { from: (before as Record<string, unknown>)[k] ?? null, to: (updated as Record<string, unknown>)[k] ?? null }]),
    );
    await tx.auditLog.create({ data: { userId: staffId ?? null, action: "PARTNER_UPDATED", entityType: "Affiliate", entityId: id, details: changes as object } });
    return { before, updated };
  });
}
