// Promo (coupon) codes. Two sources, checked in this order:
//   1. Admin → Promo codes (PromoCode table): percent or fixed CAD amount off, start/end dates,
//      a use limit, on/off. Staff create and change these without touching the server.
//   2. The PROMO_CODES server setting ("CODE:percent" pairs, booking-pricing.ts promoCodes()).
// A code in the table always wins over the same code in the setting, so staff can turn one off.
// Uses are counted from bookings that hold the code and are still alive (unpaid bookings that
// expire, and cancelled or refunded ones, give their use back).

import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { promoPercent } from "@/modules/pricing/booking-pricing";

export interface ResolvedPromo {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  /** A partner's own coupon: the partner's referral code, so the booking credits them. */
  affiliateCode?: string | null;
}

export type PromoLookup =
  | { ok: true; promo: ResolvedPromo }
  | { ok: false; reason: "unknown" | "inactive" | "not_started" | "expired" | "used_up" | "not_applicable"; error: string };

/** Where a coupon can be used (Admin → Coupons → "Where does it apply"). */
export const PROMO_SCOPES = ["SHARED", "PRIVATE", "SHUTTLE"] as const;
export type PromoScope = (typeof PROMO_SCOPES)[number];
const SCOPE_NAMES: Record<PromoScope, string> = { SHARED: "shared tours", PRIVATE: "private tours", SHUTTLE: "shuttles" };

/** "shared tours and shuttles"; empty list = everywhere. */
export function scopeLabel(appliesTo: readonly string[]) {
  const names = PROMO_SCOPES.filter((s) => appliesTo.includes(s)).map((s) => SCOPE_NAMES[s]);
  if (names.length === 0 || names.length === PROMO_SCOPES.length) return "all shared tours, private tours and shuttles";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Whether a code limited to `appliesTo` covers every one of `categories` (tour categories). */
export function promoCovers(appliesTo: readonly string[], categories: readonly (string | null | undefined)[]) {
  if (appliesTo.length === 0) return true;
  return categories.every((c) => !!c && appliesTo.includes(c));
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Booking statuses that hold a use of their promo code. */
export const PROMO_USE_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "PAID_UNSYNCED", "COMPLETED"] as const;

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

/** Live bookings made with `code`. */
export async function promoUses(code: string, db: Db = prisma, excludeBookingId?: string): Promise<number> {
  return db.booking.count({
    where: {
      status: { in: [...PROMO_USE_STATUSES] },
      priceSnapshot: { path: ["promo", "code"], equals: normalizeCode(code) },
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
  });
}

/**
 * Whether `code` can be used now, and what it takes off. `categories`: the tour categories being
 * booked (one for a single booking, each day's for a package); left out, "Where does it apply"
 * isn't checked (the booking checks it again with the real tour).
 */
export async function lookupPromo(rawCode: string | null | undefined, db: Db = prisma, now = new Date(), categories?: readonly (string | null | undefined)[]): Promise<PromoLookup> {
  const code = normalizeCode(rawCode ?? "");
  if (!code) return { ok: false, reason: "unknown", error: "Enter a promo code." };

  const row = await db.promoCode.findUnique({ where: { code }, include: { affiliate: { select: { code: true, status: true } } } });
  if (row) {
    // A partner's coupon stops working while the partner isn't active (suspended, rejected).
    if (!row.isActive || (row.affiliate && row.affiliate.status !== "ACTIVE")) return { ok: false, reason: "inactive", error: "This promo code is no longer active." };
    if (row.startsAt && row.startsAt > now) return { ok: false, reason: "not_started", error: "This promo code isn't active yet." };
    if (row.expiresAt && row.expiresAt <= now) return { ok: false, reason: "expired", error: "This promo code has expired." };
    if (row.maxUses != null && (await promoUses(code, db)) >= row.maxUses) {
      return { ok: false, reason: "used_up", error: "This promo code has already been fully used." };
    }
    if (categories && !promoCovers(row.appliesTo, categories)) {
      return { ok: false, reason: "not_applicable", error: `This promo code can't be used for this booking. It works on ${scopeLabel(row.appliesTo)} only.` };
    }
    return { ok: true, promo: { code, percentOff: row.percentOff, amountOffCents: row.amountOffCents, affiliateCode: row.affiliate?.code ?? null } };
  }

  const percent = promoPercent(code);
  if (percent != null) return { ok: true, promo: { code, percentOff: percent, amountOffCents: null } };
  return { ok: false, reason: "unknown", error: "Invalid or expired promo code" };
}

/** How the code reads to a guest: "10% off" or "CAD 25 off". */
export function promoLabel(p: Pick<ResolvedPromo, "percentOff" | "amountOffCents">) {
  if (p.percentOff) return `${p.percentOff}% off`;
  if (p.amountOffCents) return `CAD ${(p.amountOffCents / 100).toFixed(p.amountOffCents % 100 ? 2 : 0)} off`;
  return "";
}
