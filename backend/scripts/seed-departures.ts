// Seeds the rolling schedule of departures for the next 60 days for the instant-booking products
// (fixed times, capacity and prices below). Existing departures are left as they are.
//
// Usage:
//   npx tsx scripts/seed-departures.ts
//   npm run seed:departures

import prisma from "../src/lib/db/prisma";
import { PRODUCT_MAP } from "../src/modules/tours/product-map";
import { dateOnly, timeOfDay, todayInMountainTime } from "../src/lib/utils/time";

interface ScheduleConfig {
  slug: string;
  times: string[];
  capacity: number;
  price: number; // in cents
  childPrice?: number | null;
}

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
  {
    slug: "full-day-at-lake-louise-and-moraine-lake",
    times: ["09:00"],
    capacity: 14,
    price: 9900,
    childPrice: null,
  },
  {
    slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
    times: ["05:00"],
    capacity: 14,
    price: 8900,
    childPrice: null,
  },
];

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

    for (let dayOffset = 1; dayOffset <= daysCount; dayOffset++) {
      const targetDate = new Date(startDate);
      targetDate.setUTCDate(startDate.getUTCDate() + dayOffset);
      const isoDateStr = targetDate.toISOString().slice(0, 10);

      for (const timeStr of item.times) {
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
            capacityTotal: item.capacity,
            capacityBooked: 0,
            capacityHeld: 0,
            price: item.price,
            childPrice: item.childPrice ?? null,
            currency: tour.currency || "CAD",
            status: "ACTIVE",
          },
        });
        totalCreated++;
      }
    }
    console.log(`  ✓ ${item.slug}: verified/seeded schedule for next ${daysCount} days`);
  }

  console.log(`\n✅ Finished: Created ${totalCreated} new departures (${totalExisting} already existed).`);
}

async function main() {
  await seedFallbackSchedule(60);
}

main()
  .catch((err) => {
    console.error("❌ Error in seed-departures:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
