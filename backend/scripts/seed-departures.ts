// Seeds the rolling schedule of departures for the next 60 days for the instant-booking products
// (fixed times, capacity and prices below). Existing departures are left as they are.
//
// The Moraine Lake & Lake Louise shuttle runs June–September only, on the timetable in the owner's
// doc (same numbers as frontend/src/lib/shuttleSchedule.ts): seven departures a day in June–July,
// five in August–September. Its dates are seeded through the end of the coming season, so summer
// seats can be booked months ahead. Times stored are the Banff pickup and the Banff return.
//
// The owner confirmed these times, seats and prices as the real schedule on 2026-10-11, so the
// departures created here are LOCAL (listed and bookable). If a schedule below stops being
// real, change or remove it here, and take existing dates off sale with
// POST /api/admin/departures/inventory (inventorySource UNVERIFIED).
//
// Usage:
//   npx tsx scripts/seed-departures.ts
//   npm run seed:departures

import prisma from "../src/lib/db/prisma";
import { PRODUCT_MAP } from "../src/modules/tours/product-map";
import { dateOnly, timeOfDay, todayInMountainTime } from "../src/lib/utils/time";

interface Slot {
  time: string;
  returnTime?: string;
  /** Months (1-12) this slot runs; every day when omitted. */
  months?: number[];
}

interface ScheduleConfig {
  slug: string;
  times: (string | Slot)[];
  capacity: number;
  price: number; // in cents
  childPrice?: number | null;
  /** Seed every date until the end of this month (1-12) of its next season, instead of 60 days. */
  seasonEndsMonth?: number;
}

const JUNE_JULY = [6, 7];
const JUNE_SEPTEMBER = [6, 7, 8, 9];

const DEFAULT_SCHEDULES: ScheduleConfig[] = [
  {
    slug: "banff-highlights-tour",
    times: ["08:30"],
    capacity: 12,
    price: 18900,
    childPrice: 11900,
  },
  {
    slug: "shared-tours-heart-of-banff",
    times: ["08:00"],
    capacity: 12,
    price: 14900,
    childPrice: 9900,
  },
  {
    slug: "shared-tours-banff-yoho",
    times: ["08:00"],
    capacity: 12,
    price: 17900,
    childPrice: 10900,
  },
  {
    slug: "shared-tours-icefields-jasper",
    times: ["07:30"],
    capacity: 12,
    price: 22900,
    childPrice: 15900,
  },
  {
    slug: "winter-special",
    times: ["08:30"],
    capacity: 12,
    price: 16900,
    childPrice: 9900,
  },
  {
    slug: "banff-private-tour",
    times: ["07:00", "08:00"],
    capacity: 6,
    price: 99900,
    childPrice: null,
  },
  {
    slug: "icefields-jasper-private-tour",
    times: ["07:00", "08:00"],
    capacity: 6,
    price: 145000,
    childPrice: null,
  },
  {
    slug: "winter-signature-private-tour",
    times: ["08:00"],
    capacity: 6,
    price: 125000,
    childPrice: null,
  },
  // Shuttle departures 3-7 (Morning to Late Afternoon).
  {
    slug: "full-day-at-lake-louise-and-moraine-lake",
    times: [
      { time: "06:30", returnTime: "13:00", months: JUNE_SEPTEMBER },
      { time: "10:15", returnTime: "15:45", months: JUNE_SEPTEMBER },
      { time: "11:30", returnTime: "18:00", months: JUNE_SEPTEMBER },
      { time: "14:00", returnTime: "20:30", months: JUNE_SEPTEMBER },
      { time: "16:45", returnTime: "22:00", months: JUNE_JULY },
    ],
    capacity: 14,
    price: 9900,
    childPrice: null,
    seasonEndsMonth: 9,
  },
  // Shuttle departures 1-2 (Early Morning).
  {
    slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
    times: [
      { time: "03:15", returnTime: "09:00", months: JUNE_JULY },
      { time: "04:15", returnTime: "10:30", months: JUNE_SEPTEMBER },
    ],
    capacity: 14,
    price: 8900,
    childPrice: null,
    seasonEndsMonth: 9,
  },
];

/** Days from `today` to the last day of `month` in its next season (this year's, or next year's once it has passed). */
export function daysToSeasonEnd(today: string, month: number): number {
  const [y, m] = today.split("-").map(Number);
  const year = m <= month ? y : y + 1;
  const end = Date.UTC(year, month, 0); // day 0 of the following month = last day of `month`
  return Math.round((end - Date.UTC(y, m - 1, Number(today.slice(8, 10)))) / 86_400_000);
}

async function seedFallbackSchedule(daysCount = 60) {
  console.log(`📅 Generating rolling 60-day departures schedule for all tours...`);
  const today = todayInMountainTime();
  const startDate = new Date(dateOnly(today));

  let totalCreated = 0;
  let totalExisting = 0;

  for (const item of DEFAULT_SCHEDULES) {
    const tour = await prisma.tour.findUnique({
      where: { slug: item.slug },
      select: { id: true, slug: true, currency: true, category: true },
    });

    if (!tour) {
      console.warn(`⚠️ Tour not found for slug: ${item.slug}, skipping.`);
      continue;
    }

    const days = item.seasonEndsMonth ? daysToSeasonEnd(today, item.seasonEndsMonth) : daysCount;
    for (let dayOffset = 1; dayOffset <= days; dayOffset++) {
      const targetDate = new Date(startDate);
      targetDate.setUTCDate(startDate.getUTCDate() + dayOffset);
      const isoDateStr = targetDate.toISOString().slice(0, 10);

      const month = Number(isoDateStr.slice(5, 7));
      for (const slot of item.times) {
        const { time: timeStr, returnTime, months } = typeof slot === "string" ? { time: slot } as Slot : slot;
        if (months && !months.includes(month)) continue;
        const existing = await prisma.tourDeparture.findFirst({
          where: {
            tourId: tour.id,
            date: dateOnly(isoDateStr),
            departureTime: timeOfDay(timeStr),
          },
        });

        if (existing) {
          totalExisting++;
          continue;
        }

        await prisma.tourDeparture.create({
          data: {
            tourId: tour.id,
            date: dateOnly(isoDateStr),
            departureTime: timeOfDay(timeStr),
            returnTime: returnTime ? timeOfDay(returnTime) : null,
            capacityTotal: item.capacity,
            capacityBooked: 0,
            capacityHeld: 0,
            price: item.price,
            childPrice: item.childPrice ?? null,
            currency: tour.currency || "CAD",
            status: "ACTIVE",
            inventorySource: "LOCAL",
          },
        });
        totalCreated++;
      }
    }
    console.log(`  ✓ ${item.slug}: verified/seeded schedule for next ${days} days`);
  }

  console.log(`\n✅ Finished: Created ${totalCreated} new departures (${totalExisting} already existed).`);
}

async function main() {
  await seedFallbackSchedule(60);
}

if (!process.env.VITEST) main()
  .catch((err) => {
    console.error("❌ Error in seed-departures:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
