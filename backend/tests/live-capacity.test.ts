import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { getCheckoutDeparture } from "@/modules/departures/departure.repository";

describe("Live seat availability ignores expired holds", () => {
  it("counts live holds as taken but frees seats once a hold has expired", async () => {
    const tour = await prisma.tour.findFirstOrThrow();
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour.id,
        date: "2027-01-15",
        departureTime: "07:00",
        capacityTotal: 10,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 100,
        status: "ACTIVE",
      },
    });

    const live = await createReservationHold({
      departureId: departure.id,
      seatsCount: 3,
      customerName: "Live Hold",
      customerEmail: "live.hold@example.com",
    });
    expect(live.success).toBe(true);

    // A hold that already expired but has not been cleaned up yet (still ACTIVE in capacityHeld).
    await prisma.reservationHold.create({
      data: {
        holdToken: `hold_expired_${Date.now()}`,
        tourDepartureId: departure.id,
        seatsCount: 4,
        customerName: "Expired Hold",
        customerEmail: "expired.hold@example.com",
        expiresAt: new Date(Date.now() - 60_000),
        status: "ACTIVE",
      },
    });
    await prisma.tourDeparture.update({
      where: { id: departure.id },
      data: { capacityHeld: { increment: 4 } },
    });

    const checkout = await getCheckoutDeparture(departure.id);
    expect(checkout?.departure.capacityHeld).toBe(3);
    expect(checkout?.departure.seatsAvailable).toBe(7);

    const listed = (await getTourBySlug(tour.slug))?.departures.find((d) => d.id === departure.id);
    expect(listed?.seatsAvailable).toBe(7);
  });
});
