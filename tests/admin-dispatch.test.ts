import { describe, it, expect, beforeAll } from "vitest";
import prisma from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/auth";
import {
  getAdminMetrics,
  getDispatchManifest,
  toggleBoardingStatus,
  updateDepartureCapacity,
} from "@/modules/admin/admin.repository";

describe("Phase 6: Admin Panel, Dispatch Board & RBAC", () => {
  let testDepartureId: string;
  let testBookingId: string;
  const dispatchDate = "2026-10-15";

  beforeAll(async () => {
    // 1. Get or create tour
    const tour = await prisma.tour.findFirst();
    const stop = await prisma.shuttleStop.findFirst();

    // 2. Create departure for dispatch test
    const dep = await prisma.tourDeparture.create({
      data: {
        tourId: tour!.id,
        date: dispatchDate,
        departureTime: "07:30",
        capacityTotal: 14,
        capacityBooked: 4,
        capacityHeld: 0,
        price: 165.0,
        currency: "CAD",
        status: "SCHEDULED",
      },
    });
    testDepartureId = dep.id;

    // 3. Create confirmed booking with pickup stop
    const booking = await prisma.booking.create({
      data: {
        bookingReference: `VC-DISP-${Math.floor(10000 + Math.random() * 90000)}`,
        customerName: "Dispatch Test Guest",
        customerEmail: "guest.dispatch@example.com",
        customerPhone: "+14035559876",
        tourDepartureId: testDepartureId,
        pickupStopId: stop?.id,
        pickupTime: "07:15 AM",
        adultsCount: 4,
        childrenCount: 0,
        infantsCount: 0,
        totalSeats: 4,
        subtotal: 660,
        tax: 33,
        totalAmount: 693,
        currency: "CAD",
        status: "CONFIRMED",
        voucherCode: `VOUCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        isBoarded: false,
      },
    });
    testBookingId = booking.id;
  });

  it("evaluates RBAC role permissions accurately", () => {
    expect(hasPermission("ADMIN", ["OPERATOR"])).toBe(true); // Admin has access everywhere
    expect(hasPermission("OPERATOR", ["OPERATOR", "DISPATCHER"])).toBe(true);
    expect(hasPermission("DISPATCHER", ["ADMIN", "OPERATOR"])).toBe(false);
    expect(hasPermission("CUSTOMER", ["OPERATOR"])).toBe(false);
  });

  it("calculates accurate admin overview metrics", async () => {
    const metrics = await getAdminMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalBookings).toBeGreaterThanOrEqual(1);
    expect(metrics.confirmedBookings).toBeGreaterThanOrEqual(1);
    expect(metrics.totalDepartures).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(metrics.recentBookings)).toBe(true);
  });

  it("generates daily dispatch manifest grouped by pickup stop", async () => {
    const manifests = await getDispatchManifest(dispatchDate);
    expect(manifests.length).toBeGreaterThanOrEqual(1);

    const match = manifests.find((m) => m.departureId === testDepartureId);
    expect(match).toBeDefined();
    expect(match!.departureTime).toBe("07:30");
    expect(match!.capacityBooked).toBe(4);
    expect(match!.stops.length).toBeGreaterThanOrEqual(1);

    const passenger = match!.stops[0].bookings.find((b) => b.id === testBookingId);
    expect(passenger).toBeDefined();
    expect(passenger?.customerName).toBe("Dispatch Test Guest");
    expect(passenger?.isBoarded).toBe(false);
  });

  it("toggles passenger boarding check-in status and timestamps boardedAt", async () => {
    // 1. Board passenger
    const boarded = await toggleBoardingStatus(testBookingId, true);
    expect(boarded.isBoarded).toBe(true);
    expect(boarded.boardedAt).toBeInstanceOf(Date);

    // 2. Verify in manifest
    const manifests = await getDispatchManifest(dispatchDate);
    const match = manifests.find((m) => m.departureId === testDepartureId);
    expect(match!.boardedPassengers).toBe(4);

    // 3. Undo check-in
    const undone = await toggleBoardingStatus(testBookingId, false);
    expect(undone.isBoarded).toBe(false);
    expect(undone.boardedAt).toBeNull();
  });

  it("updates departure total capacity and prevents reduction below booked count", async () => {
    // Attempt invalid capacity reduction below booked seats (booked is 4, trying 2)
    const invalid = await updateDepartureCapacity(testDepartureId, 2);
    expect(invalid.success).toBe(false);
    expect(invalid.error).toContain("Cannot reduce total capacity");

    // Valid capacity increase
    const valid = await updateDepartureCapacity(testDepartureId, 20);
    expect(valid.success).toBe(true);
    expect(valid.departure?.capacityTotal).toBe(20);
  });
});
