// Bókun → website: changes made in Bókun to bookings that came from the website.
//
// The website sends every booking to Bókun (bokun-sync.ts). This is the way back: every 15 minutes
// (and on staff "Check Bókun now") the upcoming website bookings that are in Bókun are read from
// Bókun (GET /booking.json/booking/<code>) and compared with ours:
//
//   - cancelled in Bókun → cancelled here: seats released, nothing sent back to Bókun, an open
//     "Refund owed?" note for staff (a refund is never sent automatically) and the guest gets the
//     cancellation email.
//   - moved to another date or start time in Bókun → moved here to our departure on that date and
//     time (same tour), seats moved, and the guest gets the date-change email with the updated PDF
//     voucher. No matching departure, or no seats on it: staff are flagged instead.
//
// Every change is written to the booking's history (AuditLog, actions BOKUN_*, shown in the
// booking's Bókun logs), and each run to BokunSyncLog (syncType BOOKING_PULL).
//
// On with the live Bókun account. With a test account only when BOKUN_INBOUND_SYNC=true, and
// BOKUN_INBOUND_SYNC=false turns it off on either (docs/BOKUN.md).

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { renderMasterEmail } from "@/lib/email/email-template";
import { dateOnly, formatDateOnly, formatTimeOfDay, todayInMountainTime } from "@/lib/utils/time";
import { endBooking, releaseBookedSeats, takeBookedSeats } from "@/modules/departures/inventory";
import { seatsToReserve } from "@/modules/pricing/departure-pricing";
import { experienceTitle } from "@/modules/bookings/tour-itinerary";
import { bokunClient, bokunConnected, bokunIsTestAccount, type BokunApi } from "@/modules/bokun/config";
import { BokunApiError } from "@/modules/bokun/bokun.client";
import { sendDateChangeEmail } from "@/modules/bookings/confirmation-email";

const PROVIDER = "BOKUN";
const FLAG_PREFIX = "Bókun:";

let testOverride: boolean | null = null;

/** Tests: force the switch (null restores the env rule). */
export function setBokunInboundForTests(on: boolean | null) {
  testOverride = on;
}

export function bokunInboundEnabled() {
  if (testOverride !== null) return testOverride && bokunConnected();
  if (!bokunConnected()) return false;
  const setting = process.env.BOKUN_INBOUND_SYNC;
  if (setting === "false") return false;
  if (bokunIsTestAccount()) return setting === "true";
  return true;
}

/** What we read from Bókun's booking. Fields Bókun didn't give are null (and not compared). */
export interface BokunBookingState {
  status: string;
  date: string | null;
  time: string | null;
  participants: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A Bókun date: epoch milliseconds, "YYYY-MM-DD" or an ISO timestamp. */
function readDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    if (/^\d{10,}$/.test(value)) return readDate(Number(value));
  }
  return null;
}

function readTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/(?:^|T|\s)(\d{1,2}):(\d{2})/);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null;
}

/** Reads the parts we compare from Bókun's booking details (defensive: Bókun's fields vary by version). */
export function readBokunBooking(raw: unknown): BokunBookingState | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const activity = (Array.isArray(b.activityBookings) ? b.activityBookings[0] : null) as Record<string, unknown> | null;
  const status = String(activity?.status ?? b.status ?? "").toUpperCase();
  const startTime = activity?.startTime as unknown;
  const date = readDate(activity?.date) ?? readDate(activity?.startDate) ?? readDate(activity?.startDateTime);
  const time =
    readTime(typeof startTime === "object" && startTime ? (startTime as Record<string, unknown>).hour !== undefined ? `${(startTime as Record<string, number>).hour}:${pad((startTime as Record<string, number>).minute ?? 0)}` : null : startTime) ??
    readTime(activity?.startTimeStr) ??
    readTime(typeof activity?.startDateTime === "string" ? activity.startDateTime : null);
  const count = Number(activity?.totalParticipants ?? (Array.isArray(activity?.pricingCategoryBookings) ? activity!.pricingCategoryBookings.length : NaN));
  return { status, date, time, participants: Number.isFinite(count) ? count : null };
}

function audit(tx: Prisma.TransactionClient | typeof prisma, bookingId: string, action: string, details: Record<string, unknown>) {
  return tx.auditLog.create({ data: { userId: null, action, entityType: "Booking", entityId: bookingId, details: details as Prisma.InputJsonValue } });
}

async function raiseFlag(bookingId: string, note: string) {
  const open = await prisma.bookingFlag.findFirst({ where: { bookingId, status: "OPEN", type: "OTHER", note: { startsWith: FLAG_PREFIX } } });
  if (open) return prisma.bookingFlag.update({ where: { id: open.id }, data: { note: note.slice(0, 1000) } });
  return prisma.bookingFlag.create({ data: { bookingId, type: "OTHER", note: note.slice(0, 1000) } });
}

export interface PullResult {
  checked: number;
  cancelled: number;
  moved: number;
  flagged: number;
  errors: number;
}

/**
 * Reads upcoming website bookings from Bókun and applies Bókun's cancellations and date changes.
 * `bookingId`: just that one (staff "Check Bókun now"; runs even when the switch is off).
 */
export async function pullBokunChanges(options: { bookingId?: string; client?: BokunApi } = {}): Promise<PullResult | { skipped: string }> {
  const client = options.client ?? bokunClient();
  if (!client) return { skipped: "Bókun isn't connected (BOKUN_ACCESS_KEY / BOKUN_SECRET_KEY)." };
  if (!options.bookingId && !bokunInboundEnabled()) {
    return { skipped: bokunIsTestAccount() ? "Reading changes from a Bókun test account is off (BOKUN_INBOUND_SYNC=true turns it on)." : "Reading changes from Bókun is off (BOKUN_INBOUND_SYNC=false)." };
  }
  const bookings = await prisma.booking.findMany({
    where: {
      ...(options.bookingId ? { id: options.bookingId } : {}),
      status: "CONFIRMED",
      bokunBookingId: { not: null },
      tourDeparture: { date: { gte: dateOnly(todayInMountainTime()) } },
      // A staff date change still on its way to Bókun: Bókun shows the old date until it lands.
      syncTasks: { none: { provider: PROVIDER, status: { in: ["PENDING", "RETRYABLE_FAILURE", "IN_PROGRESS"] } } },
    },
    include: { tourDeparture: { include: { tour: true, shuttleRoute: true } } },
    take: 500,
  });

  const result: PullResult = { checked: 0, cancelled: 0, moved: 0, flagged: 0, errors: 0 };
  const changes: Record<string, unknown>[] = [];
  for (const booking of bookings) {
    const code = booking.bokunBookingId!;
    let state: BokunBookingState | null;
    try {
      state = readBokunBooking(await client.fetch("GET", `/booking.json/booking/${encodeURIComponent(code)}`));
    } catch (error) {
      result.errors++;
      const message = (error as Error).message.slice(0, 300);
      if (options.bookingId) await audit(prisma, booking.id, "BOKUN_CHECK_FAILED", { code, error: message });
      // A 404 means Bókun no longer has it (deleted, or the keys point at another account).
      if (error instanceof BokunApiError && error.status === 404) {
        await raiseFlag(booking.id, `${FLAG_PREFIX} Bókun has no booking ${code} any more. Check it in Bókun; the website booking is unchanged.`);
        result.flagged++;
      }
      continue;
    }
    result.checked++;
    if (!state) continue;

    // Cancelled in Bókun.
    if (/CANCEL/.test(state.status)) {
      const done = await cancelFromBokun(booking, code);
      if (done) {
        result.cancelled++;
        changes.push({ reference: booking.bookingReference, cancelled: true });
      }
      continue;
    }

    // Moved in Bókun.
    const ourDate = formatDateOnly(booking.tourDeparture.date);
    const ourTime = formatTimeOfDay(booking.tourDeparture.departureTime);
    const dateMoved = state.date && state.date !== ourDate;
    const timeMoved = state.time && state.time !== "00:00" && state.time !== ourTime;
    if (dateMoved || timeMoved) {
      const outcome = await moveFromBokun(booking, code, state.date ?? ourDate, timeMoved ? state.time : null);
      if (outcome === "moved") result.moved++;
      else result.flagged++;
      changes.push({ reference: booking.bookingReference, from: `${ourDate} ${ourTime}`, to: `${state.date ?? ourDate} ${state.time ?? ""}`.trim(), outcome });
      continue;
    }

    if (state.participants != null && state.participants !== booking.adultsCount + booking.childrenCount + booking.infantsCount && options.bookingId) {
      await audit(prisma, booking.id, "BOKUN_CHECKED", { code, note: `Bókun shows ${state.participants} guests; the website has ${booking.totalSeats} seats. Party size isn't changed automatically.` });
    } else if (options.bookingId) {
      await audit(prisma, booking.id, "BOKUN_CHECKED", { code, note: "Bókun and the website match." });
    }
  }

  await prisma.bokunSyncLog
    .create({ data: { syncType: "BOOKING_PULL", recordsSynced: result.cancelled + result.moved, status: result.errors ? "PARTIAL" : "SUCCESS", details: { ...result, changes, bookingId: options.bookingId ?? null } as Prisma.InputJsonValue } })
    .catch(() => {});
  return result;
}

type PulledBooking = Prisma.BookingGetPayload<{ include: { tourDeparture: { include: { tour: true; shuttleRoute: true } } } }>;

async function cancelFromBokun(booking: PulledBooking, code: string) {
  const ended = await prisma.$transaction(async (tx) => {
    const moved = await endBooking(tx, booking, ["CONFIRMED"], "CANCELLED", "cancelled in Bókun");
    if (!moved) return false;
    // It is already cancelled in Bókun: the cancel this queued must not be sent back.
    await tx.bookingSyncTask.updateMany({
      where: { bookingId: booking.id, provider: PROVIDER, operation: "CANCEL", status: "PENDING" },
      data: { status: "SKIPPED", lastError: "Cancelled in Bókun; nothing to send." },
    });
    await tx.bookingFlag.updateMany({
      where: { bookingId: booking.id, type: "PAYMENT_DUE", status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolution: "Booking cancelled in Bókun; nothing to collect." },
    });
    await audit(tx, booking.id, "BOKUN_CANCELLED", { code, note: `Cancelled in Bókun (${code}); cancelled on the website too.` });
    return true;
  });
  if (!ended) return false;
  const paid = await prisma.payment.aggregate({ where: { bookingId: booking.id, status: "SUCCEEDED" }, _sum: { amount: true } });
  const paidCents = paid._sum.amount ?? 0;
  if (paidCents > 0) {
    await raiseFlag(booking.id, `${FLAG_PREFIX} cancelled in Bókun (${code}). The guest paid $${(paidCents / 100).toFixed(2)} ${booking.currency} on the website: decide the refund (nothing was refunded automatically).`);
  }
  const title = experienceTitle(booking.tourDeparture);
  const day = formatDateOnly(booking.tourDeparture.date);
  const email = renderMasterEmail({
    subject: `Your Vista Chase booking is cancelled: ${booking.bookingReference}`,
    preheader: `Booking ${booking.bookingReference} for ${title} has been cancelled.`,
    title: "Booking Cancelled",
    greeting: `Hi ${booking.customerName.replace(/[<>&]/g, "")},`,
    paragraphs: [
      `Your booking <strong>${booking.bookingReference}</strong> for <strong>${title.replace(/[<>&]/g, "")}</strong> on ${day} has been cancelled.`,
      ...(paidCents > 0 ? ["Our team will be in touch about any refund due under our Booking &amp; Cancellation Policy."] : []),
    ],
    disclaimer: "Questions? Reply to this email or call +1 (825) 734-9456.",
    plainTextLines: [
      `Your Vista Chase booking ${booking.bookingReference} is cancelled.`,
      "",
      `Booking ${booking.bookingReference} for ${title} on ${day} has been cancelled.`,
      ...(paidCents > 0 ? ["Our team will be in touch about any refund due under our Booking & Cancellation Policy."] : []),
      "",
      "Questions? Call +1 (825) 734-9456 or email support@vistachase.com",
    ],
  });
  await getEmailProvider()
    .sendEmail({ to: booking.customerEmail, subject: email.subject, html: email.html, text: email.text })
    .catch((e) => console.error("[bokun] cancellation email failed:", (e as Error).message));
  return true;
}

async function moveFromBokun(booking: PulledBooking, code: string, date: string, time: string | null): Promise<"moved" | "flagged"> {
  const dep = booking.tourDeparture;
  const sameProduct = dep.tourId ? { tourId: dep.tourId } : { shuttleRouteId: dep.shuttleRouteId };
  const candidates = await prisma.tourDeparture.findMany({ where: { ...sameProduct, date: dateOnly(date), status: { not: "CANCELLED" } }, orderBy: { departureTime: "asc" } });
  const target = time
    ? candidates.find((c) => formatTimeOfDay(c.departureTime) === time)
    : candidates.find((c) => formatTimeOfDay(c.departureTime) === formatTimeOfDay(dep.departureTime)) ?? (candidates.length === 1 ? candidates[0] : undefined);
  const where = `${date}${time ? ` ${time}` : ""}`;
  if (!target || target.id === dep.id) {
    await raiseFlag(booking.id, `${FLAG_PREFIX} moved in Bókun (${code}) to ${where}, but the website has no departure for this tour then. Add the departure (Admin → Departures) and press "Check Bókun now", or change the date on the booking.`);
    await audit(prisma, booking.id, "BOKUN_CHANGE_NOT_APPLIED", { code, to: where, note: "No matching website departure." });
    return "flagged";
  }
  const moved = await prisma.$transaction(async (tx) => {
    const seats = seatsToReserve(target, booking.totalSeats);
    // Bókun already sold it: take the seats even past our own count (capacity grows to fit).
    const took = await takeBookedSeats(tx, target.id, seats);
    if (!took) {
      await tx.$executeRaw`UPDATE "TourDeparture" SET "capacityTotal" = GREATEST("capacityTotal", "capacityBooked" + "capacityHeld" + ${seats}), "capacityBooked" = "capacityBooked" + ${seats}, "updatedAt" = ${new Date()} WHERE "id" = ${target.id}`;
    }
    await releaseBookedSeats(tx, dep.id, seatsToReserve(dep, booking.totalSeats));
    const updated = await tx.booking.updateMany({ where: { id: booking.id, tourDepartureId: dep.id, status: "CONFIRMED" }, data: { tourDepartureId: target.id } });
    if (updated.count !== 1) throw new Error("Booking changed meanwhile");
    await audit(tx, booking.id, "BOKUN_DATE_CHANGED", {
      code,
      from: `${formatDateOnly(dep.date)} ${formatTimeOfDay(dep.departureTime)}`,
      to: `${formatDateOnly(target.date)} ${formatTimeOfDay(target.departureTime)}`,
      fromDepartureId: dep.id,
      toDepartureId: target.id,
      note: `Moved in Bókun (${code}); moved on the website too.`,
      overCapacity: !took,
    });
    return true;
  }).catch((e) => {
    console.warn(`[bokun] couldn't apply Bókun's date change for ${booking.bookingReference}: ${(e as Error).message}`);
    return false;
  });
  if (!moved) return "flagged";
  await sendDateChangeEmail(booking.bookingReference, { previous: `${formatDateOnly(dep.date)} ${formatTimeOfDay(dep.departureTime)}` }).catch((e) =>
    console.error("[bokun] date change email failed:", (e as Error).message),
  );
  return "moved";
}
