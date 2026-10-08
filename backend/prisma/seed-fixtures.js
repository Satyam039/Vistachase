// Test and local-demo fixtures, loaded after prisma/seed.js (the catalog) by tests/global-setup.ts
// and `npm run seed:fixtures`. Never run in production: it creates staff and demo accounts with
// known passwords, a sample booking, a fleet and a live-tracking session. It refuses to run when
// NODE_ENV is "production".
//
// Departure dates and times follow the stored convention in src/lib/utils/time.ts: the date at
// UTC midnight, the wall-clock time (Mountain Time) on 1970-01-01 in UTC. Money is in cents.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const QRCode = require("qrcode");

if (process.env.NODE_ENV === "production") {
  console.error("❌ seed-fixtures.js creates demo accounts and data; it never runs in production.");
  process.exit(1);
}

const prisma = new PrismaClient();
const dateOnly = (iso) => new Date(`${iso}T00:00:00.000Z`);
const timeOfDay = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const isoDay = (offsetDays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log("🧪 Loading test and demo fixtures…");
  const tours = Object.fromEntries((await prisma.tour.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t]));
  const routes = Object.fromEntries((await prisma.shuttleRoute.findMany({ select: { id: true, slug: true } })).map((r) => [r.slug, r]));
  const stops = await prisma.shuttleStop.findMany({ orderBy: { name: "asc" } });
  const need = (map, key) => {
    if (!map[key]) throw new Error(`Fixture needs "${key}" from the catalog seed; run prisma/seed.js first.`);
    return map[key];
  };

  // Users and roles
  const user = async (email, password, name, phone, role) =>
    prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10), name, phone, role } });
  await user("admin@vistachase.com", "VistaChaseAdmin2026!", "Vista Chase Admin", "+1-825-734-9456", "ADMIN");
  await user("operator@vistachase.com", "Operator2026!", "Rockies Fleet Operations", "+1-825-734-9457", "OPERATOR");
  await user("dispatch@vistachase.com", "Dispatch2026!", "Banff Dispatch Lead", "+1-825-734-9458", "DISPATCHER");
  const traveler = await user("sarah.traveler@example.com", "Traveler2026!", "Sarah Jenkins", "+1-403-555-0192", "CUSTOMER");

  // Departures for the next 7 days
  const days = Array.from({ length: 7 }, (_, i) => isoDay(i + 1));
  const departure = (data) => prisma.tourDeparture.create({ data: { capacityHeld: 0, status: "ACTIVE", ...data } });

  const highlights = [];
  for (const day of days) {
    highlights.push(
      await departure({
        tourId: need(tours, "banff-highlights-tour").id,
        date: dateOnly(day), departureTime: timeOfDay("08:30"), returnTime: timeOfDay("16:30"),
        capacityTotal: 12, capacityBooked: 4, price: 19900,
      }),
    );
    await departure({
      shuttleRouteId: need(routes, "moraine-lake-sunrise-shuttle").id,
      tourId: need(tours, "sunrise-shuttle-to-moraine-lake-and-lake-louise").id,
      date: dateOnly(day), departureTime: timeOfDay("05:00"), returnTime: timeOfDay("09:30"),
      capacityTotal: 12, capacityBooked: 6, price: 12500,
    });
    await departure({
      shuttleRouteId: need(routes, "lake-louise-moraine-connector").id,
      tourId: need(tours, "full-day-at-lake-louise-and-moraine-lake").id,
      date: dateOnly(day), departureTime: timeOfDay("09:00"), returnTime: timeOfDay("14:00"),
      capacityTotal: 12, capacityBooked: 2, price: 9900,
    });
  }
  for (const day of days.slice(0, 5)) {
    await departure({
      tourId: need(tours, "banff-private-tour").id,
      date: dateOnly(day), departureTime: timeOfDay("08:00"), returnTime: timeOfDay("16:00"),
      capacityTotal: 6, capacityBooked: 0, price: 99900,
    });
  }

  // Demo partner, credited with the sample booking
  const partnerUser = await user("partner.demo@example.com", "PartnerDemo2026!", "Demo Partner", null, "AFFILIATE");
  const demoPartner = await prisma.affiliate.create({
    data: { userId: partnerUser.id, name: "Banff Lodge (demo)", code: "BANFFLODGE", type: "HOTEL", status: "ACTIVE", commissionRate: 0.1 },
  });

  // Sample confirmed booking with voucher
  const sample = await prisma.booking.create({
    data: {
      bookingReference: "VC-2026-98412",
      affiliateId: demoPartner.id,
      customerId: traveler.id,
      customerName: "Sarah Jenkins",
      customerEmail: "sarah.traveler@example.com",
      customerPhone: "+1-403-555-0192",
      tourDepartureId: highlights[0].id,
      pickupStopId: stops[0]?.id ?? null,
      pickupTime: "08:15",
      adultsCount: 2, childrenCount: 0, infantsCount: 0, totalSeats: 2,
      subtotal: 39800, tax: 1990, addOnsTotal: 2500, totalAmount: 44290,
      currency: "CAD",
      status: "CONFIRMED",
      specialRequests: "Window seats preferred, anniversary trip.",
      voucherCode: "VC-VOUCH-7891",
      qrCodeUrl: await QRCode.toDataURL("VC-2026-98412", { margin: 1, width: 300 }),
      items: { create: [{ name: "Parks Canada Discovery Pass Assistance", price: 2500, quantity: 1 }] },
      payments: { create: [{ amount: 44290, currency: "CAD", provider: "mock", transactionId: "txn_mock_98412_approved", status: "SUCCEEDED" }] },
    },
  });

  // Fleet and guides
  const vehicle = (data) => prisma.vehicle.create({ data: { isActive: true, ...data } });
  const sprinter4 = await vehicle({ name: "Mercedes-Benz Sprinter Executive #4", type: "VAN_14", capacity: 14, licensePlate: "ALBERTA • 7VC-894", vinNumber: "WD3PF4CC2KP098412", trackingDeviceId: "GPS-VC-004", status: "ASSIGNED" });
  await vehicle({ name: "Mercedes-Benz Sprinter VIP #2", type: "VAN_14", capacity: 14, licensePlate: "ALBERTA • 5VC-201", vinNumber: "WD3PF4CC2KP098201", trackingDeviceId: "GPS-VC-002", status: "AVAILABLE" });
  await vehicle({ name: "Luxury SUV #1", type: "SUV_6", capacity: 6, licensePlate: "ALBERTA • 8VC-772", vinNumber: "1GKS2CKJ8NR184772", trackingDeviceId: "GPS-VC-001", status: "AVAILABLE" });

  const driver = (data) => prisma.driver.create({ data: { licenseClass: "Class 4 Commercial", photoUrl: null, isActive: true, ...data } });
  const marc = await driver({ name: "Marc Tremblay", publicName: "Marc", email: "marc@vistachase.com", phone: "+1-825-734-9456", bio: "Test fixture guide.", rating: 4.98 });
  await driver({ name: "Sarah MacLeod", publicName: "Sarah", email: "sarah.m@vistachase.com", phone: "+1-825-734-9457", bio: "Test fixture guide.", rating: 4.99 });

  // Today's operations run, manifest and live-tracking session
  const run = await prisma.operationRun.create({
    data: {
      name: "Run 1 - Lake Louise & Moraine Explorer",
      date: dateOnly(isoDay(0)),
      departureTime: timeOfDay("08:30"),
      tourDepartureId: highlights[0].id,
      vehicleId: sprinter4.id,
      driverId: marc.id,
      status: "DISPATCHED",
      notes: "Test fixture run.",
    },
  });
  await prisma.runBooking.create({ data: { runId: run.id, bookingId: sample.id, pickupOrder: 1, isBoarded: false } });

  const trackingToken = "4c75291326d8a68f983439c4291bcdfe92c5deaaecaf03d1be8d721b248f3d2a";
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await prisma.trackingSession.create({ data: { runId: run.id, token: trackingToken, isActive: true, expiresAt } });
  await prisma.booking.update({
    where: { id: sample.id },
    data: { trackingToken, trackingTokenExpiresAt: expiresAt, bokunBookingId: "BK-VC-2026-98412" },
  });
  await prisma.vehiclePosition.create({ data: { vehicleId: sprinter4.id, latitude: 51.1352, longitude: -115.4215, heading: 315, speedKmh: 72 } });

  console.log(`✅ Fixtures loaded: ${days.length} days of departures, sample booking ${sample.bookingReference}, partner BANFFLODGE.`);
}

main()
  .catch((e) => {
    console.error("❌ Fixture error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
