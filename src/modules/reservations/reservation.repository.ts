import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";

export interface CreateHoldInput {
  departureId: string;
  seatsCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  holdDurationSeconds?: number; // default 600 (10 mins)
}

export interface HoldResult {
  success: boolean;
  holdToken?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  error?: string;
}

export async function createReservationHold(input: CreateHoldInput): Promise<HoldResult> {
  const duration = input.holdDurationSeconds || 600;
  const expiresAt = new Date(Date.now() + duration * 1000);
  const holdToken = `hold_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const cache = getCacheProvider();

  // 1. Transaction to guarantee atomic capacity check and reservation hold
  return await prisma.$transaction(async (tx) => {
    // Clean any expired holds first
    const now = new Date();
    const expired = await tx.reservationHold.findMany({
      where: {
        tourDepartureId: input.departureId,
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
    });

    for (const exp of expired) {
      await tx.reservationHold.update({
        where: { id: exp.id },
        data: { status: "EXPIRED" },
      });
      await tx.tourDeparture.update({
        where: { id: input.departureId },
        data: {
          capacityHeld: {
            decrement: exp.seatsCount,
          },
        },
      });
    }

    // Fetch departure with fresh capacity
    const departure = await tx.tourDeparture.findUnique({
      where: { id: input.departureId },
    });

    if (!departure) {
      return { success: false, error: "Departure not found" };
    }

    if (departure.status !== "ACTIVE") {
      return { success: false, error: "Departure is not active for booking" };
    }

    const currentAvailable = departure.capacityTotal - (departure.capacityBooked + departure.capacityHeld);

    // CRITICAL: Over-capacity prevention
    if (currentAvailable < input.seatsCount) {
      return {
        success: false,
        error: `Only ${Math.max(0, currentAvailable)} seat(s) available for this departure. Requested: ${input.seatsCount}`,
      };
    }

    // Create Hold in DB
    await tx.reservationHold.create({
      data: {
        holdToken,
        tourDepartureId: input.departureId,
        seatsCount: input.seatsCount,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        expiresAt,
        status: "ACTIVE",
      },
    });

    // Atomically increment held seats
    await tx.tourDeparture.update({
      where: { id: input.departureId },
      data: {
        capacityHeld: {
          increment: input.seatsCount,
        },
      },
    });

    // Store in cache with TTL for fast access
    await cache.set(
      `hold:${holdToken}`,
      {
        holdToken,
        departureId: input.departureId,
        seatsCount: input.seatsCount,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        expiresAt: expiresAt.toISOString(),
      },
      duration
    );

    return {
      success: true,
      holdToken,
      expiresAt: expiresAt.toISOString(),
      remainingSeconds: duration,
    };
  });
}

export async function getHoldStatus(holdToken: string): Promise<{
  active: boolean;
  hold?: {
    holdToken: string;
    seatsCount: number;
    customerEmail: string;
    customerName: string;
    expiresAt: string;
    remainingSeconds: number;
    departure: {
      id: string;
      date: string;
      departureTime: string;
      price: number;
    };
  };
  error?: string;
}> {
  const hold = await prisma.reservationHold.findUnique({
    where: { holdToken },
    include: {
      tourDeparture: {
        select: {
          id: true,
          date: true,
          departureTime: true,
          price: true,
        },
      },
    },
  });

  if (!hold) {
    return { active: false, error: "Hold not found" };
  }

  const now = new Date();
  if (hold.status !== "ACTIVE" || hold.expiresAt < now) {
    return { active: false, error: "Hold has expired or was already converted" };
  }

  const remainingSeconds = Math.max(0, Math.floor((hold.expiresAt.getTime() - now.getTime()) / 1000));

  return {
    active: true,
    hold: {
      holdToken: hold.holdToken,
      seatsCount: hold.seatsCount,
      customerEmail: hold.customerEmail,
      customerName: hold.customerName,
      expiresAt: hold.expiresAt.toISOString(),
      remainingSeconds,
      departure: hold.tourDeparture,
    },
  };
}

export async function releaseHold(holdToken: string): Promise<boolean> {
  const cache = getCacheProvider();
  await cache.del(`hold:${holdToken}`);

  return await prisma.$transaction(async (tx) => {
    const hold = await tx.reservationHold.findUnique({
      where: { holdToken },
    });

    if (!hold || hold.status !== "ACTIVE") {
      return false;
    }

    await tx.reservationHold.update({
      where: { id: hold.id },
      data: { status: "RELEASED" },
    });

    await tx.tourDeparture.update({
      where: { id: hold.tourDepartureId },
      data: {
        capacityHeld: {
          decrement: hold.seatsCount,
        },
      },
    });

    return true;
  });
}
