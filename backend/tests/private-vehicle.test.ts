import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { cancelBooking, createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

async function createPrivateDeparture(date: string) {
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE" } });
  return prisma.tourDeparture.create({
    data: {
      tourId: tour.id,
      date: dateOnly(date),
      departureTime: timeOfDay("08:00"),
      capacityTotal: 6,
      capacityBooked: 0,
      capacityHeld: 0,
      price: 125000, // $1,250 per vehicle, in cents
      status: "ACTIVE",
    },
  });
}

describe("Private tours are priced and reserved per vehicle", () => {
  it("holds the whole vehicle, charges one vehicle price, and blocks a second party", async () => {
    const departure = await createPrivateDeparture("2027-06-10");

    const hold = await createReservationHold({
      departureId: departure.id,
      seatsCount: 2,
      customerName: "Vehicle Guest",
      customerEmail: "vehicle.guest@example.com",
    });
    expect(hold.success).toBe(true);
    expect(hold.isVehicle).toBe(true);
    expect(hold.seatsHeld).toBe(6);

    const secondHold = await createReservationHold({
      departureId: departure.id,
      seatsCount: 1,
      customerName: "Other Party",
      customerEmail: "other.party@example.com",
    });
    expect(secondHold.success).toBe(false);

    const booking = await createBooking({
      departureId: departure.id,
      holdToken: hold.holdToken,
      customerName: "Vehicle Guest",
      customerEmail: "vehicle.guest@example.com",
      customerPhone: "+1 403 555 0100",
      adultsCount: 4,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(booking.success).toBe(true);
    // One vehicle price, not 4 × 1250: 1250 + 5% GST
    expect(booking.booking?.totalAmount).toBe(1312.5);

    const afterBooking = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: departure.id } });
    expect(afterBooking.capacityBooked).toBe(6);
    expect(afterBooking.capacityHeld).toBe(0);

    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: booking.booking!.bookingReference } });
    expect(stored.totalSeats).toBe(4); // manifests still count the real guests
    expect(stored.subtotal).toBe(125000); // stored in cents

    const secondBooking = await createBooking({
      departureId: departure.id,
      customerName: "Other Party",
      customerEmail: "other.party@example.com",
      customerPhone: "+1 403 555 0101",
      adultsCount: 1,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(secondBooking.success).toBe(false);

    const cancelled = await cancelBooking(booking.booking!.bookingReference, "vehicle.guest@example.com");
    expect(cancelled.success).toBe(true);
    const afterCancel = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: departure.id } });
    expect(afterCancel.capacityBooked).toBe(0);
  });

  it("rejects a party larger than the vehicle", async () => {
    const departure = await createPrivateDeparture("2027-06-11");
    const result = await createBooking({
      departureId: departure.id,
      customerName: "Big Party",
      customerEmail: "big.party@example.com",
      customerPhone: "+1 403 555 0102",
      adultsCount: 7,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("seats up to 6");
  });

  it("refuses a hold that belongs to a different departure", async () => {
    const holdDeparture = await createPrivateDeparture("2027-06-12");
    const otherDeparture = await createPrivateDeparture("2027-06-13");
    const hold = await createReservationHold({
      departureId: holdDeparture.id,
      seatsCount: 2,
      customerName: "Mixed Up",
      customerEmail: "mixed.up@example.com",
    });
    const result = await createBooking({
      departureId: otherDeparture.id,
      holdToken: hold.holdToken,
      customerName: "Mixed Up",
      customerEmail: "mixed.up@example.com",
      customerPhone: "+1 403 555 0103",
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("different departure");
  });
});
