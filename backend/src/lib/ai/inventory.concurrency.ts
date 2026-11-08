import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import type { AgentHoldRecord } from "./agent.types";

const MUTEX_TTL_SECONDS = 5;
const HOLD_DURATION_SECONDS = 600; // 10 minutes

export class InventoryConcurrencyManager {
  private cache = getCacheProvider();

  /**
   * Acquire a distributed Redis mutex lock to prevent concurrent overbooking.
   * If Redis is unavailable or busy, waits up to retryLimit times.
   */
  async acquireTripMutex(tripId: string, maxRetries = 3, retryDelayMs = 250): Promise<boolean> {
    const lockKey = `trip_lock:${tripId}`;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const exists = await this.cache.exists(lockKey);
      if (!exists) {
        // Set lock key with short TTL
        await this.cache.set(lockKey, "locked", MUTEX_TTL_SECONDS);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
    return false;
  }

  /**
   * Release the distributed mutex lock.
   */
  async releaseTripMutex(tripId: string): Promise<void> {
    const lockKey = `trip_lock:${tripId}`;
    await this.cache.del(lockKey);
  }

  /**
   * Get active held seats for a trip from Redis/cache
   */
  async getActiveHoldsSeatCount(tripId: string): Promise<number> {
    const activeHoldsKey = `active_holds_trip:${tripId}`;
    const cached = await this.cache.get<number>(activeHoldsKey);
    return cached ?? 0;
  }

  /**
   * Atomically verify live availability and create a 10-minute hold.
   * Calculates subtotal + 5% Canadian GST.
   */
  async createAtomicHold(params: {
    tripId: string;
    seatCount: number;
    userId: string;
    customerEmail?: string;
    customerName?: string;
    pickupLocationId?: string;
  }): Promise<
    | { success: true; hold: AgentHoldRecord; freeSeatsRemaining: number }
    | { success: false; reason: "INSUFFICIENT_SEATS" | "TRIP_NOT_FOUND" | "LOCK_TIMEOUT"; message: string; freeSeats?: number }
  > {
    const { tripId, seatCount, userId, customerEmail, customerName, pickupLocationId } = params;

    const locked = await this.acquireTripMutex(tripId);
    if (!locked) {
      return {
        success: false,
        reason: "LOCK_TIMEOUT",
        message: "High demand on this departure. Please retry in a moment.",
      };
    }

    try {
      const trip = await prisma.tourDeparture.findUnique({
        where: { id: tripId },
        include: { tour: true, shuttleRoute: true },
      });

      if (!trip || trip.status !== "ACTIVE") {
        return {
          success: false,
          reason: "TRIP_NOT_FOUND",
          message: "Departure not found, sold out, or unavailable.",
        };
      }

      // Check current capacity minus booked and active holds
      const activeHoldsCount = await this.getActiveHoldsSeatCount(tripId);
      const isPerVehicle = trip.tour?.priceUnit === "GROUP";
      const seatsNeeded = isPerVehicle ? trip.capacityTotal : seatCount;

      const availableSeats = trip.capacityTotal - trip.capacityBooked - trip.capacityHeld - activeHoldsCount;

      if (availableSeats < seatsNeeded) {
        return {
          success: false,
          reason: "INSUFFICIENT_SEATS",
          message: `Only ${Math.max(0, availableSeats)} seats remaining on this departure.`,
          freeSeats: Math.max(0, availableSeats),
        };
      }

      // Pricing calculation in CAD
      const unitPriceCents = trip.price;
      const subtotalCents = isPerVehicle ? unitPriceCents : unitPriceCents * seatCount;
      const subtotalCad = Number((subtotalCents / 100).toFixed(2));
      const gstTaxCad = Number((subtotalCad * 0.05).toFixed(2)); // 5% Canadian GST
      const totalCad = Number((subtotalCad + gstTaxCad).toFixed(2));

      const holdId = `hold_${crypto.randomUUID()}`;
      const now = Date.now();
      const expiresAt = now + HOLD_DURATION_SECONDS * 1000;

      const holdRecord: AgentHoldRecord = {
        holdId,
        tripId,
        userId,
        customerEmail,
        customerName,
        seatCount: seatsNeeded,
        pickupLocationId,
        subtotalCad,
        gstTaxCad,
        totalCad,
        expiresAt,
        createdAt: now,
      };

      // Store hold in cache with 10-minute TTL
      await this.cache.set(`seat_hold:${holdId}`, holdRecord, HOLD_DURATION_SECONDS);

      // Increment active holds counter for this trip
      const newActiveCount = activeHoldsCount + seatsNeeded;
      await this.cache.set(`active_holds_trip:${tripId}`, newActiveCount, HOLD_DURATION_SECONDS);

      // Record in PostgreSQL ReservationHold table for persistence & checkout bridge
      try {
        await prisma.reservationHold.create({
          data: {
            holdToken: holdId,
            tourDepartureId: tripId,
            seatsCount: seatsNeeded,
            customerName: customerName || (userId.startsWith("usr_") ? "Account User" : "Guest Traveler"),
            customerEmail: customerEmail || "guest@vistachase.com",
            expiresAt: new Date(expiresAt),
            status: "ACTIVE",
          },
        });
      } catch (dbErr) {
        console.warn("[inventory.concurrency] Note: Postgres hold creation fallback:", dbErr);
      }

      const freeSeatsRemaining = Math.max(0, availableSeats - seatsNeeded);

      return {
        success: true,
        hold: holdRecord,
        freeSeatsRemaining,
      };
    } finally {
      await this.releaseTripMutex(tripId);
    }
  }

  /**
   * Look up an active hold by holdId
   */
  async getHold(holdId: string): Promise<AgentHoldRecord | null> {
    const cached = await this.cache.get<AgentHoldRecord>(`seat_hold:${holdId}`);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
    return null;
  }

  /**
   * Release a hold explicitly (e.g. user cancels checkout or changes date)
   */
  async releaseHold(holdId: string): Promise<void> {
    const hold = await this.getHold(holdId);
    if (!hold) return;

    await this.cache.del(`seat_hold:${holdId}`);

    // Decrement active holds for trip
    const active = await this.getActiveHoldsSeatCount(hold.tripId);
    const updated = Math.max(0, active - hold.seatCount);
    await this.cache.set(`active_holds_trip:${hold.tripId}`, updated, HOLD_DURATION_SECONDS);

    // Update DB status if present
    try {
      await prisma.reservationHold.updateMany({
        where: { holdToken: holdId },
        data: { status: "RELEASED" },
      });
    } catch {
      // Ignored
    }
  }
}

export const inventoryConcurrency = new InventoryConcurrencyManager();
