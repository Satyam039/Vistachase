import prisma from "@/lib/db/prisma";
import { getExpiredHeldSeats, liveCapacity } from "@/modules/reservations/reservation.repository";

export async function getCheckoutDeparture(departureId?: string) {
  let id = departureId;

  // If no departure specified, pick first active scheduled departure
  if (!id) {
    const firstActive = await prisma.tourDeparture.findFirst({
      where: { status: "ACTIVE" },
      orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    });
    id = firstActive?.id;
  }

  if (!id) return null;

  const departure = await prisma.tourDeparture.findUnique({
    where: { id },
    include: {
      tour: {
        select: {
          id: true,
          title: true,
          slug: true,
          durationHours: true,
          featuredImage: true,
          category: true,
          maxGroupSize: true,
        },
      },
      shuttleRoute: {
        select: {
          id: true,
          name: true,
          slug: true,
          origin: true,
          destination: true,
        },
      },
    },
  });

  if (!departure) return null;

  const stops = await prisma.shuttleStop.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const expiredHeld = await getExpiredHeldSeats([departure.id]);

  return {
    departure: {
      ...departure,
      price: departure.price / 100, // stored in cents; the checkout shows dollars
      ...liveCapacity(departure, expiredHeld),
    },
    stops,
  };
}
