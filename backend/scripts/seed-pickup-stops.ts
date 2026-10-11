// Adds the hotel pickup points the checkout offers (ShuttleStop rows), from the same list the AI
// concierge uses (src/lib/maps/maps.provider.ts). Only stops missing by name are added; existing
// ones, including any staff edited or turned off (isActive = false), are left as they are.
// Safe to run on every deploy.
//
// Usage:
//   npm run seed:pickups

import prisma from "../src/lib/db/prisma";
import { ROCKIES_PICKUP_LOCATIONS } from "../src/lib/maps/maps.provider";

async function main() {
  let added = 0;
  for (const [index, loc] of ROCKIES_PICKUP_LOCATIONS.entries()) {
    const existing = await prisma.shuttleStop.findFirst({ where: { name: loc.name } });
    if (existing) continue;
    await prisma.shuttleStop.create({
      data: {
        name: loc.name,
        town: loc.town,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        instructions: loc.instructions,
        sortOrder: index + 1,
        isActive: true,
      },
    });
    added++;
  }
  const total = await prisma.shuttleStop.count({ where: { isActive: true } });
  console.log(`Pickup stops: added ${added}, ${total} active in total.`);
}

main()
  .catch((err) => {
    console.error("seed-pickup-stops failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
