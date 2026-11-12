// Staff promo-code editor (Admin → Promo codes). Codes are percent or fixed CAD amount off the
// tour fare, with optional first/last day (Mountain Time) and a use limit. The checkout and the
// booking check them through modules/pricing/promo-codes.ts.

import prisma from "@/lib/db/prisma";
import { promoCodes } from "@/modules/pricing/booking-pricing";
import { normalizeCode, PROMO_USE_STATUSES, promoLabel } from "@/modules/pricing/promo-codes";
import { dateOnly, getMountainTimeInstant, timeOfDay, todayInMountainTime } from "@/lib/utils/time";

export interface PromoInput {
  code: string;
  kind: "PERCENT" | "AMOUNT";
  /** Percent (1-100) or CAD dollars, by `kind`. */
  value: number;
  isActive?: boolean;
  /** First and last day it works (YYYY-MM-DD, Mountain Time); null = no limit. */
  startsOn?: string | null;
  endsOn?: string | null;
  maxUses?: number | null;
  note?: string;
}

const startOfDay = (day: string, plusDays = 0) => {
  const d = dateOnly(day);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return getMountainTimeInstant(d, timeOfDay("00:00"));
};

function toData(input: Partial<PromoInput>) {
  const data: Record<string, unknown> = {};
  if (input.code !== undefined) data.code = normalizeCode(input.code);
  if (input.kind !== undefined && input.value !== undefined) {
    data.percentOff = input.kind === "PERCENT" ? Math.round(input.value) : null;
    data.amountOffCents = input.kind === "AMOUNT" ? Math.round(input.value * 100) : null;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.startsOn !== undefined) data.startsAt = input.startsOn ? startOfDay(input.startsOn) : null;
  // Works through the whole last day.
  if (input.endsOn !== undefined) data.expiresAt = input.endsOn ? startOfDay(input.endsOn, 1) : null;
  if (input.maxUses !== undefined) data.maxUses = input.maxUses;
  if (input.note !== undefined) data.note = input.note;
  return data;
}

async function usesByCode(codes: string[]) {
  if (codes.length === 0) return new Map<string, { live: number; paid: number }>();
  const rows = await prisma.$queryRaw<{ code: string; live: bigint; paid: bigint }[]>`
    SELECT "priceSnapshot"->'promo'->>'code' AS code,
           COUNT(*) FILTER (WHERE "status"::text = ANY(${[...PROMO_USE_STATUSES]})) AS live,
           COUNT(*) FILTER (WHERE "status"::text IN ('CONFIRMED', 'PAID_UNSYNCED', 'COMPLETED')) AS paid
    FROM "Booking"
    WHERE "priceSnapshot"->'promo'->>'code' = ANY(${codes})
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.code, { live: Number(r.live), paid: Number(r.paid) }]));
}

export async function listPromos(now = new Date()) {
  const rows = await prisma.promoCode.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  const settingCodes = [...promoCodes().entries()].filter(([code]) => !rows.some((r) => r.code === code));
  const uses = await usesByCode([...rows.map((r) => r.code), ...settingCodes.map(([c]) => c)]);
  const promos = rows.map((r) => {
    const u = uses.get(r.code) ?? { live: 0, paid: 0 };
    const state = !r.isActive
      ? "OFF"
      : r.startsAt && r.startsAt > now
        ? "SCHEDULED"
        : r.expiresAt && r.expiresAt <= now
          ? "EXPIRED"
          : r.maxUses != null && u.live >= r.maxUses
            ? "USED_UP"
            : "LIVE";
    return {
      id: r.id,
      code: r.code,
      kind: r.percentOff ? ("PERCENT" as const) : ("AMOUNT" as const),
      value: r.percentOff ?? (r.amountOffCents ?? 0) / 100,
      label: promoLabel(r),
      isActive: r.isActive,
      startsOn: r.startsAt ? todayInMountainTime(r.startsAt) : null,
      endsOn: r.expiresAt ? todayInMountainTime(new Date(r.expiresAt.getTime() - 1)) : null,
      maxUses: r.maxUses,
      uses: u.live,
      paidBookings: u.paid,
      note: r.note,
      state,
    };
  });
  // Codes from the server's PROMO_CODES setting: read-only here.
  const fromSettings = settingCodes.map(([code, percent]) => ({ code, label: `${percent}% off`, uses: uses.get(code)?.live ?? 0, paidBookings: uses.get(code)?.paid ?? 0 }));
  return { promos, fromSettings };
}

function datesError(input: Partial<PromoInput>, existing?: { startsAt: Date | null; expiresAt: Date | null }) {
  const starts = input.startsOn !== undefined ? (input.startsOn ? startOfDay(input.startsOn) : null) : (existing?.startsAt ?? null);
  const ends = input.endsOn !== undefined ? (input.endsOn ? startOfDay(input.endsOn, 1) : null) : (existing?.expiresAt ?? null);
  return starts && ends && ends <= starts ? "The last day must be on or after the first day." : null;
}

export async function createPromo(input: PromoInput) {
  const code = normalizeCode(input.code);
  if (await prisma.promoCode.findUnique({ where: { code } })) return { status: 409, error: `${code} already exists. Edit it instead.` } as const;
  const bad = datesError(input);
  if (bad) return { status: 400, error: bad } as const;
  const promo = await prisma.promoCode.create({ data: toData({ ...input, code }) as never });
  return { status: 201, promo } as const;
}

export async function updatePromo(id: string, input: Partial<PromoInput>) {
  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) return { status: 404, error: "Promo code not found" } as const;
  if (input.code !== undefined && normalizeCode(input.code) !== existing.code) {
    if (await prisma.promoCode.findUnique({ where: { code: normalizeCode(input.code) } })) return { status: 409, error: `${normalizeCode(input.code)} already exists.` } as const;
  }
  if ((input.kind === undefined) !== (input.value === undefined)) return { status: 400, error: "Send the discount type and value together." } as const;
  const bad = datesError(input, existing);
  if (bad) return { status: 400, error: bad } as const;
  const promo = await prisma.promoCode.update({ where: { id }, data: toData(input) });
  return { status: 200, promo, before: existing } as const;
}

/** Deleting is safe: bookings keep the code and discount in their price snapshot. */
export async function deletePromo(id: string) {
  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) return { status: 404, error: "Promo code not found" } as const;
  await prisma.promoCode.delete({ where: { id } });
  return { status: 200, promo: existing } as const;
}
