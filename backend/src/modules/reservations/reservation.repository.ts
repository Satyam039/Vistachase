import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import { isVehicleDeparture, partySizeError, seatsToReserve } from "@/modules/pricing/departure-pricing";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { bookingClosedError } from "@/modules/departures/booking-window";
import { endHold, freeExpiredSeats, inventoryError, takeHeldSeats } from "@/modules/departures/inventory";

export interface CreateHoldInput {
  departureId: string;
  /** Guests in the party. Private departures reserve the whole vehicle regardless. */
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
  /** Seats removed from sale: the party size, or the whole vehicle for a private departure. */
  seatsHeld?: number;
  isVehicle?: boolean;
  error?: string;
}

export async function createReservationHold(input: CreateHoldInput): Promise<HoldResult> {
  const duration = input.holdDurationSeconds || 600;
  const expiresAt = new Date(Date.now() + duration * 1000);
  const holdToken = `hold_${crypto.randomBytes(16).toString("hex")}`;
  const cache = getCacheProvider();

  // Seats from expired holds and unpaid bookings on this departure come back first, even when no
  // job runner is on.
  await freeExpiredSeats({ departureId: input.departureId });

  return await prisma.$transaction(async (tx) => {
    const departure = await tx.tourDeparture.findUnique({
      where: { id: input.departureId },
      include: { tour: { select: { category: true, bookingMode: true } } },
    });

    if (!departure) {
      return { success: false, error: "Departure not found" };
    }

    if (departure.status !== "ACTIVE") {
      return { success: false, error: "Departure is not active for booking" };
    }

    if (departure.tour?.bookingMode === "ENQUIRY") {
      return { success: false, error: "This experience is booked on request. Please send us an enquiry." };
    }

    const notSellable = inventoryError(departure);
    if (notSellable) {
      return { success: false, error: notSellable };
    }

    const closed = bookingClosedError(departure);
    if (closed) {
      return { success: false, error: closed };
    }

    const partyError = partySizeError(departure, input.seatsCount);
    if (partyError) {
      return { success: false, error: partyError };
    }

    const isVehicle = isVehicleDeparture(departure);
    const reservedSeats = seatsToReserve(departure, input.seatsCount);

    // One conditional update: the seats are held only if they are still free at this instant
    // (a private vehicle must be entirely free). Nothing has been written when it fails.
    if (!(await takeHeldSeats(tx, departure.id, reservedSeats))) {
      const fresh = await tx.tourDeparture.findUnique({ where: { id: departure.id } });
      const available = fresh ? fresh.capacityTotal - (fresh.capacityBooked + fresh.capacityHeld) : 0;
      return {
        success: false,
        error: isVehicle
          ? "This private vehicle is already reserved for this departure."
          : `Only ${Math.max(0, available)} seat(s) available for this departure. Requested: ${input.seatsCount}`,
      };
    }

    await tx.reservationHold.create({
      data: {
        holdToken,
        tourDepartureId: input.departureId,
        seatsCount: reservedSeats,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        expiresAt,
        status: "ACTIVE",
      },
    });

    // Store in cache with TTL for fast access
    await cache.set(
      `hold:${holdToken}`,
      {
        holdToken,
        departureId: input.departureId,
        seatsCount: reservedSeats,
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
      seatsHeld: reservedSeats,
      isVehicle,
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
    /** True when the hold covers a whole private vehicle (seatsCount = vehicle seats). */
    isVehicle: boolean;
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
          capacityTotal: true,
          tour: { select: { category: true } },
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
      isVehicle: isVehicleDeparture(hold.tourDeparture),
      departure: {
        id: hold.tourDeparture.id,
        date: formatDateOnly(hold.tourDeparture.date),
        departureTime: formatTimeOfDay(hold.tourDeparture.departureTime),
        price: hold.tourDeparture.price / 100,
      },
    },
  };
}

export async function releaseHold(holdToken: string): Promise<boolean> {
  const cache = getCacheProvider();
  await cache.del(`hold:${holdToken}`);

  const hold = await prisma.reservationHold.findUnique({ where: { holdToken } });
  if (!hold || hold.status !== "ACTIVE") return false;
  return await prisma.$transaction((tx) => endHold(tx, hold, "RELEASED"));
}

/**
 * Expired holds stay ACTIVE (and inside capacityHeld) until the next hold or booking on that
 * departure (or the scheduled job) cleans them up, so availability reads subtract them here. One grouped query per read.
 */
export async function getExpiredHeldSeats(departureIds: string[]): Promise<Map<string, number>> {
  if (departureIds.length === 0) return new Map();
  const groups = await prisma.reservationHold.groupBy({
    by: ["tourDepartureId"],
    where: {
      tourDepartureId: { in: departureIds },
      status: "ACTIVE",
      expiresAt: { lt: new Date() },
    },
    _sum: { seatsCount: true },
  });
  return new Map(groups.map((g) => [g.tourDepartureId, g._sum.seatsCount ?? 0]));
}

/** Seats actually held (live holds only) and seats a guest can book right now. */
export function liveCapacity(
  departure: { id: string; capacityTotal: number; capacityBooked: number; capacityHeld: number },
  expiredHeldSeats: Map<string, number>
) {
  const capacityHeld = Math.max(0, departure.capacityHeld - (expiredHeldSeats.get(departure.id) ?? 0));
  return {
    capacityHeld,
    seatsAvailable: Math.max(0, departure.capacityTotal - (departure.capacityBooked + capacityHeld)),
  };
}
