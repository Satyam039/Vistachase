import prisma from "@/lib/db/prisma";
import { getExpiredHeldSeats, liveCapacity } from "@/modules/reservations/reservation.repository";
import { inventoryError, sellableInventoryWhere } from "@/modules/departures/inventory";
import { bookingClosedError } from "@/modules/departures/booking-window";

export async function getCheckoutDeparture(departureId?: string) {
  let id = departureId;

  // If no departure specified, pick first active scheduled departure
  if (!id) {
    const firstActive = await prisma.tourDeparture.findFirst({
      where: { status: "ACTIVE", ...sellableInventoryWhere },
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
      childPrice: departure.childPrice != null ? departure.childPrice / 100 : null,
      ...liveCapacity(departure, expiredHeld),
      // Whether this departure can be booked online now, and why not (shown by the checkout).
      bookable: departure.status === "ACTIVE" && !inventoryError(departure) && !bookingClosedError(departure),
      notBookableReason: departure.status !== "ACTIVE" ? "This departure is no longer available." : (inventoryError(departure) ?? bookingClosedError(departure)),
    },
    stops,
  };
}
