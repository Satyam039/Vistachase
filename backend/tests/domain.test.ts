import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { getTours, getTourBySlug } from "@/modules/tours/tour.repository";
import { getShuttleRoutes } from "@/modules/shuttles/shuttle.repository";
import { createReservationHold, releaseHold, getHoldStatus } from "@/modules/reservations/reservation.repository";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

describe("Domain Repositories & Business Logic", () => {
  it("fetches seeded tours with accurate capacity and destinations", async () => {
    const tours = await getTours();
    expect(tours.length).toBeGreaterThan(0);

    const highlights = tours.find((t) => t.slug === "banff-highlights-tour");
    expect(highlights).toBeDefined();
    expect(highlights?.destination.name).toBe("Banff National Park");
    expect(highlights?.departures.length).toBeGreaterThan(0);

    // Verify seats available is never negative
    for (const dep of highlights!.departures) {
      expect(dep.seatsAvailable).toBeGreaterThanOrEqual(0);
      expect(dep.seatsAvailable).toBe(dep.capacityTotal - (dep.capacityBooked + dep.capacityHeld));
    }
  });

  it("fetches tour by exact slug (URL preservation)", async () => {
    const tour = await getTourBySlug("banff-private-tour");
    expect(tour).not.toBeNull();
    expect(tour?.title).toContain("Banff Private");
    expect(tour?.category).toBe("PRIVATE");
  });

  it("fetches shuttles and guarantees departures", async () => {
    const shuttles = await getShuttleRoutes();
    expect(shuttles.length).toBeGreaterThan(0);
    const sunrise = shuttles.find((s) => s.slug === "moraine-lake-sunrise-shuttle");
    expect(sunrise).toBeDefined();
    expect(sunrise?.departures.length).toBeGreaterThan(0);
  });

  it("creates a 10-minute reservation hold and locks seats", async () => {
    const tour = await prisma.tour.findFirst();
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour!.id,
        date: dateOnly("2026-11-20"),
        departureTime: timeOfDay("07:15"),
        capacityTotal: 10,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 15000,
        status: "ACTIVE",
      },
    });

    const initialHeld = departure.capacityHeld;
    const holdResult = await createReservationHold({
      departureId: departure.id,
      seatsCount: 2,
      customerName: "Alex Test",
      customerEmail: "alex@example.com",
      holdDurationSeconds: 600,
    });

    expect(holdResult.success).toBe(true);
    expect(holdResult.holdToken).toBeDefined();

    // Check departure capacity updated
    const updatedDep = await prisma.tourDeparture.findUnique({
      where: { id: departure.id },
    });
    expect(updatedDep?.capacityHeld).toBe(initialHeld + 2);

    // Check hold status
    const status = await getHoldStatus(holdResult.holdToken!);
    expect(status.active).toBe(true);
    expect(status.hold?.seatsCount).toBe(2);

    // Release hold
    const released = await releaseHold(holdResult.holdToken!);
    expect(released).toBe(true);

    const releasedDep = await prisma.tourDeparture.findUnique({
      where: { id: departure.id },
    });
    expect(releasedDep?.capacityHeld).toBe(initialHeld);
  });

  it("prevents booking over available capacity", async () => {
    const departure = await prisma.tourDeparture.findFirst({
      where: { status: "ACTIVE" },
    });
    expect(departure).not.toBeNull();

    // Request impossible number of seats (e.g. 999)
    const overCapacityResult = await createBooking({
      departureId: departure!.id,
      customerName: "Over Booker",
      customerEmail: "over@example.com",
      customerPhone: "+1-000-000-0000",
      adultsCount: 999,
      childrenCount: 0,
      infantsCount: 0,
    });

    expect(overCapacityResult.success).toBe(false);
    expect(overCapacityResult.error).toContain("available");
  });

  it("creates confirmed booking, generates QR voucher, and updates capacity", async () => {
    const tour = await prisma.tour.findFirst();
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour!.id,
        date: dateOnly("2026-11-25"),
        departureTime: timeOfDay("09:15"),
        capacityTotal: 10,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 18000,
        status: "ACTIVE",
      },
    });

    const beforeBooked = departure.capacityBooked;

    const bookingResult = await createBooking({
      departureId: departure.id,
      customerName: "David Test",
      customerEmail: "david@example.com",
      customerPhone: "+1-555-123-4567",
      adultsCount: 1,
      childrenCount: 0,
      infantsCount: 0,
    });

    expect(bookingResult.success).toBe(true);
    expect(bookingResult.booking?.bookingReference).toMatch(/^VC-2026-\d+$/);
    expect(bookingResult.booking?.voucherCode).toMatch(/^VOUCH-/);
    expect(bookingResult.booking?.qrCodeUrl).toBeDefined();

    const afterDep = await prisma.tourDeparture.findUnique({
      where: { id: departure.id },
    });
    expect(afterDep?.capacityBooked).toBe(beforeBooked + 1);
  });
});
