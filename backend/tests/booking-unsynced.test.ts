import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

// Bookings are kept in this database only; the retired Bókun integration is never called, even for
// products that still carry a historical Bókun ID.
describe("Bookings stay local", () => {
  it("confirms several bookings without a Bókun booking ID", async () => {
    const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN", bokunId: { not: null } } });
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour.id,
        date: dateOnly("2027-02-03"),
        departureTime: timeOfDay("08:30"),
        capacityTotal: 12,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 19900,
        status: "ACTIVE",
      },
    });

    const book = (n: number) =>
      createBooking({
        departureId: departure.id,
        customerName: `Guest ${n}`,
        customerEmail: `guest${n}@example.com`,
        customerPhone: "+1 403 555 0100",
        adultsCount: 1,
        childrenCount: 0,
        infantsCount: 0,
      });

    const first = await book(1);
    const second = await book(2);
    expect(first.success, first.error).toBe(true);
    expect(second.success, second.error).toBe(true);

    const stored = await prisma.booking.findMany({ where: { tourDepartureId: departure.id } });
    expect(stored).toHaveLength(2);
    expect(stored.every((b) => b.status === "CONFIRMED" && b.bokunBookingId === null)).toBe(true);
  });
});
