// Copies Bókun product IDs and booking modes from prisma/catalog/product-map.json into the
// database's tours, without touching anything else (re-running the seed would wipe users and
// bookings). Shows the changes first; writes only with --apply.
//
//   DATABASE_URL=… npx tsx scripts/apply-product-map.ts            preview
//   DATABASE_URL=… npx tsx scripts/apply-product-map.ts --apply    write

import prisma from "../src/lib/db/prisma";
import { PRODUCT_MAP } from "../src/modules/bokun/product-map";

async function main() {
  const apply = process.argv.includes("--apply");
  const tours = await prisma.tour.findMany({ select: { id: true, slug: true, bokunId: true, bookingMode: true } });
  const bySlug = new Map(tours.map((t) => [t.slug, t]));

  const changes = PRODUCT_MAP.flatMap((p) => {
    const tour = bySlug.get(p.slug);
    if (!tour) return [];
    const bokunId = p.bokunId ?? null;
    if (tour.bokunId === bokunId && tour.bookingMode === p.bookingMode) return [];
    return [{ tour, bokunId, bookingMode: p.bookingMode }];
  });

  if (changes.length === 0) return console.log("Database already matches product-map.json.");
  for (const c of changes) {
    console.log(`${c.tour.slug}: Bókun ${c.tour.bokunId ?? "none"} → ${c.bokunId ?? "none"}, ${c.tour.bookingMode} → ${c.bookingMode}`);
  }
  if (!apply) return console.log(`\n${changes.length} change(s). Run again with --apply to write them.`);

  // Bókun IDs are unique, so clear the changing ones first (two tours may swap IDs), then set.
  await prisma.$transaction([
    ...changes.map((c) => prisma.tour.update({ where: { id: c.tour.id }, data: { bokunId: null } })),
    ...changes.map((c) => prisma.tour.update({ where: { id: c.tour.id }, data: { bokunId: c.bokunId, bookingMode: c.bookingMode as never } })),
  ]);
  console.log(`\nUpdated ${changes.length} tour(s).`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
