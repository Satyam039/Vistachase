import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

// No product has a Bókun ID yet. Bookings for them must not share a placeholder Bókun booking ID
// (the column is unique): the second booking of the day would fail.
describe("Bookings for products not yet in Bókun", () => {
  it("accepts several bookings and leaves their Bókun booking ID empty", async () => {
    // Every product has a Bókun ID now; take one off temporarily to test a product not yet in Bókun.
    const mapped = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } });
    const tour = await prisma.tour.update({ where: { id: mapped.id }, data: { bokunId: null } });
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
    expect(stored.every((b) => b.bokunBookingId === null)).toBe(true);

    await prisma.tour.update({ where: { id: mapped.id }, data: { bokunId: mapped.bokunId } });
  });
});
