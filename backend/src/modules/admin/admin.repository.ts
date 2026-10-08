import prisma from "@/lib/db/prisma";
import { dateOnly } from "@/lib/utils/time";

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

  const totalRevenue = revenueAgg._sum.amount || 0;

  return {
    totalBookings,
    confirmedBookings,
    totalUsers,
    totalDepartures,
    activeHoldsCount,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    recentBookings,
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
      date: dep.date,
      departureTime: dep.departureTime,
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

  if (newTotalCapacity < dep.capacityBooked) {
    return {
      success: false,
      error: `Cannot reduce total capacity to ${newTotalCapacity} below already booked seats (${dep.capacityBooked}).`,
    };
  }

  const updated = await prisma.tourDeparture.update({
    where: { id: departureId },
    data: { capacityTotal: newTotalCapacity },
  });

  return { success: true, departure: updated };
}
