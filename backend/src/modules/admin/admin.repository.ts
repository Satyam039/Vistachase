import prisma from "@/lib/db/prisma";
import { dateOnly, formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";

export async function getAdminMetrics() {
  const [
    totalBookings,
    confirmedBookings,
    totalUsers,
    totalDepartures,
    recentBookings,
    activeHoldsCount,
    revenueAgg,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.user.count(),
    prisma.tourDeparture.count(),
    prisma.booking.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        tourDeparture: {
          include: { tour: true, shuttleRoute: true },
        },
      },
    }),
    prisma.reservationHold.count({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
    }),
  ]);

  // Amounts are stored in cents; the dashboard shows dollars.
  return {
    totalBookings,
    confirmedBookings,
    totalUsers,
    totalDepartures,
    activeHoldsCount,
    totalRevenue: (revenueAgg._sum.amount || 0) / 100,
    recentBookings: recentBookings.map((b) => ({ ...b, subtotal: b.subtotal / 100, tax: b.tax / 100, addOnsTotal: b.addOnsTotal / 100, totalAmount: b.totalAmount / 100 })),
  };
}

export async function getDispatchManifest(date: string) {
  const departures = await prisma.tourDeparture.findMany({
    where: { date: dateOnly(date) },
    include: {
      tour: true,
      shuttleRoute: true,
      bookings: {
        where: { status: "CONFIRMED" },
        include: {
          pickupStop: true,
        },
        orderBy: { pickupTime: "asc" },
      },
    },
    orderBy: { departureTime: "asc" },
  });

  // Group passengers by pickup stop for each departure
  const manifests = departures.map((dep) => {
    const stopsMap = new Map<string, { stopName: string; address?: string; pickupTime?: string; bookings: typeof dep.bookings }>();

    for (const b of dep.bookings) {
      const stopKey = b.pickupStopId || b.pickupCustomText || "Default Central Pickup";
      const stopName = b.pickupStop?.name || b.pickupCustomText || "Banff Central Dispatch Point";
      const address = b.pickupStop?.address ? `${b.pickupStop.address}, ${b.pickupStop.town}` : undefined;
      const pickupTime = b.pickupTime || dep.departureTime;

      if (!stopsMap.has(stopKey)) {
        stopsMap.set(stopKey, {
          stopName,
          address,
          pickupTime: pickupTime instanceof Date ? pickupTime.toISOString() : pickupTime,
          bookings: [],
        });
      }
      stopsMap.get(stopKey)!.bookings.push(b);
    }

    const stops = Array.from(stopsMap.values());
    const totalPassengers = dep.bookings.reduce((sum, b) => sum + b.totalSeats, 0);
    const boardedPassengers = dep.bookings
      .filter((b) => b.isBoarded)
      .reduce((sum, b) => sum + b.totalSeats, 0);

    return {
      departureId: dep.id,
      date: formatDateOnly(dep.date),
      departureTime: formatTimeOfDay(dep.departureTime),
      title: dep.tour?.title || dep.shuttleRoute?.name || "Rockies Shuttle Service",
      capacityTotal: dep.capacityTotal,
      capacityBooked: dep.capacityBooked,
      totalPassengers,
      boardedPassengers,
      stops,
      rawBookings: dep.bookings,
    };
  });

  return manifests;
}

export async function toggleBoardingStatus(bookingId: string, isBoarded: boolean) {
  return await prisma.booking.update({
    where: { id: bookingId },
    data: {
      isBoarded,
      boardedAt: isBoarded ? new Date() : null,
    },
  });
}

export async function updateDepartureCapacity(departureId: string, newTotalCapacity: number) {
  const dep = await prisma.tourDeparture.findUnique({
    where: { id: departureId },
  });

  if (!dep) {
    return { success: false, error: "Departure not found" };
  }

  if (newTotalCapacity < dep.capacityBooked + dep.capacityHeld) {
    return {
      success: false,
      error: `Cannot reduce total capacity to ${newTotalCapacity} below seats already booked (${dep.capacityBooked}) and held (${dep.capacityHeld}).`,
    };
  }

  const updated = await prisma.tourDeparture.update({
    where: { id: departureId },
    data: { capacityTotal: newTotalCapacity },
  });

  return { success: true, departure: updated };
}

/** Departures of one tour with where their seats come from (admin inventory screen). */
export async function listDepartureInventory(tourSlug: string, from?: string, to?: string) {
  const departures = await prisma.tourDeparture.findMany({
    where: {
      tour: { slug: tourSlug },
      ...(from || to ? { date: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } } : {}),
    },
    orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    take: 500,
  });
  return departures.map((d) => ({
    id: d.id,
    date: formatDateOnly(d.date),
    departureTime: formatTimeOfDay(d.departureTime),
    capacityTotal: d.capacityTotal,
    capacityBooked: d.capacityBooked,
    capacityHeld: d.capacityHeld,
    price: d.price / 100,
    childPrice: d.childPrice != null ? d.childPrice / 100 : null,
    status: d.status,
    inventorySource: d.inventorySource,
    inventoryVerifiedAt: d.inventoryVerifiedAt,
  }));
}

/** Marks departures LOCAL (confirmed by staff, sold online) or UNVERIFIED (off sale). Returns the count. */
export async function setDepartureInventorySource(
  filter: { departureIds?: string[]; tourSlug?: string; from?: string; to?: string },
  source: "LOCAL" | "UNVERIFIED",
) {
  const result = await prisma.tourDeparture.updateMany({
    where: {
      ...(filter.departureIds ? { id: { in: filter.departureIds } } : {}),
      ...(filter.tourSlug ? { tour: { slug: filter.tourSlug } } : {}),
      ...(filter.from || filter.to ? { date: { ...(filter.from ? { gte: dateOnly(filter.from) } : {}), ...(filter.to ? { lte: dateOnly(filter.to) } : {}) } } : {}),
    },
    data: { inventorySource: source, inventoryVerifiedAt: source === "LOCAL" ? new Date() : null },
  });
  return result.count;
}

/**
 * One departure's passenger manifest for the driver or guide (printable page and CSV): every
 * booking that is travelling, in pickup order, with contact, party, pickup and requests.
 */
export async function getDepartureManifest(departureId: string) {
  const dep = await prisma.tourDeparture.findUnique({
    where: { id: departureId },
    include: {
      tour: { select: { title: true } },
      shuttleRoute: { select: { name: true } },
      bookings: {
        where: { status: { in: ["CONFIRMED", "PAID_UNSYNCED", "COMPLETED"] } },
        include: { pickupStop: { select: { name: true, town: true, address: true, sortOrder: true } }, items: { select: { name: true, quantity: true } }, flags: { where: { status: "OPEN" }, select: { type: true } } },
      },
    },
  });
  if (!dep) return null;
  const departureTime = formatTimeOfDay(dep.departureTime);
  const passengers = dep.bookings
    .map((b) => ({
      bookingId: b.id,
      bookingReference: b.bookingReference,
      status: b.status,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail,
      adults: b.adultsCount,
      children: b.childrenCount,
      infants: b.infantsCount,
      seats: b.totalSeats,
      pickupStop: b.pickupStop ? `${b.pickupStop.name}, ${b.pickupStop.town}` : b.pickupCustomText || "Not chosen",
      pickupAddress: b.pickupStop?.address ?? null,
      pickupTime: b.pickupTime || departureTime,
      stopOrder: b.pickupStop?.sortOrder ?? 9999,
      addOns: b.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)),
      specialRequests: b.specialRequests,
      paymentDue: b.flags.some((f) => f.type === "PAYMENT_DUE"),
      isBoarded: b.isBoarded,
    }))
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime) || a.stopOrder - b.stopOrder || a.customerName.localeCompare(b.customerName));

  return {
    departureId: dep.id,
    experience: dep.tour?.title ?? dep.shuttleRoute?.name ?? "Departure",
    date: formatDateOnly(dep.date),
    departureTime,
    returnTime: formatTimeOfDay(dep.returnTime),
    status: dep.status,
    capacityTotal: dep.capacityTotal,
    totals: {
      bookings: passengers.length,
      adults: passengers.reduce((s, p) => s + p.adults, 0),
      children: passengers.reduce((s, p) => s + p.children, 0),
      infants: passengers.reduce((s, p) => s + p.infants, 0),
      seats: passengers.reduce((s, p) => s + p.seats, 0),
      boarded: passengers.filter((p) => p.isBoarded).reduce((s, p) => s + p.seats, 0),
    },
    passengers,
  };
}

/** A CSV cell; values that a spreadsheet would run as a formula are prefixed with a quote. */
function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function manifestCsv(manifest: NonNullable<Awaited<ReturnType<typeof getDepartureManifest>>>) {
  const head = ["Pickup time", "Pickup stop", "Reference", "Guest", "Phone", "Email", "Adults", "Children", "Infants", "Seats", "Add-ons", "Special requests", "Payment due", "Boarded"];
  const rows = manifest.passengers.map((p) => [
    p.pickupTime, p.pickupStop, p.bookingReference, p.customerName, p.customerPhone, p.customerEmail, p.adults, p.children, p.infants, p.seats,
    p.addOns.join("; "), p.specialRequests ?? "", p.paymentDue ? "Yes" : "", p.isBoarded ? "Yes" : "",
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
