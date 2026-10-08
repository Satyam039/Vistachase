const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");
const catalog = require("./catalog/load-catalog");

const prisma = new PrismaClient();

async function main() {
  console.log("🌲 Seeding Vista Chase Canadian Rockies Platform...");

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

  // 2. Users & Roles
  const adminPassword = await bcrypt.hash("VistaChaseAdmin2026!", 10);
  const operatorPassword = await bcrypt.hash("Operator2026!", 10);
  const dispatchPassword = await bcrypt.hash("Dispatch2026!", 10);
  const customerPassword = await bcrypt.hash("Traveler2026!", 10);

  await prisma.user.create({
    data: {
      email: "admin@vistachase.com",
      passwordHash: adminPassword,
      name: "Vista Chase Admin",
      phone: "+1-825-734-9456",
      role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      email: "operator@vistachase.com",
      passwordHash: operatorPassword,
      name: "Rockies Fleet Operations",
      phone: "+1-825-734-9457",
      role: "OPERATOR",
    },
  });

  await prisma.user.create({
    data: {
      email: "dispatch@vistachase.com",
      passwordHash: dispatchPassword,
      name: "Banff Dispatch Lead",
      phone: "+1-825-734-9458",
      role: "DISPATCHER",
    },
  });

  const traveler = await prisma.user.create({
    data: {
      email: "sarah.traveler@example.com",
      passwordHash: customerPassword,
      name: "Sarah Jenkins",
      phone: "+1-403-555-0192",
      role: "CUSTOMER",
    },
  });

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
  const tourBanffHighlights = tours["banff-highlights-tour"];
  const tourBanffPrivate = tours["banff-private-tour"];

  // 7. Tour Departures (Upcoming real scheduled departures)
  const today = new Date();
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const departures = [];
  for (const date of dates) {
    const dep = await prisma.tourDeparture.create({
      data: {
        tourId: tourBanffHighlights.id,
        date,
        departureTime: "08:30",
        returnTime: "16:30",
        capacityTotal: 12,
        capacityBooked: 4,
        capacityHeld: 0,
        price: 199.0,
        status: "ACTIVE",
      },
    });
    departures.push(dep);
  }

  for (const date of dates) {
    await prisma.tourDeparture.create({
      data: {
        // Linked to the product too, so its card, product page, search and the concierge see the dates.
        shuttleRouteId: routeSunrise.id,
        tourId: tours["sunrise-shuttle-to-moraine-lake-and-lake-louise"].id,
        date,
        departureTime: "05:00",
        returnTime: "09:30",
        capacityTotal: 12,
        capacityBooked: 6,
        capacityHeld: 0,
        price: 125.0,
        status: "ACTIVE",
      },
    });
  }

  for (const date of dates) {
    await prisma.tourDeparture.create({
      data: {
        shuttleRouteId: routeConnector.id,
        tourId: tours["full-day-at-lake-louise-and-moraine-lake"].id,
        date,
        departureTime: "09:00",
        returnTime: "14:00",
        capacityTotal: 12,
        capacityBooked: 2,
        capacityHeld: 0,
        price: 99.0,
        status: "ACTIVE",
      },
    });
  }

  for (const date of dates.slice(0, 5)) {
    await prisma.tourDeparture.create({
      data: {
        tourId: tourBanffPrivate.id,
        date,
        departureTime: "08:00",
        returnTime: "16:00",
        capacityTotal: 6,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 999.0,
        status: "ACTIVE",
      },
    });
  }

  // 8. Reviews: none are seeded. Public reviews are only ones guests leave against a real booking
  // (POST /api/reviews), so the site never shows invented quotes.

  // Demo partner (affiliate): a Banff hotel sharing ?ref=BANFFLODGE links. The sample booking
  // below is credited to it so the partner dashboard has data.
  const partnerUser = await prisma.user.create({
    data: {
      email: "partner.demo@example.com",
      passwordHash: await bcrypt.hash("PartnerDemo2026!", 10),
      name: "Demo Partner",
      role: "AFFILIATE",
    },
  });
  const demoPartner = await prisma.affiliate.create({
    data: { userId: partnerUser.id, name: "Banff Lodge (demo)", code: "BANFFLODGE", type: "HOTEL", status: "ACTIVE", commissionRate: 0.1 },
  });

  // 9. Sample Confirmed Booking with Digital Voucher
  const sampleDeparture = departures[0];
  const sampleBooking = await prisma.booking.create({
    data: {
      bookingReference: "VC-2026-98412",
      affiliateId: demoPartner.id,
      customerId: traveler.id,
      customerName: "Sarah Jenkins",
      customerEmail: "sarah.traveler@example.com",
      customerPhone: "+1-403-555-0192",
      tourDepartureId: sampleDeparture.id,
      pickupStopId: stops[0].id, // Fairmont Banff Springs
      pickupTime: "08:15",
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
      totalSeats: 2,
      subtotal: 398.0,
      tax: 19.9,
      addOnsTotal: 25.0,
      totalAmount: 442.9,
      currency: "CAD",
      status: "CONFIRMED",
      specialRequests: "Window seats preferred, anniversary trip.",
      voucherCode: "VC-VOUCH-7891",
      // Generated locally like real bookings (booking.repository.ts); no third-party QR service
      qrCodeUrl: await QRCode.toDataURL("VC-2026-98412", { margin: 1, width: 300 }),
      items: {
        create: [
          {
            name: "Parks Canada Discovery Pass Assistance",
            price: 25.0,
            quantity: 1,
          },
        ],
      },
      payments: {
        create: [
          {
            amount: 442.9,
            currency: "CAD",
            provider: "mock",
            transactionId: "txn_mock_98412_approved",
            status: "SUCCEEDED",
          },
        ],
      },
    },
  });

  // 8. Fleet Vehicles
  const sprinter4 = await prisma.vehicle.create({
    data: {
      name: "Mercedes-Benz Sprinter Executive #4",
      type: "VAN_14",
      capacity: 14,
      licensePlate: "ALBERTA • 7VC-894",
      vinNumber: "WD3PF4CC2KP098412",
      trackingDeviceId: "GPS-VC-004",
      isActive: true,
      status: "ASSIGNED",
    },
  });

  const sprinter2 = await prisma.vehicle.create({
    data: {
      name: "Mercedes-Benz Sprinter VIP #2",
      type: "VAN_14",
      capacity: 14,
      licensePlate: "ALBERTA • 5VC-201",
      vinNumber: "WD3PF4CC2KP098201",
      trackingDeviceId: "GPS-VC-002",
      isActive: true,
      status: "AVAILABLE",
    },
  });

  const yukon1 = await prisma.vehicle.create({
    data: {
      name: "GMC Yukon Denali XL VIP #1",
      type: "SUV_6",
      capacity: 6,
      licensePlate: "ALBERTA • 8VC-772",
      vinNumber: "1GKS2CKJ8NR184772",
      trackingDeviceId: "GPS-VC-001",
      isActive: true,
      status: "AVAILABLE",
    },
  });

  // 9. Naturalist Guides & Drivers
  const driverMarc = await prisma.driver.create({
    data: {
      name: "Marc Tremblay",
      publicName: "Marc",
      email: "marc@vistachase.com",
      phone: "+1-825-734-9456",
      licenseClass: "Class 4 Commercial",
      bio: "Parks Canada certified master naturalist with 1,400+ Rockies expeditions.",
      photoUrl: null, // no guide photos yet; the tracking page shows the Vista Chase emblem
      rating: 4.98,
      isActive: true,
    },
  });

  const driverSarah = await prisma.driver.create({
    data: {
      name: "Sarah MacLeod",
      publicName: "Sarah",
      email: "sarah.m@vistachase.com",
      phone: "+1-825-734-9457",
      licenseClass: "Class 4 Commercial",
      bio: "Senior alpine wildlife specialist and certified Lake Louise interpretive guide.",
      photoUrl: null, // no guide photos yet; the tracking page shows the Vista Chase emblem
      rating: 4.99,
      isActive: true,
    },
  });

  // 10. Bokun product IDs come from prisma/catalog/product-map.json (placeholders until provided)

  // 11. Mornby Operations Run for Today's Departures
  const todayStr = new Date().toISOString().split("T")[0];
  const operationRun = await prisma.operationRun.create({
    data: {
      name: "Run 1 - Lake Louise & Moraine Explorer",
      date: todayStr,
      departureTime: "08:30",
      tourDepartureId: sampleDeparture.id,
      vehicleId: sprinter4.id,
      driverId: driverMarc.id,
      status: "DISPATCHED",
      notes: "Clear alpine conditions. Pre-trip vehicle inspection complete at Canmore fleet depot.",
    },
  });

  // 12. Run Booking Manifest Link
  await prisma.runBooking.create({
    data: {
      runId: operationRun.id,
      bookingId: sampleBooking.id,
      pickupOrder: 1,
      isBoarded: false,
      notes: "Pick up at Fairmont Banff Springs Main Motor Court. Anniversary couple.",
    },
  });

  // 13. Secure Live GPS Tracking Session
  const trackingToken = "4c75291326d8a68f983439c4291bcdfe92c5deaaecaf03d1be8d721b248f3d2a";
  await prisma.trackingSession.create({
    data: {
      runId: operationRun.id,
      token: trackingToken,
      isActive: true,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    },
  });

  // Update sample booking with tracking token
  await prisma.booking.update({
    where: { id: sampleBooking.id },
    data: {
      trackingToken,
      trackingTokenExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      bokunBookingId: "BK-VC-2026-98412",
    },
  });

  // 14. Initial Live GPS Coordinates
  await prisma.vehiclePosition.create({
    data: {
      vehicleId: sprinter4.id,
      latitude: 51.1352,
      longitude: -115.4215,
      heading: 315,
      speedKmh: 72,
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log(`- Sample Admin: admin@vistachase.com / VistaChaseAdmin2026!`);
  console.log(`- Demo Partner: partner.demo@example.com / PartnerDemo2026! (ref code BANFFLODGE)`);
  console.log(`- Sample Booking: ${sampleBooking.bookingReference} (Voucher: ${sampleBooking.voucherCode})`);
  console.log(`- Sample Run: ${operationRun.name} (Vehicle: ${sprinter4.name}, Driver: ${driverMarc.name})`);
  console.log(`- Sample Live Tracking: /track/${trackingToken}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
