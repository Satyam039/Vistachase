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
}

export type PromoLookup =
  | { ok: true; promo: ResolvedPromo }
  | { ok: false; reason: "unknown" | "inactive" | "not_started" | "expired" | "used_up"; error: string };

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

/** Whether `code` can be used now, and what it takes off. */
export async function lookupPromo(rawCode: string | null | undefined, db: Db = prisma, now = new Date()): Promise<PromoLookup> {
  const code = normalizeCode(rawCode ?? "");
  if (!code) return { ok: false, reason: "unknown", error: "Enter a promo code." };

  const row = await db.promoCode.findUnique({ where: { code } });
  if (row) {
    if (!row.isActive) return { ok: false, reason: "inactive", error: "This promo code is no longer active." };
    if (row.startsAt && row.startsAt > now) return { ok: false, reason: "not_started", error: "This promo code isn't active yet." };
    if (row.expiresAt && row.expiresAt <= now) return { ok: false, reason: "expired", error: "This promo code has expired." };
    if (row.maxUses != null && (await promoUses(code, db)) >= row.maxUses) {
      return { ok: false, reason: "used_up", error: "This promo code has already been fully used." };
    }
    return { ok: true, promo: { code, percentOff: row.percentOff, amountOffCents: row.amountOffCents } };
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
