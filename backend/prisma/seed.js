const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const catalog = require("./catalog/load-catalog");

const prisma = new PrismaClient();

async function main() {
  console.log("🌲 Seeding Vista Chase Canadian Rockies Platform...");

  // This script replaces the whole catalog by deleting every table first. On a database that
  // already has bookings that would destroy them, so it refuses unless explicitly forced.
  const existingBookings = await prisma.booking.count().catch(() => 0);
  if (existingBookings > 0 && process.env.SEED_ALLOW_WIPE !== "true") {
    console.error(`❌ Refusing to seed: the database has ${existingBookings} bookings, and seeding deletes everything. Set SEED_ALLOW_WIPE=true only on a test database.`);
    process.exit(1);
  }

  // 1. Clean existing records in correct order
  await prisma.whatsAppNotification.deleteMany();
  await prisma.runBooking.deleteMany();
  await prisma.trackingSession.deleteMany();
  await prisma.vehiclePosition.deleteMany();
  await prisma.operationRun.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.bokunSyncLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingAddOn.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.reservationHold.deleteMany();
  await prisma.tourDeparture.deleteMany();
  await prisma.shuttleStop.deleteMany();
  await prisma.shuttleRoute.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.destination.deleteMany();
  await prisma.affiliate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mediaAsset.deleteMany();

  // 3. Destinations
  await prisma.destination.create({
    data: {
      slug: "banff-national-park",
      name: "Banff National Park",
      province: "Alberta",
      region: "Canadian Rockies",
      description: "Canada's first and most iconic national park, featuring pristine glacial lakes, towering peaks, wildlife corridors, and the historic alpine town of Banff.",
      heroImage: catalog.mediaSrc("photos/vermilion-lakes-mount-rundle"),
      isFeatured: true,
      metaTitle: "Banff National Park Tours & Shuttles | Vista Chase",
      metaDescription: "Experience Banff National Park with luxury private SUV tours, guaranteed lake shuttles, and local expert guides.",
    },
  });

  await prisma.destination.create({
    data: {
      slug: "moraine-lake",
      name: "Moraine Lake & Valley of the Ten Peaks",
      province: "Alberta",
      region: "Canadian Rockies",
      description: "Famed for its vivid turquoise waters fed by the Ten Peaks glaciers. Private vehicular access is restricted; Vista Chase provides guaranteed commercial shuttle permits.",
      heroImage: catalog.mediaSrc("photos/moraine-lake-perfect-reflection"),
      isFeatured: true,
      metaTitle: "Moraine Lake Guaranteed Shuttles & Tours | Vista Chase",
      metaDescription: "Guaranteed access to Moraine Lake. Avoid parking road closures with our Sunrise and Golden Hour shuttles from Banff and Canmore.",
    },
  });

  await prisma.destination.create({
    data: {
      slug: "lake-louise",
      name: "Lake Louise",
      province: "Alberta",
      region: "Canadian Rockies",
      description: "The jewel of the Rockies with emerald waters, the majestic Victoria Glacier backdrop, and world-class alpine hiking trails.",
      heroImage: catalog.mediaSrc("photos/lake-louise-sunrise"),
      isFeatured: true,
      metaTitle: "Lake Louise Tours & Direct Shuttles | Vista Chase",
      metaDescription: "Visit Lake Louise without parking frustration. Direct hotel pickups in Banff and Canmore with guaranteed lakeside drop-off.",
    },
  });

  await prisma.destination.create({
    data: {
      slug: "jasper-national-park",
      name: "Jasper National Park & Icefields",
      province: "Alberta",
      region: "Canadian Rockies",
      description: "Vast wilderness, rugged canyon waterfalls, ancient glaciers along the Icefields Parkway, and pristine mountain solitude.",
      heroImage: catalog.mediaSrc("photos/spirit-island"),
      isFeatured: true,
      metaTitle: "Jasper & Icefields Parkway Private Tours | Vista Chase",
      metaDescription: "Private SUV day trips and multi-day tours along the world-renowned Icefields Parkway to Jasper National Park.",
    },
  });

  await prisma.destination.create({
    data: {
      slug: "yoho-national-park",
      name: "Yoho National Park",
      province: "British Columbia",
      region: "Canadian Rockies",
      description: "Home to the thunderous Takakkaw Falls, the vivid green waters of Emerald Lake, and ancient fossil beds.",
      heroImage: catalog.mediaSrc("photos/emerald-lake-island"),
      isFeatured: false,
      metaTitle: "Yoho National Park & Emerald Lake Tours | Vista Chase",
      metaDescription: "Explore Emerald Lake and Natural Bridge with Vista Chase private guides.",
    },
  });

  // 4. Shuttle Stops & Hotel Pickups
  const stopsData = [
    {
      name: "Fairmont Banff Springs Hotel",
      town: "Banff",
      address: "405 Spray Ave, Banff, AB T1L 1J4",
      latitude: 51.1648,
      longitude: -115.5619,
      instructions: "Wait outside the Main Motor Court / Conference Entrance 10 minutes prior.",
      sortOrder: 1,
    },
    {
      name: "Banff Caribou Lodge & Spa",
      town: "Banff",
      address: "552 Banff Ave, Banff, AB T1L 1A9",
      latitude: 51.1894,
      longitude: -115.5658,
      instructions: "Pickup directly at main driveway entrance under the cedar canopy.",
      sortOrder: 2,
    },
    {
      name: "Moose Hotel & Suites",
      town: "Banff",
      address: "345 Banff Ave, Banff, AB T1L 1H8",
      latitude: 51.1818,
      longitude: -115.5702,
      instructions: "Front lobby entrance on Banff Ave.",
      sortOrder: 3,
    },
    {
      name: "The Rimrock Resort Hotel",
      town: "Banff",
      address: "300 Mountain Ave, Banff, AB T1L 1J2",
      latitude: 51.1492,
      longitude: -115.5583,
      instructions: "Main valet area outside front lobby doors.",
      sortOrder: 4,
    },
    {
      name: "Banff Train Station Public Parking",
      town: "Banff",
      address: "327 Railway Ave, Banff, AB T1L 1A1",
      latitude: 51.1798,
      longitude: -115.5786,
      instructions: "Free full-day parking available; shuttle arrives at Bay #3.",
      sortOrder: 5,
    },
    {
      name: "Coast Canmore Hotel & Conference Centre",
      town: "Canmore",
      address: "511 Bow Valley Trail, Canmore, AB T1W 1N7",
      latitude: 51.0921,
      longitude: -115.3523,
      instructions: "Pickup at the Conference Centre main entrance circle.",
      sortOrder: 6,
    },
    {
      name: "The Malcolm Hotel Canmore",
      town: "Canmore",
      address: "321 Spring Creek Dr, Canmore, AB T1W 0K3",
      latitude: 51.0872,
      longitude: -115.3567,
      instructions: "Porte-cochère directly outside front desk.",
      sortOrder: 7,
    },
    {
      name: "Lake Louise Inn",
      town: "Lake Louise",
      address: "210 Village Rd, Lake Louise, AB T0L 1E0",
      latitude: 51.4241,
      longitude: -116.1772,
      instructions: "Wait in the main lobby 5 minutes before scheduled departure.",
      sortOrder: 8,
    },
    {
      name: "Fairmont Chateau Lake Louise",
      town: "Lake Louise",
      address: "111 Lake Louise Dr, Lake Louise, AB T0L 1E0",
      latitude: 51.4178,
      longitude: -116.2168,
      instructions: "Main entrance turnaround near the Bell Captain desk.",
      sortOrder: 9,
    },
  ];

  const stops = [];
  for (const s of stopsData) {
    stops.push(await prisma.shuttleStop.create({ data: s }));
  }

  // 5. Shuttle Routes
  const routeSunrise = await prisma.shuttleRoute.create({
    data: {
      slug: "moraine-lake-sunrise-shuttle",
      name: "Moraine Lake Sunrise Shuttle",
      origin: "Banff / Canmore",
      destination: "Moraine Lake & Rockpile",
      description: "Guaranteed sunrise departure that reaches Moraine Lake before first light, then Lake Louise. Parks Canada entry, a local guide, bottled water and a hot drink included.",
      notes: "Private vehicle road is closed by Parks Canada. Guaranteed commercial access.",
    },
  });

  const routeConnector = await prisma.shuttleRoute.create({
    data: {
      slug: "lake-louise-moraine-connector",
      name: "Lake Louise & Moraine Lake Direct Shuttle",
      origin: "Banff / Canmore / Lake Louise Village",
      destination: "Lake Louise & Moraine Lake",
      description: "Day shuttle to Moraine Lake and Lake Louise without the park-and-ride lines. Round trip from Canmore, Banff and Lake Louise (Samson Mall).",
      notes: "Includes both Moraine Lake and Lake Louise stops.",
    },
  });

  // 6. Tours: the 13 live vistachase.com products, at their live URLs (prisma/catalog)
  const destinationIds = Object.fromEntries(
    (await prisma.destination.findMany({ select: { id: true, slug: true } })).map((d) => [d.slug, d.id]),
  );
  const tours = {};
  for (const [index, product] of catalog.products.entries()) {
    tours[product.slug] = await prisma.tour.create({ data: catalog.toTourData(product, index, destinationIds) });
  }

  console.log("✅ Catalog seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
