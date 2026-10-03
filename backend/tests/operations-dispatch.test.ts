import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import {
  getOperationsDashboard,
  createOrUpdateRun,
  updateRunStatus,
  assignBookingToRun,
  optimizePickupSequence,
  toggleRunPassengerBoarding,
} from "@/modules/operations/operations.repository";

describe("Mornby Operations & Dispatch Workflow", () => {
  it("generates a comprehensive daily operations dashboard with fleet and driver stats", async () => {
    const today = new Date().toISOString().split("T")[0];
    const dashboard = await getOperationsDashboard(today);

    expect(dashboard.date).toBe(today);
    expect(dashboard.stats).toBeDefined();
    expect(dashboard.fleet.length).toBeGreaterThan(0);
    expect(dashboard.drivers.length).toBeGreaterThan(0);
  });

  it("creates an operational run, assigns vehicle and driver, and advances status lifecycle", async () => {
    const departure = await prisma.tourDeparture.findFirst();
    expect(departure).toBeDefined();

    const vehicle = await prisma.vehicle.findFirst();
    const driver = await prisma.driver.findFirst();

    // 1. Create Run in PLANNED state
    const run = await createOrUpdateRun({
      name: "Test Run - Alpine Sunrise",
      date: "2026-10-20",
      tourDepartureId: departure!.id,
      departureTime: "05:00",
      vehicleId: vehicle!.id,
      driverId: driver!.id,
      status: "PLANNED",
    });

    expect(run.id).toBeDefined();
    expect(run.status).toBe("PLANNED");
    expect(run.vehicleId).toBe(vehicle!.id);
    expect(run.driverId).toBe(driver!.id);

    // 2. Transition status: PLANNED -> READY -> DISPATCHED -> BOARDING -> IN_PROGRESS -> COMPLETED
    const ready = await updateRunStatus(run.id, "READY");
    expect(ready.status).toBe("READY");

    const dispatched = await updateRunStatus(run.id, "DISPATCHED");
    expect(dispatched.status).toBe("DISPATCHED");

    const boarding = await updateRunStatus(run.id, "BOARDING");
    expect(boarding.status).toBe("BOARDING");
  });

  it("assigns bookings to a run, optimizes pickup sequence, and checks in passengers", async () => {
    const run = await prisma.operationRun.findFirst();
    const booking = await prisma.booking.findFirst();
    expect(run).toBeDefined();
    expect(booking).toBeDefined();

    // 1. Assign booking to run
    const assignment = await assignBookingToRun(run!.id, booking!.id, 2);
    expect(assignment.runId).toBe(run!.id);
    expect(assignment.bookingId).toBe(booking!.id);

    // 2. Optimize pickup sequence
    const optimized = await optimizePickupSequence(run!.id);
    expect(optimized.length).toBeGreaterThan(0);
    expect(optimized[0].pickupOrder).toBe(1);

    // 3. Boarding Check-in
    const checkedIn = await toggleRunPassengerBoarding(assignment.id, true);
    expect(checkedIn.isBoarded).toBe(true);
    expect(checkedIn.boardedAt).not.toBeNull();

    // Verify booking level state
    const refreshedBooking = await prisma.booking.findUnique({
      where: { id: booking!.id },
    });
    expect(refreshedBooking?.isBoarded).toBe(true);
  });
});
