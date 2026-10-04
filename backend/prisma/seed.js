const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const catalog = require("./catalog/load-catalog");

const prisma = new PrismaClient();

async function main() {
  console.log("🌲 Seeding Vista Chase Canadian Rockies Platform...");

  // 1. Clean existing records in correct order
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
      heroImage: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1600&auto=format&fit=crop",
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
      heroImage: "https://images.unsplash.com/photo-1536152470836-b943b246224c?q=80&w=1600&auto=format&fit=crop",
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
      heroImage: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1600&auto=format&fit=crop",
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
      heroImage: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1600&auto=format&fit=crop",
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
      heroImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop",
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
      description: "Guaranteed sunrise departure arriving before first light. Witness the iconic pink and golden alpine glow reflecting off the Ten Peaks with hot coffee and cocoa.",
      notes: "Private vehicle road is closed by Parks Canada. Guaranteed commercial access.",
    },
  });

  const routeConnector = await prisma.shuttleRoute.create({
    data: {
      slug: "lake-louise-moraine-connector",
      name: "Lake Louise & Moraine Lake Direct Shuttle",
      origin: "Banff / Canmore / Lake Louise Village",
      destination: "Lake Louise & Moraine Lake",
      description: "Hop between both world-famous lakes without waiting in crowded park-and-ride lines. Direct round-trip door-to-door hotel service.",
      notes: "Includes both Moraine Lake and Lake Louise stops with 2 hours free time at each.",
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
        shuttleRouteId: routeSunrise.id,
        date,
        departureTime: "05:00",
        returnTime: "09:30",
        capacityTotal: 14,
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
        date,
        departureTime: "09:00",
        returnTime: "14:00",
        capacityTotal: 14,
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

  // 8. Reviews
  const reviews = [
    {
      tourId: tourBanffHighlights.id,
      authorName: "Emily & Jason",
      rating: 5,
      title: "Easily the highlight of our 2-week Canada trip!",
      body: "Excellent tour experience. Our guide was professional and the SUV was very comfortable. Getting guaranteed access to Moraine Lake without waking up at 3am to fight for parking made the entire vacation stress-free.",
      date: "September 2026",
      isFeatured: true,
    },
    {
      tourId: tourBanffHighlights.id,
      authorName: "Jessica M.",
      rating: 5,
      title: "Top-notch guidance and photography tips",
      body: "I booked a shared tour and it was easily the best day of my trip. Our guide was incredibly patient, took stunning photos of our group at the Rockpile, and provided warm tea on a chilly morning.",
      date: "August 2026",
      isFeatured: true,
    },
    {
      tourId: tourBanffPrivate.id,
      authorName: "Sarah & Tom",
      rating: 5,
      title: "Worth every penny for our family",
      body: "Our guide was friendly, knowledgeable, and made the day feel completely personal. We learned so much about the flora, fauna, and indigenous history of Banff.",
      date: "August 2026",
      isFeatured: true,
    },
  ];

  for (const r of reviews) {
    await prisma.review.create({ data: r });
  }

  // 9. Sample Confirmed Booking with Digital Voucher
  const sampleDeparture = departures[0];
  const sampleBooking = await prisma.booking.create({
    data: {
      bookingReference: "VC-2026-98412",
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
      qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=VC-2026-98412",
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

  console.log("✅ Seed completed successfully!");
  console.log(`- Sample Admin: admin@vistachase.com / VistaChaseAdmin2026!`);
  console.log(`- Sample Booking: ${sampleBooking.bookingReference} (Voucher: ${sampleBooking.voucherCode})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
