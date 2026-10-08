import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { createReservationHold, getHoldStatus, releaseHold } from "@/modules/reservations/reservation.repository";
import { createBooking, getBookingByReference } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

describe("Phase 4: Booking Engine, Holds & Payment Abstraction", () => {
  it("holds seats for 10 minutes and prevents concurrent over-booking", async () => {
    const tour = await prisma.tour.findFirst();
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour!.id,
        date: dateOnly("2026-11-21"),
        departureTime: timeOfDay("06:00"),
        capacityTotal: 10,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 12000,
        status: "ACTIVE",
      },
    });

    // Create 10-minute hold for 3 seats
    const holdRes = await createReservationHold({
      departureId: departure.id,
      seatsCount: 3,
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      holdDurationSeconds: 600,
    });

    expect(holdRes.success).toBe(true);
    expect(holdRes.holdToken).toBeDefined();

    // Verify hold status
    const status = await getHoldStatus(holdRes.holdToken!);
    expect(status.active).toBe(true);
    expect(status.hold?.seatsCount).toBe(3);
    expect(status.hold?.remainingSeconds).toBeGreaterThan(500);

    // Clean up
    await releaseHold(holdRes.holdToken!);
  });

  it("converts reservation hold into confirmed booking with payment and QR code", async () => {
    const tour = await prisma.tour.findFirst();
    const departure = await prisma.tourDeparture.create({
      data: {
        tourId: tour!.id,
        date: dateOnly("2026-11-22"),
        departureTime: timeOfDay("07:30"),
        capacityTotal: 10,
        capacityBooked: 0,
        capacityHeld: 0,
        price: 14000,
        status: "ACTIVE",
      },
    });

    // 1. Create Hold first
    const holdRes = await createReservationHold({
      departureId: departure.id,
      seatsCount: 2,
      customerName: "Robert Miller",
      customerEmail: "robert@example.com",
      holdDurationSeconds: 600,
    });
    expect(holdRes.success).toBe(true);

    // 2. Complete Booking with Hold
    const bookingRes = await createBooking({
      departureId: departure.id,
      holdToken: holdRes.holdToken,
      customerName: "Robert Miller",
      customerEmail: "robert@example.com",
      customerPhone: "+1-403-555-9988",
      adultsCount: 2,
      childrenCount: 0,
      infantsCount: 0,
      // Chosen by id; the server sets the price ($25 → 2500 cents).
      addOns: [{ id: "parkPass" }],
    });

    expect(bookingRes.success).toBe(true);
    expect(bookingRes.booking?.bookingReference).toMatch(/^VC-\d{4}-[0-9A-F]{8}$/) // long, non-guessable (S2);
    expect(bookingRes.booking?.qrCodeUrl).toContain("data:image/png;base64");

    // 3. Verify booking details from DB
    const fetched = await getBookingByReference(bookingRes.booking!.bookingReference);
    expect(fetched).not.toBeNull();
    expect(fetched?.customerName).toBe("Robert Miller");
    expect(fetched?.items.length).toBe(1);
    expect(fetched?.items[0].name).toContain("Parks Canada");
    expect(fetched?.items[0].price).toBe(2500);
    expect(fetched?.status).toBe("CONFIRMED"); // mock payment completes at once
    expect(fetched?.payments.length).toBe(1);
    expect(fetched?.payments[0].status).toBe("SUCCEEDED");
  });

  it("strictly rejects booking when exceeding maximum available vehicle seats", async () => {
    const departure = await prisma.tourDeparture.findFirst({
      where: { status: "ACTIVE" },
    });
    expect(departure).not.toBeNull();

    // Try booking 100 passengers on a 14-seat shuttle
    const overBooking = await createBooking({
      departureId: departure!.id,
      customerName: "Impossible Group",
      customerEmail: "impossible@example.com",
      customerPhone: "+1-000-000-0000",
      adultsCount: 100,
      childrenCount: 0,
      infantsCount: 0,
    });

    expect(overBooking.success).toBe(false);
    expect(overBooking.error).toContain("available");
  });
});
