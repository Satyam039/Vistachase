import prisma from "@/lib/db/prisma";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

export interface OperationsDashboardStats {
  date: string;
  totalDepartures: number;
  totalRuns: number;
  activeFleetCount: number;
  totalPassengers: number;
  boardedPassengers: number;
  departureStatuses: Record<string, number>;
}

export interface CreateRunInput {
  name: string;
  date: string;
  tourDepartureId: string;
  departureTime?: string;
  vehicleId?: string;
  driverId?: string;
  status?: "PLANNED" | "READY" | "DISPATCHED" | "BOARDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DELAYED";
  notes?: string;
}

export async function getOperationsDashboard(date: string) {
  // 1. Departures on date
  const departures = await prisma.tourDeparture.findMany({
    where: { date: dateOnly(date) },
    include: {
      tour: true,
      shuttleRoute: true,
      operationRuns: {
        include: {
          vehicle: true,
          driver: true,
          trackingSession: true,
          bookings: {
            include: {
              booking: {
                include: {
                  pickupStop: true,
                },
              },
            },
          },
        },
      },
      bookings: {
        where: {
          status: { not: "CANCELLED" },
        },
        include: {
          pickupStop: true,
        },
      },
    },
    orderBy: { departureTime: "asc" },
  });

  // 2. Active Fleet & Drivers
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const drivers = await prisma.driver.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // 3. Compute High-Level Metrics
  let totalPassengers = 0;
  let boardedPassengers = 0;
  let totalRuns = 0;
  const statusCounts: Record<string, number> = {};

  for (const dep of departures) {
    for (const b of dep.bookings) {
      totalPassengers += b.totalSeats;
      if (b.isBoarded) boardedPassengers += b.totalSeats;
    }

    for (const run of dep.operationRuns) {
      totalRuns++;
      statusCounts[run.status] = (statusCounts[run.status] || 0) + 1;
    }
  }

  return {
    date,
    stats: {
      date,
      totalDepartures: departures.length,
      totalRuns,
      activeFleetCount: vehicles.length,
      totalPassengers,
      boardedPassengers,
      departureStatuses: statusCounts,
    },
    departures,
    fleet: vehicles,
    drivers,
  };
}

export async function createOrUpdateRun(input: CreateRunInput, runId?: string) {
  let run;
  if (runId) {
    run = await prisma.operationRun.update({
      where: { id: runId },
      data: {
        name: input.name,
        date: dateOnly(input.date),
        tourDepartureId: input.tourDepartureId,
        departureTime: input.departureTime ? timeOfDay(input.departureTime) : undefined,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        status: input.status || "PLANNED",
        notes: input.notes,
      },
      include: {
        vehicle: true,
        driver: true,
      },
    });
  } else {
    run = await prisma.operationRun.create({
      data: {
        name: input.name,
        date: dateOnly(input.date),
        tourDepartureId: input.tourDepartureId,
        departureTime: input.departureTime ? timeOfDay(input.departureTime) : undefined,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        status: input.status || "PLANNED",
        notes: input.notes,
      },
      include: {
        vehicle: true,
        driver: true,
      },
    });
  }

  // Update vehicle status to ASSIGNED if vehicleId is set
  if (input.vehicleId) {
    await prisma.vehicle.update({
      where: { id: input.vehicleId },
      data: { status: "ASSIGNED" },
    });
  }

  return run;
}

export async function updateRunStatus(runId: string, status: string, notes?: string) {
  const updated = await prisma.operationRun.update({
    where: { id: runId },
    data: {
      status: status as any,
      ...(notes ? { notes } : {}),
    },
    include: {
      vehicle: true,
      driver: true,
      tourDeparture: {
        include: {
          tour: true,
          shuttleRoute: true,
        },
      },
    },
  });

  return updated;
}

export async function assignBookingToRun(runId: string, bookingId: string, pickupOrder = 0) {
  const runBooking = await prisma.runBooking.upsert({
    where: {
      runId_bookingId: {
        runId,
        bookingId,
      },
    },
    update: {
      pickupOrder,
    },
    create: {
      runId,
      bookingId,
      pickupOrder,
    },
    include: {
      booking: true,
      run: true,
    },
  });

  return runBooking;
}

export async function optimizePickupSequence(runId: string) {
  // Sort stops geographically from East to West (Canmore -> Banff -> Bow Valley Parkway -> Lake Louise)
  const runBookings = await prisma.runBooking.findMany({
    where: { runId },
    include: {
      booking: {
        include: {
          pickupStop: true,
        },
      },
    },
  });

  // Sort by longitude ascending (least negative to most negative, e.g. -115.3484 Canmore -> -115.5619 Banff -> -116.1822 Lake Louise)
  const sorted = [...runBookings].sort((a, b) => {
    const lngA = a.booking.pickupStop?.longitude ?? -115.56;
    const lngB = b.booking.pickupStop?.longitude ?? -115.56;
    return lngB - lngA; // East to West
  });

  for (let i = 0; i < sorted.length; i++) {
    await prisma.runBooking.update({
      where: { id: sorted[i].id },
      data: { pickupOrder: i + 1 },
    });
  }

  return prisma.runBooking.findMany({
    where: { runId },
    orderBy: { pickupOrder: "asc" },
    include: {
      booking: {
        include: {
          pickupStop: true,
        },
      },
    },
  });
}

export async function toggleRunPassengerBoarding(runBookingId: string, isBoarded: boolean) {
  const updatedRunBooking = await prisma.runBooking.update({
    where: { id: runBookingId },
    data: {
      isBoarded,
      boardedAt: isBoarded ? new Date() : null,
    },
    include: {
      booking: true,
    },
  });

  // Also sync booking level boarding flag
  await prisma.booking.update({
    where: { id: updatedRunBooking.bookingId },
    data: {
      isBoarded,
      boardedAt: isBoarded ? new Date() : null,
    },
  });

  return updatedRunBooking;
}

export async function getRunManifest(runId: string) {
  const run = await prisma.operationRun.findUnique({
    where: { id: runId },
    include: {
      vehicle: true,
      driver: true,
      trackingSession: true,
      tourDeparture: {
        include: {
          tour: true,
          shuttleRoute: true,
        },
      },
      bookings: {
        orderBy: { pickupOrder: "asc" },
        include: {
          booking: {
            include: {
              pickupStop: true,
            },
          },
        },
      },
    },
  });

  return run;
}
