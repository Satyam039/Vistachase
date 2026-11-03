// Live seat check against Bókun before the website takes seats (hold or booking).
//
// The website sells from its own seat counts and sends each booking to Bókun afterwards
// (bokun-sync.ts). The seat sync (availability-sync.ts) keeps those counts close to Bókun's, but it
// runs every few minutes and is off on a Bókun test account. So with Bókun connected, the hold and
// the booking first ask Bókun for the departure's start: no start on that day and time, or fewer
// seats left than the guest wants, and the site refuses. Seats this site has already taken that
// Bókun doesn't know about yet (unsent bookings, other guests' holds) count against Bókun's number.
//
// If Bókun can't be reached the site goes on with its own seat count (the booking still goes to
// Bókun afterwards, and a refusal there is flagged for staff), so a Bókun outage never stops sales.

import prisma from "@/lib/db/prisma";
import { findSlot, shiftDay, type BokunAvailability } from "@/modules/bokun/bokun-booking";
import { bokunProductId } from "@/modules/bokun/bokun-sync";
import { bokunClient, bokunConnected, type BokunApi } from "@/modules/bokun/config";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";

/** Our bookings that hold seats on a departure (same as the seat sync). */
const SEAT_STATUSES = ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT", "PAID_UNSYNCED"] as const;
/** Don't keep a guest waiting on Bókun longer than this. */
const TIMEOUT_MS = 8_000;

const withTimeout = <T>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Bókun didn't answer in time")), TIMEOUT_MS))]);

/**
 * Null when Bókun has room for `guests` on this departure (or Bókun isn't in play), otherwise the
 * message to show the guest. `holdToken`: the guest's own hold, whose seats are theirs.
 */
export async function bokunSeatsError(
  departureId: string,
  guests: number,
  options: { holdToken?: string; client?: BokunApi } = {},
): Promise<string | null> {
  if (!bokunConnected()) return null;
  const departure = await prisma.tourDeparture.findUnique({
    where: { id: departureId },
    select: { date: true, departureTime: true, tour: { select: { slug: true, bokunId: true, category: true } } },
  });
  const productId = bokunProductId(departure?.tour);
  const client = options.client ?? bokunClient();
  if (!departure || !productId || !client) return null;

  const date = formatDateOnly(departure.date);
  const time = formatTimeOfDay(departure.departureTime);
  let slot: BokunAvailability | undefined;
  try {
    const list = (await withTimeout(client.getAvailabilities(productId, shiftDay(date, -1), shiftDay(date, 1)))) as BokunAvailability[] | null;
    slot = findSlot(Array.isArray(list) ? list : [], date, time);
  } catch (error) {
    console.warn(`[bokun] seat check skipped for ${departure.tour?.slug} ${date} ${time}: ${(error as Error).message.slice(0, 200)}`);
    return null;
  }

  if (!slot || slot.unavailable) return "This departure is no longer available. Please choose another date or time.";
  const bokunLeft = slot.soldOut ? 0 : Math.max(0, slot.availabilityCount ?? 0);
  if (departure.tour?.category === "PRIVATE") {
    return bokunLeft < 1 ? "This private vehicle is already booked for this departure." : null;
  }

  const now = new Date();
  const [unsent, holds] = await Promise.all([
    prisma.booking.aggregate({
      where: { tourDepartureId: departureId, status: { in: [...SEAT_STATUSES] }, bokunBookingId: null },
      _sum: { totalSeats: true },
    }),
    prisma.reservationHold.aggregate({
      where: {
        tourDepartureId: departureId,
        status: "ACTIVE",
        expiresAt: { gt: now },
        ...(options.holdToken ? { holdToken: { not: options.holdToken } } : {}),
      },
      _sum: { seatsCount: true },
    }),
  ]);
  const left = Math.max(0, bokunLeft - (unsent._sum.totalSeats ?? 0) - (holds._sum.seatsCount ?? 0));
  if (left >= guests) return null;
  return left === 0
    ? "This departure is sold out. Please choose another date or time."
    : `Only ${left} seat${left === 1 ? "" : "s"} left for this departure. Requested: ${guests}`;
}
