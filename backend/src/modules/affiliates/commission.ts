// Partner commission ledger (docs/AFFILIATE_PLATFORM_DESIGN.md, docs/AFFILIATES.md).
//
// Lines are append-only: an amount is never edited. A verified payment adds one EARNED line
// (PENDING until the tour date has passed, then APPROVED and payable), each refund adds a negative
// REVERSAL line in proportion to the amount refunded, and staff corrections are ADJUSTMENT lines
// with a reason. Every write has a unique entryKey, so webhook, job and double-click retries can't
// create a second line. Amounts are integer cents in the booking's currency (CAD); a percentage is
// rounded half up once per line. Nothing here moves money: payouts.ts prepares payouts that an
// admin pays outside the app and then marks paid.

import crypto from "node:crypto";
import type { Prisma, TourCategory } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { todayInMountainTime, dateOnly } from "@/lib/utils/time";

type Tx = Prisma.TransactionClient;

export interface ResolvedRule {
  ruleId: string | null;
  source: string; // which rule applied, for the line's snapshot
  percentBps: number | null;
  fixedCents: number | null;
}

/**
 * The commission rule for a partner's booking of a tour. Most specific active rule wins:
 * partner + tour, partner + category, partner, then the same three for every partner. With no
 * rule, the partner's own commissionRate (the original single rate) applies.
 */
export async function resolveRule(
  db: Tx | typeof prisma,
  affiliate: { id: string; commissionRate: number },
  tour: { id: string; category: TourCategory } | null,
  at: Date = new Date(),
): Promise<ResolvedRule> {
  const rules = await db.commissionRule.findMany({
    where: {
      active: true,
      validFrom: { lte: at },
      OR: [{ validTo: null }, { validTo: { gt: at } }],
      AND: [{ OR: [{ affiliateId: affiliate.id }, { affiliateId: null }] }],
    },
    orderBy: { createdAt: "desc" },
  });
  const rank = (r: (typeof rules)[number]) => {
    if (r.tourId && r.tourId !== tour?.id) return -1;
    if (r.category && r.category !== tour?.category) return -1;
    const scope = r.tourId ? 3 : r.category ? 2 : 1;
    return (r.affiliateId ? 3 : 0) + scope;
  };
  let best: (typeof rules)[number] | null = null;
  for (const rule of rules) {
    if (rank(rule) > (best ? rank(best) : -1)) best = rule;
  }
  if (best) {
    return { ruleId: best.id, source: `rule:${best.name}`, percentBps: best.percentBps, fixedCents: best.fixedCents };
  }
  return { ruleId: null, source: "partner-rate", percentBps: Math.round(affiliate.commissionRate * 10000), fixedCents: null };
}

/** Commission in cents on a paid amount: a percentage rounded half up, or a fixed amount capped at the amount paid. */
export function commissionFor(basisCents: number, rule: Pick<ResolvedRule, "percentBps" | "fixedCents">): number {
  if (basisCents <= 0) return 0;
  if (rule.fixedCents != null) return Math.min(rule.fixedCents, basisCents);
  return Math.round((basisCents * (rule.percentBps ?? 0)) / 10000);
}

/**
 * Record the commission for a booking whose payment was just verified. Runs inside the same
 * transaction that confirms the booking. No partner, nothing paid, or a 0 commission writes nothing;
 * a second call for the same booking is a no-op.
 */
export async function earnCommission(tx: Tx, bookingId: string, paidCents: number) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      affiliateId: true,
      currency: true,
      affiliate: { select: { id: true, commissionRate: true } },
      tourDeparture: { select: { tour: { select: { id: true, category: true } } } },
    },
  });
  if (!booking?.affiliate || paidCents <= 0) return null;

  const rule = await resolveRule(tx, booking.affiliate, booking.tourDeparture.tour);
  const amountCents = commissionFor(paidCents, rule);
  if (amountCents <= 0) return null;

  const entryKey = `EARN:${booking.id}`;
  const existing = await tx.commissionLedger.findUnique({ where: { entryKey } });
  if (existing) return existing;
  return tx.commissionLedger.create({
    data: {
      entryKey,
      affiliateId: booking.affiliate.id,
      bookingId: booking.id,
      type: "EARNED",
      basisCents: paidCents,
      amountCents,
      currency: booking.currency,
      ruleId: rule.ruleId,
      ruleSnapshot: { source: rule.source, percentBps: rule.percentBps, fixedCents: rule.fixedCents },
      status: "PENDING",
    },
  });
}

/**
 * Reverse commission for a refund, in proportion to the amount refunded, never more than what is
 * left. refundId is the payment provider's refund id, so the same refund seen from the cancel
 * flow and from the Stripe webhook reverses once. A reversal follows its earned line's status; if
 * that line was already paid, the reversal is APPROVED and comes off the next payout.
 */
export async function reverseCommissionForRefund(bookingId: string, refundId: string, refundedCents: number, reason: string) {
  if (refundedCents <= 0) return null;
  return prisma.$transaction(async (tx) => {
    // Lock the earned line so two refunds of one booking can't both reverse the same remainder.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "CommissionLedger" WHERE "entryKey" = ${`EARN:${bookingId}`} FOR UPDATE`;
    if (locked.length === 0) return null;
    const earned = await tx.commissionLedger.findUniqueOrThrow({ where: { id: locked[0].id } });

    const entryKey = `REFUND:${refundId}`;
    const existing = await tx.commissionLedger.findUnique({ where: { entryKey } });
    if (existing) return existing;

    const reversed = await tx.commissionLedger.aggregate({
      where: { bookingId, type: "REVERSAL" },
      _sum: { amountCents: true },
    });
    const remaining = earned.amountCents + (reversed._sum.amountCents ?? 0);
    const share = Math.round((earned.amountCents * Math.min(refundedCents, earned.basisCents)) / earned.basisCents);
    const amount = Math.min(share, remaining);
    if (amount <= 0) return null;

    return tx.commissionLedger.create({
      data: {
        entryKey,
        affiliateId: earned.affiliateId,
        bookingId,
        type: "REVERSAL",
        basisCents: refundedCents,
        amountCents: -amount,
        currency: earned.currency,
        ruleId: earned.ruleId,
        status: earned.status === "PAID" ? "APPROVED" : earned.status,
        approvedAt: earned.status === "PENDING" ? null : new Date(),
        reason,
      },
    });
  });
}

/**
 * Nightly: lines for tours whose date has passed become APPROVED (payable). The 72-hour
 * cancellation window has closed by then; any refund already reversed its share.
 */
export async function approveMaturedCommissions(now = new Date()) {
  const today = dateOnly(todayInMountainTime(now));
  const result = await prisma.commissionLedger.updateMany({
    where: { status: "PENDING", booking: { tourDeparture: { date: { lt: today } } } },
    data: { status: "APPROVED", approvedAt: now },
  });
  return { approved: result.count };
}

/** Admin: approve PENDING lines early (for example a tour that ran). Returns how many moved. */
export async function approveCommissions(ids: string[], staffId: string) {
  return prisma.$transaction(async (tx) => {
    const moved = await tx.commissionLedger.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    if (moved.count > 0) {
      await tx.auditLog.create({
        data: { userId: staffId, action: "COMMISSION_APPROVED", entityType: "CommissionLedger", entityId: ids.join(",").slice(0, 190), details: { ids, approved: moved.count } },
      });
    }
    return moved.count;
  });
}

/** Admin: a correction line (positive or negative), payable at once. A reason is required. */
export async function adjustCommission(input: { affiliateId: string; amountCents: number; reason: string; bookingId?: string | null; staffId: string }) {
  return prisma.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.findUnique({ where: { id: input.affiliateId }, select: { id: true } });
    if (!affiliate) return { ok: false as const, error: "Partner not found." };
    if (input.bookingId) {
      const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { affiliateId: true } });
      if (!booking || booking.affiliateId !== input.affiliateId) return { ok: false as const, error: "That booking isn't credited to this partner." };
    }
    const line = await tx.commissionLedger.create({
      data: {
        entryKey: `ADJUST:${crypto.randomUUID()}`,
        affiliateId: input.affiliateId,
        bookingId: input.bookingId ?? null,
        type: "ADJUSTMENT",
        basisCents: 0,
        amountCents: input.amountCents,
        status: "APPROVED",
        approvedAt: new Date(),
        reason: input.reason,
        createdById: input.staffId,
      },
    });
    await tx.auditLog.create({
      data: { userId: input.staffId, action: "COMMISSION_ADJUSTED", entityType: "CommissionLedger", entityId: line.id, details: { affiliateId: input.affiliateId, amountCents: input.amountCents, reason: input.reason, bookingId: input.bookingId ?? null } },
    });
    return { ok: true as const, line };
  });
}

export interface CommissionTotals {
  pendingCents: number;
  approvedCents: number; // payable, not yet paid (includes lines in a draft payout)
  paidCents: number;
  reversedCents: number; // positive number: total taken back by refunds
  netCents: number; // everything earned minus reversals, plus adjustments
}

/** Totals for one partner (or all partners when affiliateId is omitted), straight from the ledger. */
export async function commissionTotals(affiliateId?: string): Promise<CommissionTotals> {
  const where = affiliateId ? { affiliateId } : {};
  const [byStatus, reversals] = await Promise.all([
    prisma.commissionLedger.groupBy({ by: ["status"], where, _sum: { amountCents: true } }),
    prisma.commissionLedger.aggregate({ where: { ...where, type: "REVERSAL" }, _sum: { amountCents: true } }),
  ]);
  const sum = (status: string) => byStatus.find((r) => r.status === status)?._sum.amountCents ?? 0;
  const pendingCents = sum("PENDING");
  const approvedCents = sum("APPROVED");
  const paidCents = sum("PAID");
  return {
    pendingCents,
    approvedCents,
    paidCents,
    reversedCents: -(reversals._sum.amountCents ?? 0),
    netCents: pendingCents + approvedCents + paidCents,
  };
}
