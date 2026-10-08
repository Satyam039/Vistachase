import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  const admin = await prisma.user.create({
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
  const destBanff = await prisma.destination.create({
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

  const destMoraine = await prisma.destination.create({
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

  const destLouise = await prisma.destination.create({
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

  const destJasper = await prisma.destination.create({
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

  const destYoho = await prisma.destination.create({
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

  const routeGoldenHour = await prisma.shuttleRoute.create({
    data: {
      slug: "golden-hour-rockies-shuttle",
      name: "Golden Hour & Sunset Rockies Shuttle",
      origin: "Banff / Canmore",
      destination: "Moraine Lake & Lake Louise",
      description: "Late afternoon departure timed for photographer's golden hour lighting, tranquil crowd-free trails, and twilight lake reflections.",
      notes: "Ideal for photographers and travelers avoiding morning peak hours.",
    },
  });

  // 6. Tours (Preserving exact URLs!)
  const tourBanffHighlights = await prisma.tour.create({
    data: {
      slug: "banff-highlights-tour",
      title: "Lake Louise, Moraine Lake & Banff Highlights Tour",
      category: "SHARED",
      durationHours: 8.0,
      summary: "Canada's #6 Best Experience by TripAdvisor. Small group shared tour to Lake Louise, Moraine Lake, Bow Falls & Surprise Corner.",
      description: "Join Canada's highest rated small-group experience. With a maximum of 12 guests per luxury transit van, you will experience the iconic turquoise waters of Moraine Lake and Lake Louise with guaranteed access, skip parking headaches, and hear authentic Canadian Rockies history from our passionate local guides.",
      inclusions: JSON.stringify([
        "Guaranteed commercial access to Moraine Lake Road",
        "Round-trip hotel pickup & drop-off in Banff & Canmore",
        "Complimentary hot beverages & bottled spring water",
        "Expert certified interpretive guide",
        "High-definition binoculars & wildlife spotting",
      ]),
      exclusions: JSON.stringify([
        "Parks Canada Discovery Pass (can be added at checkout)",
        "Guide gratuities (optional)",
        "Lunch (can be pre-ordered)",
      ]),
      highlights: JSON.stringify([
        "Moraine Lake Rockpile & Canoes (2 hours)",
        "Lake Louise Shoreline & Chateau (1.5 hours)",
        "Surprise Corner View of Fairmont Banff Springs",
        "Bow Falls & Two Jack Lake scenic drive",
      ]),
      whatToBring: JSON.stringify([
        "Sturdy walking shoes or hiking sneakers",
        "Layered clothing (weather changes rapidly in mountains)",
        "Camera or smartphone",
        "Water bottle & sunglasses",
      ]),
      featuredImage: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1200&auto=format&fit=crop",
      galleryImages: JSON.stringify([
        "https://images.unsplash.com/photo-1536152470836-b943b246224c?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop",
      ]),
      basePrice: 189.0,
      currency: "CAD",
      minGroupSize: 1,
      maxGroupSize: 12,
      isFeatured: true,
      rating: 5.0,
      reviewCount: 742,
      destinationId: destBanff.id,
    },
  });

  const tourBanffPrivate = await prisma.tour.create({
    data: {
      slug: "banff-private-tour",
      title: "Luxury Private SUV Tour: Banff & Lake Louise",
      category: "PRIVATE",
      durationHours: 8.0,
      summary: "Your day, your way. Full-size luxury SUV (GMC Yukon XL / Suburban) with dedicated guide for up to 6 guests.",
      description: "Discover the Canadian Rockies in total comfort, privacy, and flexibility. Set your own departure time, adjust stops based on weather and your interests, and enjoy personalized attention from a dedicated local interpretive specialist.",
      inclusions: JSON.stringify([
        "Full-size Luxury SUV with leather seating & climate control",
        "Private certified Rockies interpretive guide",
        "Door-to-door hotel pickup anywhere in Banff or Canmore",
        "Guaranteed Moraine Lake commercial permits",
        "Gourmet snacks, hot drinks & cold refreshments",
      ]),
      exclusions: JSON.stringify(["National Park entry pass"]),
      highlights: JSON.stringify([
        "Exclusive flexible itinerary customized to your family",
        "Moraine Lake & Lake Louise VIP access",
        "Hidden wildlife corridors off the beaten path",
        "Johnston Canyon Lower Falls or Bow Valley Parkway",
      ]),
      whatToBring: JSON.stringify(["Comfortable footwear, sun protection, light jacket"]),
      featuredImage: "https://images.unsplash.com/photo-1536152470836-b943b246224c?q=80&w=1200&auto=format&fit=crop",
      galleryImages: JSON.stringify([
        "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1000&auto=format&fit=crop",
      ]),
      basePrice: 1250.0,
      currency: "CAD",
      minGroupSize: 1,
      maxGroupSize: 6,
      isFeatured: true,
      rating: 5.0,
      reviewCount: 318,
      destinationId: destBanff.id,
    },
  });

  const tourBanffYoho = await prisma.tour.create({
    data: {
      slug: "banff-yoho-custom-private-tour",
      title: "Banff & Yoho National Parks Custom Private Tour",
      category: "PRIVATE",
      durationHours: 9.0,
      summary: "Cross the Continental Divide to Emerald Lake, Natural Bridge & Takakkaw Falls with private luxury transport.",
      description: "Combine the highlights of Banff with the serene majesty of Yoho National Park. Stand beneath the second tallest waterfall in Canada and marvel at the emerald waters nestled among towering peaks.",
      inclusions: JSON.stringify([
        "Private luxury van or SUV transportation",
        "Expert certified private guide",
        "Hotel pickup and drop-off",
        "All permits and parking arrangements",
      ]),
      exclusions: JSON.stringify(["Lunch, gratuities"]),
      highlights: JSON.stringify([
        "Emerald Lake shoreline walk and historical lodge",
        "Natural Bridge spanning the Kicking Horse River",
        "Takakkaw Falls 373-meter vertical drop",
        "Spiral Tunnels train engineering viewpoint",
      ]),
      whatToBring: JSON.stringify(["Rain jacket, walking shoes, camera"]),
      featuredImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
      galleryImages: JSON.stringify([
        "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1000&auto=format&fit=crop",
      ]),
      basePrice: 1395.0,
      currency: "CAD",
      minGroupSize: 1,
      maxGroupSize: 7,
      isFeatured: false,
      rating: 4.9,
      reviewCount: 145,
      destinationId: destYoho.id,
    },
  });

  const tourIcefields = await prisma.tour.create({
    data: {
      slug: "icefields-jasper-private-tour",
      title: "Icefields Parkway & Jasper Full-Day Private Tour",
      category: "PRIVATE",
      durationHours: 10.0,
      summary: "Traverse one of National Geographic's top 10 scenic drives on Earth. Peyto Lake, Bow Lake & Columbia Icefield.",
      description: "The Icefields Parkway connects Lake Louise to Jasper through a breathtaking corridor of over 100 glaciers, hanging valleys, and waterfalls. Enjoy private transport with frequent scenic photo stops at Bow Lake, the wolf-head shaped Peyto Lake viewpoint, and the Athabasca Glacier.",
      inclusions: JSON.stringify([
        "Luxury SUV with panoramic viewing windows",
        "Private guide and glacier narration",
        "Complimentary hot chocolate, tea & coffee",
        "Door-to-door hotel transport",
      ]),
      exclusions: JSON.stringify(["Ice Explorer glacier vehicle ticket (optional)"]),
      highlights: JSON.stringify([
        "Peyto Lake wolf-shaped panoramic viewpoint",
        "Bow Lake & historic Num-Ti-Jah Lodge",
        "Columbia Icefield Discovery Centre & Athabasca Glacier",
        "Weeping Wall & Sunwapta Falls",
      ]),
      whatToBring: JSON.stringify(["Warm jacket, sturdy footwear, sunglasses"]),
      featuredImage: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop",
      galleryImages: JSON.stringify([
        "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1000&auto=format&fit=crop",
      ]),
      basePrice: 1650.0,
      currency: "CAD",
      minGroupSize: 1,
      maxGroupSize: 6,
      isFeatured: true,
      rating: 5.0,
      reviewCount: 198,
      destinationId: destJasper.id,
    },
  });

  const tourJasperCustom = await prisma.tour.create({
    data: {
      slug: "jasper-custom-private-tour",
      title: "Jasper National Park Custom Private Tour",
      category: "PRIVATE",
      durationHours: 8.0,
      summary: "Customizable private tour exploring Maligne Lake, Spirit Island cruise access, and Maligne Canyon.",
      description: "Experience the rugged northern wonder of Jasper National Park at your pace. Take a cruise to legendary Spirit Island, walk along the limestone gorge of Maligne Canyon, and spot elk and bighorn sheep.",
      inclusions: JSON.stringify([
        "Private SUV transportation",
        "Certified local interpretive guide",
        "Hotel pickup in Jasper, Lake Louise, or Banff",
      ]),
      exclusions: JSON.stringify(["Maligne Lake cruise ticket, meals"]),
      highlights: JSON.stringify([
        "Maligne Canyon 50-meter deep gorges",
        "Medicine Lake mysterious disappearing waters",
        "Maligne Lake & optional Spirit Island cruise",
      ]),
      whatToBring: JSON.stringify(["Hiking boots, windbreaker, camera"]),
      featuredImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
      galleryImages: JSON.stringify([]),
      basePrice: 1450.0,
      currency: "CAD",
      minGroupSize: 1,
      maxGroupSize: 6,
      isFeatured: false,
      rating: 4.9,
      reviewCount: 88,
      destinationId: destJasper.id,
    },
  });

  const tourMultiDay = await prisma.tour.create({
    data: {
      slug: "multi-day-tour-package-for-banff",
      title: "Complete Canadian Rockies 3-Day Luxury Adventure Package",
      category: "MULTIDAY",
      durationHours: 24.0,
      summary: "All-inclusive multi-day itinerary. Airport pickup in Calgary, guaranteed Lake Louise & Moraine Lake, and Yoho Park.",
      description: "Save more, stress less. We handle every detail: Calgary International Airport (YYC) pickup, luxury hotel transfers, guaranteed sunrise shuttle to Moraine Lake, Lake Louise shoreline time, Yoho National Park private excursions, and return airport drop-off. One vehicle, one dedicated team, zero logistical worries.",
      inclusions: JSON.stringify([
        "Calgary Airport (YYC) private round-trip transfers",
        "3 full days of curated private & small-group guiding",
        "Guaranteed Moraine Lake & Lake Louise access",
        "Complimentary hot beverages & fresh snacks daily",
        "All national park permits & vehicle passes",
      ]),
      exclusions: JSON.stringify(["Hotel accommodations, evening dinners"]),
      highlights: JSON.stringify([
        "Day 1: Calgary Airport pickup & Banff orientation",
        "Day 2: Sunrise Moraine Lake & Lake Louise VIP experience",
        "Day 3: Yoho National Park & Icefields Parkway highlights",
      ]),
      whatToBring: JSON.stringify(["Weekend luggage, all-weather mountain apparel"]),
      featuredImage: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1200&auto=format&fit=crop",
      galleryImages: JSON.stringify([
        "https://images.unsplash.com/photo-1536152470836-b943b246224c?q=80&w=1000&auto=format&fit=crop",
      ]),
      basePrice: 2890.0,
      currency: "CAD",
      minGroupSize: 2,
      maxGroupSize: 8,
      isFeatured: true,
      rating: 5.0,
      reviewCount: 94,
      destinationId: destBanff.id,
    },
  });

  // 7. Tour Departures (Upcoming real scheduled departures)
  const today = new Date();
  const dates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Create departures for shared tour
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
        price: 189.0,
        status: "ACTIVE",
      },
    });
    departures.push(dep);
  }

  // Create departures for Sunrise Shuttle
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
        price: 89.0,
        status: "ACTIVE",
      },
    });
  }

  // Create departures for Connector Shuttle
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
        price: 75.0,
        status: "ACTIVE",
      },
    });
  }

  // Create departures for Private Tour
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
        price: 1250.0,
        status: "ACTIVE",
      },
    });
  }

  // 8. Reviews: none are seeded. Public reviews are only ones guests leave against a real booking
  // (POST /api/reviews), so the site never shows invented quotes.

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
      subtotal: 378.0,
      tax: 18.9,
      addOnsTotal: 25.0,
      totalAmount: 421.9,
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
            amount: 421.9,
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
