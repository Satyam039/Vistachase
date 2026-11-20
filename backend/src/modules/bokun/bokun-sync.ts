// Website bookings → Bókun, through the BookingSyncTask outbox. The website stays the booking
// system: a booking is confirmed (or cancelled) here first, and the same transaction queues the
// matching Bókun change, so a Bókun outage never loses or blocks a booking.
//
//   CONFIRMED  → CREATE task: reserve in Bókun for external payment, then confirm with the amount
//                the guest paid us. Bókun's confirmation code is saved as Booking.bokunBookingId.
//   CANCELLED  → CANCEL task (only when a CREATE was queued): cancel in Bókun, or release the
//                reservation, or skip when the booking never reached Bókun.
//
// Tasks run a moment after they are queued, then on the jobs runner (every 2 minutes) with
// backoff. A task that can't succeed (no seats in Bókun, refused, or an answer lost while Bókun
// may have created the booking) stops, marks the booking FAILED and raises a flag for staff
// (Admin → Bookings → Flags); staff fix it in Bókun or press Retry (Admin → Bookings → Bókun).
// Products sync only when they have a Bókun ID and bookingMode BOKUN (prisma/catalog/product-map.json).

import type { BookingStatus, BookingSyncTask, Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { countryFromPhone, knownCountry } from "@/lib/utils/phone-country";
import { BokunApiError } from "@/modules/bokun/bokun.client";
import { abortInBokun, BokunUnavailableError, buildNoteUpdate, cancelInBokun, confirmInBokun, findInBokun, reserveInBokun } from "@/modules/bokun/bokun-booking";
import { bokunClient, bokunConnected, bokunIsTestAccount, type BokunApi } from "@/modules/bokun/config";
import { formatDateOnly, formatTimeOfDay, todayInMountainTime, dateOnly } from "@/lib/utils/time";
import { PRODUCT_MAP } from "@/modules/tours/product-map";
import { airportTransferBokun, transferLegs, type TransferLeg } from "@/modules/bookings/airport-transfer";

type Tx = Prisma.TransactionClient;

const PROVIDER = "BOKUN";
const taskKey = (bookingId: string, operation: "CREATE" | "CANCEL") => `${PROVIDER}:${bookingId}:${operation}`;
/** Minutes to wait before each retry; after the last one the task stops and staff are flagged. */
const RETRY_MINUTES = [1, 5, 15, 60, 180, 360];
/** A task still IN_PROGRESS after this long died mid-run (process restart). */
const STALE_MS = 10 * 60_000;
/** Flags this module raises start with this, so it doesn't raise the same one twice. */
const FLAG_PREFIX = "Bókun:";

/** The tour's Bókun product: the product map (prisma/catalog/product-map.json) first, then the database. */
/** The Bókun start time IDs of a website product (product-map.json), if the doc gives them. */
export function bokunStartTimeIds(slug: string | null | undefined): number[] {
  return PRODUCT_MAP.find((p) => p.slug === slug)?.bokunStartTimeIds ?? [];
}

/** The Bókun rate IDs per season of a website product (product-map.json), if the doc gives them. */
export function bokunRateIds(slug: string | null | undefined) {
  return PRODUCT_MAP.find((p) => p.slug === slug)?.bokunRateIds;
}

export function bokunProductId(tour: { slug: string; bokunId: string | null } | null | undefined) {
  if (!tour) return null;
  const mapped = PRODUCT_MAP.find((p) => p.slug === tour.slug);
  if (mapped) return mapped.bookingMode === "BOKUN" ? mapped.bokunId : null;
  return tour.bokunId;
}

/**
 * Bókun's answer when a reservation lapsed or was aborted before it was confirmed, or Bókun has no
 * booking under that code at all ("No such booking found": the reservation was removed, or the
 * Bókun keys now point at another account).
 */
export function reservationGone(error: unknown) {
  return (
    error instanceof BokunApiError &&
    error.status < 500 &&
    (/not in reserved state[^:]*:\s*(TIMEOUT|ABORTED|CANCELLED|EXPIRED)/i.test(error.message) || /No such booking found/i.test(error.message))
  );
}

/** Retrying won't help: stop and ask staff. */
class StopError extends Error {}

/**
 * Queues the Bókun change for a booking status move. Called by transitionBooking inside the
 * transaction that made the move, so the task exists exactly when the move does.
 */
export async function queueBokunSync(tx: Tx, bookingId: string, to: BookingStatus) {
  if (!bokunConnected() || (to !== "CONFIRMED" && to !== "CANCELLED")) return;
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { bokunBookingId: true, priceSnapshot: true, tourDeparture: { select: { tour: { select: { slug: true, bokunId: true } } } } },
  });
  if (!booking) return;

  // The booking's airport transfer (one Bókun booking per one-way transfer), owner 2026-11-18.
  await queueTransferSync(tx, bookingId, to, booking.priceSnapshot);

  if (to === "CONFIRMED") {
    if (booking.bokunBookingId || !bokunProductId(booking.tourDeparture.tour)) return;
    await tx.bookingSyncTask.createMany({
      data: [{ bookingId, provider: PROVIDER, operation: "CREATE", idempotencyKey: taskKey(bookingId, "CREATE") }],
      skipDuplicates: true,
    });
    await tx.booking.update({ where: { id: bookingId }, data: { externalSyncStatus: "PENDING" } });
  } else {
    const created = await tx.bookingSyncTask.findUnique({ where: { idempotencyKey: taskKey(bookingId, "CREATE") }, select: { id: true } });
    if (!created && !booking.bokunBookingId) return; // never meant for Bókun
    await tx.bookingSyncTask.createMany({
      data: [{ bookingId, provider: PROVIDER, operation: "CANCEL", idempotencyKey: taskKey(bookingId, "CANCEL") }],
      skipDuplicates: true,
    });
  }
  runSoon();
}

let kicked = false;
let autoRun = true;
/** Runs the queue shortly after the queuing transaction commits (the jobs runner retries the rest). */
function runSoon() {
  if (kicked || !autoRun) return;
  kicked = true;
  setTimeout(() => {
    kicked = false;
    processBokunSyncTasks().catch((e) => console.error("[bokun] sync failed:", (e as Error).message));
  }, 1500).unref();
}

/** Tests: run the queue only when the test calls processBokunSyncTasks. */
export function setBokunAutoRunForTests(on: boolean) {
  autoRun = on;
}

export interface BokunSyncRunResult {
  processed: number;
  succeeded: number;
  retrying: number;
  failed: number;
  skipped: number;
}

/** Sends every due task (or one booking's) to Bókun. Safe to run often and concurrently. */
export async function processBokunSyncTasks(options: { now?: Date; bookingId?: string; client?: BokunApi } = {}): Promise<BokunSyncRunResult | { skipped: string }> {
  const client = options.client ?? bokunClient();
  if (!client) return { skipped: "Bókun isn't connected (BOKUN_ACCESS_KEY / BOKUN_SECRET_KEY)." };
  const now = options.now ?? new Date();
  const scope = options.bookingId ? { bookingId: options.bookingId } : {};
  await recoverStaleTasks(now, scope);

  const due = await prisma.bookingSyncTask.findMany({
    where: { ...scope, provider: PROVIDER, status: { in: ["PENDING", "RETRYABLE_FAILURE"] }, nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const result: BokunSyncRunResult = { processed: 0, succeeded: 0, retrying: 0, failed: 0, skipped: 0 };
  for (const task of due) {
    const claimed = await prisma.bookingSyncTask.updateMany({
      where: { id: task.id, status: { in: ["PENDING", "RETRYABLE_FAILURE"] } },
      data: { status: "IN_PROGRESS", attempts: { increment: 1 }, lastAttemptAt: now },
    });
    if (claimed.count === 0) continue; // another run took it
    const claimedTask = { ...task, attempts: task.attempts + 1 };
    const outcome =
      task.operation === TRANSFER_CREATE
        ? await runCreateTransfer(client, claimedTask, now)
        : task.operation === TRANSFER_CANCEL
          ? await runCancelTransfer(client, claimedTask, now)
          : task.operation === NOTE
            ? await runNote(client, claimedTask, now)
          : task.operation === "CREATE"
        ? await runCreate(client, claimedTask, now)
        : task.operation === CANCEL_OLD
          ? await runCancelOld(client, claimedTask, now)
          : await runCancel(client, claimedTask, now);
    result.processed++;
    result[outcome]++;
  }
  return result;
}

type Outcome = "succeeded" | "retrying" | "failed" | "skipped";

async function runCreate(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const booking = await prisma.booking.findUnique({
    where: { id: task.bookingId },
    include: { tourDeparture: { include: { tour: true } }, pickupStop: true, payments: true },
  });
  const tour = booking?.tourDeparture.tour;
  const productId = bokunProductId(tour);
  if (!booking || !tour || !productId) return finish(task, "SKIPPED", "Not a Bókun product.");
  if (booking.bokunBookingId) return finish(task, "SUCCEEDED", null, booking.bokunBookingId);
  // Cancelled before it reached Bókun: its CANCEL task releases any reservation.
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    await prisma.booking.update({ where: { id: booking.id }, data: { externalSyncStatus: "NOT_REQUIRED" } });
    return finish(task, "SKIPPED", `Booking was ${booking.status.toLowerCase()} before it reached Bókun.`);
  }

  const stage = (task.payload as { stage?: string } | null)?.stage;
  let code = task.externalRef;
  let submitting = false;
  try {
    // Reserves in Bókun and saves the code on the task (so a retry never reserves twice).
    const reserve = async () => {
      const dep = booking.tourDeparture;
      const place = booking.pickupStop?.name ?? booking.pickupCustomText ?? "";
      const reserved = await reserveInBokun(
        client,
        {
          bookingReference: booking.bookingReference,
          productBokunId: productId,
          startTimeIds: bokunStartTimeIds(tour.slug),
          rateIds: bokunRateIds(tour.slug),
          category: tour.category,
          date: formatDateOnly(dep.date),
          time: formatTimeOfDay(dep.departureTime),
          adults: booking.adultsCount,
          children: booking.childrenCount,
          infants: booking.infantsCount,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          country: knownCountry((booking.priceSnapshot as { customerCountry?: unknown } | null)?.customerCountry) ?? countryFromPhone(booking.customerPhone) ?? undefined,
          pickup: [place, booking.pickupTime ? `at ${booking.pickupTime}` : ""].filter(Boolean).join(" ") || undefined,
          specialRequests: booking.specialRequests ?? undefined,
        },
        async () => {
          submitting = true;
          await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { payload: { stage: "submitting" } } });
        },
      );
      submitting = false;
      await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: reserved, payload: { stage: "reserved" } } });
      return reserved;
    };
    if (!code && stage === "submitting") {
      // An earlier attempt got no answer while creating it: Bókun may have it. Look it up by our
      // reference; only what Bókun shows decides, so nothing is ever created twice.
      const found = await findInBokun(client, booking.bookingReference, replacedCode(task));
      if (found && found.status === "CONFIRMED") {
        await prisma.booking.update({ where: { id: booking.id }, data: { bokunBookingId: found.code, externalSyncStatus: "SYNCED", lastSyncAttemptAt: now } });
        await resolveFlags(booking.id);
        return finish(task, "SUCCEEDED", null, found.code);
      }
      if (found && found.status === "RESERVED") {
        code = found.code;
        await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: code, payload: { stage: "reserved" } } });
      } else if (found && found.gone) {
        console.warn(`[bokun] ${booking.bookingReference}: Bókun has it as ${found.code} (${found.status}); reserving again.`);
      } else {
        throw new StopError(`An earlier attempt got no answer from Bókun while creating it, and Bókun's booking search didn't show it, so it may still be there. Look for ${booking.bookingReference} in Bókun before adding it by hand.`);
      }
    }
    if (!code) code = await reserve();

    const paid = booking.payments.filter((p) => p.status === "SUCCEEDED");
    // The airport transfer goes to Bókun as its own booking(s): the tour's Bókun booking is confirmed
    // with what was paid for the tour alone.
    const transferShare = transferLegs(booking.priceSnapshot).reduce((n, leg) => n + legPaidCents(booking, leg), 0);
    const paidCents = Math.max(0, paid.reduce((sum, p) => sum + p.amount, 0) - transferShare);
    const confirm = (reservation: string) =>
      confirmInBokun(
        client,
        reservation,
        booking.bookingReference,
        {
          amount: paidCents / 100,
          currency: booking.currency,
          transactionId: paid.find((p) => p.transactionId)?.transactionId ?? undefined,
        },
        { testAccount: bokunIsTestAccount(), bookingTotal: booking.totalAmount / 100 },
      );
    try {
      await confirm(code);
    } catch (error) {
      // Bókun lets an unconfirmed reservation lapse (TIMEOUT) or staff abort it. That one is gone,
      // so nothing is doubled by reserving again, once, and confirming the new one.
      if (!reservationGone(error)) throw error;
      // Bókun may hold it under another code: confirm that one rather than reserving twice.
      const found = await findInBokun(client, booking.bookingReference, replacedCode(task));
      if (found && found.code !== code && found.status === "CONFIRMED") {
        code = found.code;
      } else if (found && found.code !== code && found.status === "RESERVED") {
        code = found.code;
        await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: code, payload: { stage: "reserved" } } });
        await confirm(code);
      } else {
        console.warn(`[bokun] reservation ${code} for ${booking.bookingReference} is no longer reserved in Bókun; reserving again.`);
        await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: null, payload: { stage: "lapsed", lapsed: code } } });
        code = await reserve();
        await confirm(code);
      }
    }
    await prisma.booking.update({ where: { id: booking.id }, data: { bokunBookingId: code, externalSyncStatus: "SYNCED", lastSyncAttemptAt: now } });
    await resolveFlags(booking.id);
    return finish(task, "SUCCEEDED", null, code);
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    await prisma.booking.update({ where: { id: booking.id }, data: { lastSyncAttemptAt: now } });
    let stop: string | null = null;
    if (error instanceof StopError) stop = message;
    else if (error instanceof BokunUnavailableError) stop = `Bókun wouldn't take it: ${message} Add it in Bókun by hand (the guest is booked and paid on the website).`;
    else if (submitting) {
      // The create call failed. A refusal (4xx) created nothing and is safe to retry by hand;
      // anything else may have created the booking in Bókun.
      if (error instanceof BokunApiError && error.status < 500) {
        await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { payload: { stage: "refused" } } });
        stop = `Bókun refused it: ${message} Add it in Bókun by hand, or fix the product in Bókun and press Retry.`;
      } else {
        // No answer: the stage stays "submitting", so the next run looks it up in Bókun first.
        return retryLater(task, `No answer from Bókun while creating it (${message}); checking Bókun on the next try.`, now);
      }
    } else if (error instanceof BokunApiError && error.status < 500) {
      stop = code
        ? `Reserved in Bókun as ${code}, but Bókun refused the confirmation: ${message} Confirm it in Bókun by hand.`
        : `Bókun refused it: ${message} Add it in Bókun by hand, or fix the product in Bókun and press Retry.`;
    }
    if (stop) {
      await failBooking(booking.id, stop);
      return finish(task, "FAILED", stop);
    }
    if (task.attempts >= RETRY_MINUTES.length) {
      // Bókun down or not answering: staff hear about it, but the booking keeps trying (every
      // 6 hours) until the day of the trip, so it goes in by itself once Bókun is back.
      const tripDay = formatDateOnly(booking.tourDeparture.date);
      if (tripDay < todayInMountainTime()) {
        await failBooking(booking.id, `Bókun didn't answer after ${task.attempts} tries (${message}), and the trip date has passed. Add it in Bókun by hand if it's still needed.`);
        return finish(task, "FAILED", message);
      }
      if (task.attempts === RETRY_MINUTES.length) {
        await raiseFlag(booking.id, `${FLAG_PREFIX} not added yet. Bókun didn't answer after ${task.attempts} tries (${message}). It keeps trying every 6 hours until the trip; nothing to do unless Bókun stays down.`);
      }
    }
    return retryLater(task, message, now);
  }
}

async function runCancel(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const booking = await prisma.booking.findUnique({ where: { id: task.bookingId }, select: { id: true, bookingReference: true, bokunBookingId: true } });
  if (!booking) return finish(task, "SKIPPED", "Booking not found.");
  // The latest create: after a staff date change a second create (CREATE:<old code>) replaces the first.
  const create = await prisma.bookingSyncTask.findFirst({ where: { bookingId: booking.id, provider: PROVIDER, operation: "CREATE" }, orderBy: { createdAt: "desc" } });
  try {
    if (booking.bokunBookingId) {
      await cancelInBokun(client, booking.bokunBookingId, `Cancelled on vistachase.com (${booking.bookingReference})`);
      return finish(task, "SUCCEEDED", null, booking.bokunBookingId);
    }
    if (create?.status === "IN_PROGRESS") return retryLater(task, "Waiting for the create to finish.", now);
    // The create stopped with a flag (staff may have added it in Bókun by hand): say it's cancelled.
    if (create?.status === "FAILED") {
      await raiseFlag(booking.id, `${FLAG_PREFIX} cancelled on the website. It never reached Bókun automatically; if it was added in Bókun by hand, cancel it there too.`);
      return finish(task, "SKIPPED", "Create had stopped; staff flagged.");
    }
    // Reserved in Bókun but never confirmed: release the seats.
    if (create?.externalRef) await abortInBokun(client, create.externalRef);
    if (create && (create.status === "PENDING" || create.status === "RETRYABLE_FAILURE")) {
      await prisma.bookingSyncTask.update({ where: { id: create.id }, data: { status: "SKIPPED", lastError: "Booking cancelled before it reached Bókun." } });
    }
    return finish(task, "SKIPPED", "Never confirmed in Bókun; nothing to cancel.", create?.externalRef ?? null);
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    const refused = error instanceof BokunApiError && error.status < 500;
    if (refused || task.attempts >= RETRY_MINUTES.length) {
      const code = booking.bokunBookingId ?? create?.externalRef;
      await raiseFlag(booking.id, `${FLAG_PREFIX} cancelled on the website but not in Bókun (${message}). Cancel ${code ?? booking.bookingReference} in Bókun by hand.`);
      return finish(task, "FAILED", message);
    }
    return retryLater(task, message, now);
  }
}

// ---------------------------------------------------------------------------------------------
// Date change by staff (Admin → booking → Change tour date, booking-manage.ts)
//
// Bókun's own date change isn't used: the booking is created again in Bókun on the new date (a
// CREATE task keyed CREATE:<old code>), and only once that one is confirmed is the old Bókun
// booking cancelled (a CANCEL_OLD task carrying the old code). If the new date can't be created
// in Bókun the old one stays there and staff are flagged, so Bókun never loses the guest.

const CANCEL_OLD = "CANCEL_OLD";

/** The Bókun code a create replaces (a date change), from its key BOKUN:<booking>:CREATE:<code>. */
function replacedCode(task: Pick<BookingSyncTask, "idempotencyKey" | "operation">) {
  if (task.operation !== "CREATE") return undefined;
  return task.idempotencyKey.split(":").slice(3).join(":") || undefined;
}

/**
 * Called inside the transaction that moved the booking to another departure. `oldCode`: the
 * booking's Bókun code before the move (null when it wasn't in Bókun yet).
 */
export async function queueBokunDateChange(tx: Tx, bookingId: string, oldCode: string | null) {
  if (!bokunConnected()) return;
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, tourDeparture: { select: { tour: { select: { slug: true, bokunId: true } } } } },
  });
  if (!booking || !bokunProductId(booking.tourDeparture.tour)) return;
  if (!oldCode) {
    // Not in Bókun yet: a waiting create simply books the new date when it runs.
    const waiting = await tx.bookingSyncTask.findFirst({ where: { bookingId, provider: PROVIDER, operation: "CREATE", status: { in: ["PENDING", "RETRYABLE_FAILURE"] } } });
    if (!waiting && (booking.status === "CONFIRMED" || booking.status === "COMPLETED")) {
      const failed = await tx.bookingSyncTask.findFirst({ where: { bookingId, provider: PROVIDER, operation: "CREATE", status: "FAILED" } });
      if (failed) {
        // It had stopped (staff were flagged): send it again for the new date.
        await tx.bookingSyncTask.update({ where: { id: failed.id }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null, externalRef: null, payload: { stage: "date-changed" } } });
        await tx.booking.update({ where: { id: bookingId }, data: { externalSyncStatus: "PENDING" } });
      } else await queueBokunSync(tx, bookingId, "CONFIRMED");
    }
    runSoon();
    return;
  }
  await tx.bookingSyncTask.createMany({
    data: [
      { bookingId, provider: PROVIDER, operation: "CREATE", idempotencyKey: `${taskKey(bookingId, "CREATE")}:${oldCode}`, payload: { stage: "date-change", replaces: oldCode } },
      { bookingId, provider: PROVIDER, operation: CANCEL_OLD, idempotencyKey: `${PROVIDER}:${bookingId}:${CANCEL_OLD}:${oldCode}`, externalRef: oldCode, payload: { replaces: oldCode } },
    ],
    skipDuplicates: true,
  });
  await tx.booking.update({ where: { id: bookingId }, data: { bokunBookingId: null, externalSyncStatus: "PENDING" } });
  runSoon();
}

/** True while a Bókun task for this booking is running or holds a reservation (a date change must wait). */
export async function bokunBusy(bookingId: string) {
  const busy = await prisma.bookingSyncTask.findFirst({
    where: {
      bookingId,
      provider: PROVIDER,
      OR: [{ status: "IN_PROGRESS" }, { operation: "CREATE", status: { in: ["PENDING", "RETRYABLE_FAILURE"] }, externalRef: { not: null } }],
    },
    select: { id: true },
  });
  return Boolean(busy);
}

async function runCancelOld(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const oldCode = task.externalRef;
  if (!oldCode) return finish(task, "SKIPPED", "No old Bókun booking.");
  const booking = await prisma.booking.findUnique({ where: { id: task.bookingId }, select: { id: true, bookingReference: true, status: true } });
  if (!booking) return finish(task, "SKIPPED", "Booking not found.");
  const create = await prisma.bookingSyncTask.findUnique({ where: { idempotencyKey: `${taskKey(booking.id, "CREATE")}:${oldCode}` } });
  const live = booking.status === "CONFIRMED" || booking.status === "COMPLETED";
  if (create && (create.status === "PENDING" || create.status === "RETRYABLE_FAILURE" || create.status === "IN_PROGRESS")) {
    return retryLater({ ...task, attempts: Math.min(task.attempts, RETRY_MINUTES.length) }, "Waiting for the booking on the new date to reach Bókun.", now);
  }
  if (create && create.status !== "SUCCEEDED" && live) {
    await raiseFlag(booking.id, `${FLAG_PREFIX} the date was changed on the website, but the new date couldn't be added in Bókun, so the old Bókun booking ${oldCode} was left on the old date. Change it in Bókun by hand.`);
    return finish(task, "SKIPPED", "New date not in Bókun; old booking kept and staff flagged.");
  }
  try {
    await cancelInBokun(client, oldCode, `Date changed on vistachase.com (${booking.bookingReference})`);
    return finish(task, "SUCCEEDED", null, oldCode);
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    const refused = error instanceof BokunApiError && error.status < 500;
    if (refused || task.attempts >= RETRY_MINUTES.length) {
      await raiseFlag(booking.id, `${FLAG_PREFIX} the date was changed and the new date is in Bókun, but the old Bókun booking ${oldCode} couldn't be cancelled (${message}). Cancel ${oldCode} in Bókun by hand.`);
      return finish(task, "FAILED", message);
    }
    return retryLater(task, message, now);
  }
}

// ---------------------------------------------------------------------------------------------
// Pickup / phone / requests changed after the booking reached Bókun (owner 2026-11-20)
//
// Bókun's API can't rewrite the "Note for booking" written when the booking was created, so a
// NOTE task adds a note to the Bókun booking with the current pickup, guest phone and requests
// (REST v2 experience booking notes). Later edits update that same note rather than adding more.
// The task reads the booking when it runs, so several quick edits send the latest details once.
// A refusal never touches the booking itself: staff get a "Bókun note:" flag to update it by hand.

const NOTE = "NOTE";
const NOTE_FLAG_PREFIX = "Bókun note:";

/** The pickup line, exactly as the create sends it. */
function pickupLine(booking: { pickupStop: { name: string } | null; pickupCustomText: string | null; pickupTime: string | null }) {
  const place = booking.pickupStop?.name ?? booking.pickupCustomText ?? "";
  return [place, booking.pickupTime ? `at ${booking.pickupTime}` : ""].filter(Boolean).join(" ") || null;
}

/**
 * Called after staff (or the guest) change the pickup, phone or requests. Queues a note update when
 * the booking is in Bókun, or is reserved there with the old details. Never throws: the edit itself
 * is already saved.
 */
export async function queueBokunNoteUpdate(bookingId: string) {
  try {
    if (!bokunConnected()) return;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, bokunBookingId: true } });
    if (!booking || (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED")) return;
    if (!booking.bokunBookingId) {
      // Not sent yet: the create reads the booking when it runs, so it carries the new details.
      // Only a create already reserved in Bókun (with the old note) needs a note after it.
      const reserved = await prisma.bookingSyncTask.findFirst({
        where: { bookingId, provider: PROVIDER, operation: "CREATE", status: { in: ["PENDING", "RETRYABLE_FAILURE", "IN_PROGRESS"] }, OR: [{ externalRef: { not: null } }, { status: "IN_PROGRESS" }] },
        select: { id: true },
      });
      if (!reserved) return;
    }
    const waiting = await prisma.bookingSyncTask.findFirst({ where: { bookingId, provider: PROVIDER, operation: NOTE, status: { in: ["PENDING", "RETRYABLE_FAILURE"] } } });
    if (waiting) {
      await prisma.bookingSyncTask.update({ where: { id: waiting.id }, data: { nextAttemptAt: new Date() } });
    } else {
      await prisma.bookingSyncTask.create({
        data: { bookingId, provider: PROVIDER, operation: NOTE, idempotencyKey: `${PROVIDER}:${bookingId}:${NOTE}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` },
      });
    }
    runSoon();
  } catch (error) {
    console.error(`[bokun] couldn't queue the note update for ${bookingId}:`, (error as Error).message);
  }
}

/** The note this booking last put on its Bókun booking: "<code>|<experience booking id>|<note id>". */
function parseNoteRef(ref: string | null | undefined) {
  const [code, experienceBookingId, noteId] = (ref ?? "").split("|");
  return code && experienceBookingId && noteId ? { code, experienceBookingId, noteId } : null;
}

/** The product (experience) booking inside a Bókun booking, from GET /booking.json/booking/{code}. */
async function experienceBookingId(client: BokunApi, code: string) {
  const booking = (await client.fetch("GET", `/booking.json/booking/${encodeURIComponent(code)}`)) as Record<string, unknown> | null;
  const list = (booking?.activityBookings ?? booking?.productBookings) as Record<string, unknown>[] | undefined;
  const id = Array.isArray(list) ? (list[0]?.id ?? list[0]?.bookingId) : undefined;
  if (id == null || !/^\d+$/.test(String(id))) throw new StopError(`Bókun booking ${code} shows no product booking to add the note to.`);
  return String(id);
}

async function runNote(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const booking = await prisma.booking.findUnique({
    where: { id: task.bookingId },
    select: { id: true, status: true, bookingReference: true, bokunBookingId: true, customerPhone: true, specialRequests: true, pickupCustomText: true, pickupTime: true, pickupStop: { select: { name: true } } },
  });
  if (!booking) return finish(task, "SKIPPED", "Booking not found.");
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") return finish(task, "SKIPPED", `Booking is ${booking.status.toLowerCase()}.`);
  const code = booking.bokunBookingId;
  if (!code) {
    const pending = await prisma.bookingSyncTask.findFirst({ where: { bookingId: booking.id, provider: PROVIDER, operation: "CREATE", status: { in: ["PENDING", "RETRYABLE_FAILURE", "IN_PROGRESS"] } }, select: { id: true } });
    if (pending && task.attempts < RETRY_MINUTES.length) return retryLater(task, "Waiting for the booking to reach Bókun.", now);
    return finish(task, "SKIPPED", "The booking isn't in Bókun.");
  }

  const text = buildNoteUpdate({ bookingReference: booking.bookingReference, pickup: pickupLine(booking), customerPhone: booking.customerPhone, specialRequests: booking.specialRequests });
  const last = await prisma.bookingSyncTask.findFirst({
    where: { bookingId: booking.id, provider: PROVIDER, operation: NOTE, status: "SUCCEEDED", externalRef: { startsWith: `${code}|` } },
    orderBy: { updatedAt: "desc" },
  });
  const lastRef = parseNoteRef(last?.externalRef);
  if (lastRef && (last?.payload as { text?: string } | null)?.text === text) return finish(task, "SKIPPED", "Bókun already has these details.");

  try {
    let ref: string | null = null;
    if (lastRef) {
      try {
        await client.fetch("PUT", `/restapi/v2.0/experienceBooking/${lastRef.experienceBookingId}/notes/${lastRef.noteId}`, { text });
        ref = last!.externalRef;
      } catch (error) {
        // The note was deleted in Bókun: add a new one.
        if (!(error instanceof BokunApiError && error.status === 404)) throw error;
      }
    }
    if (!ref) {
      const experience = await experienceBookingId(client, code);
      const created = (await client.fetch("POST", `/restapi/v2.0/experienceBooking/${experience}/notes`, { type: "GENERAL", text })) as { id?: unknown } | null;
      ref = `${code}|${experience}|${created?.id ?? "?"}`;
    }
    await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { payload: { text } } });
    await prisma.bookingFlag.updateMany({
      where: { bookingId: booking.id, status: "OPEN", type: "OTHER", note: { startsWith: NOTE_FLAG_PREFIX } },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolution: "Note updated in Bókun." },
    });
    return finish(task, "SUCCEEDED", null, ref);
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    const refused = error instanceof StopError || (error instanceof BokunApiError && error.status < 500);
    if (refused || task.attempts >= RETRY_MINUTES.length) {
      await raiseFlag(
        booking.id,
        `${NOTE_FLAG_PREFIX} the pickup / phone / requests were changed on the website, but the note on Bókun booking ${code} couldn't be updated (${message}). Update it in Bókun by hand: ${text.replace(/\n/g, " ")}`,
        NOTE_FLAG_PREFIX,
      );
      return finish(task, "FAILED", message);
    }
    return retryLater(task, message, now);
  }
}

async function finish(task: BookingSyncTask, status: "SUCCEEDED" | "FAILED" | "SKIPPED", lastError: string | null, externalRef?: string | null): Promise<Outcome> {
  await prisma.bookingSyncTask.update({
    where: { id: task.id },
    data: { status, lastError, ...(externalRef !== undefined ? { externalRef } : {}) },
  });
  return status === "SUCCEEDED" ? "succeeded" : status === "FAILED" ? "failed" : "skipped";
}

async function retryLater(task: BookingSyncTask, lastError: string, now: Date): Promise<Outcome> {
  const minutes = RETRY_MINUTES[Math.min(task.attempts, RETRY_MINUTES.length) - 1] ?? 1;
  await prisma.bookingSyncTask.update({
    where: { id: task.id },
    data: { status: "RETRYABLE_FAILURE", lastError, nextAttemptAt: new Date(now.getTime() + minutes * 60_000) },
  });
  return "retrying";
}

async function failBooking(bookingId: string, note: string) {
  await prisma.booking.update({ where: { id: bookingId }, data: { externalSyncStatus: "FAILED" } });
  await raiseFlag(bookingId, `${FLAG_PREFIX} not added. ${note}`);
}

/** One open Bókun flag per booking (Admin → Bookings → Flags); the airport transfer has its own. */
async function raiseFlag(bookingId: string, note: string, prefix = FLAG_PREFIX) {
  const open = await prisma.bookingFlag.findFirst({ where: { bookingId, status: "OPEN", type: "OTHER", note: { startsWith: prefix } } });
  if (open) {
    await prisma.bookingFlag.update({ where: { id: open.id }, data: { note: note.slice(0, 1000) } });
    return;
  }
  console.warn(`[bokun] booking ${bookingId} flagged: ${note}`);
  await prisma.bookingFlag.create({ data: { bookingId, type: "OTHER", note: note.slice(0, 1000) } });
}

/** The booking reached Bókun: its open Bókun flags are done. */
async function resolveFlags(bookingId: string, prefix = FLAG_PREFIX) {
  await prisma.bookingFlag.updateMany({ where: { bookingId, status: "OPEN", type: "OTHER", note: { startsWith: prefix } }, data: { status: "RESOLVED", resolvedAt: new Date(), resolution: "Reached Bókun." } });
}

/** Tasks left IN_PROGRESS by a run that died. A create that was mid-submit can't be retried blindly. */
async function recoverStaleTasks(now: Date, scope: { bookingId?: string }) {
  const stale = await prisma.bookingSyncTask.findMany({
    where: { ...scope, provider: PROVIDER, status: "IN_PROGRESS", lastAttemptAt: { lt: new Date(now.getTime() - STALE_MS) } },
  });
  for (const task of stale) {
    const midSubmit = task.operation === "CREATE" && !task.externalRef && (task.payload as { stage?: string } | null)?.stage === "submitting";
    if (midSubmit) {
      // The server stopped mid-create: the next run looks it up in Bókun before anything else.
      await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { status: "RETRYABLE_FAILURE", nextAttemptAt: now, lastError: "Interrupted while creating in Bókun; checking Bókun." } });
    } else {
      await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { status: "RETRYABLE_FAILURE", nextAttemptAt: now } });
    }
  }
}

/**
 * Staff Retry: a stopped task for this booking goes back in the queue and runs now. Retrying a
 * create that may already be in Bókun is the staff member's call (they checked Bókun first).
 */
export async function retryBokunSync(bookingId: string) {
  const tasks = await prisma.bookingSyncTask.findMany({ where: { bookingId, provider: PROVIDER, status: "FAILED" } });
  if (tasks.length === 0) return { status: 404, error: "Nothing waiting to retry for this booking." } as const;
  for (const task of tasks) {
    const stage = (task.payload as { stage?: string } | null)?.stage;
    await prisma.bookingSyncTask.update({
      where: { id: task.id },
      data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null, ...(stage === "submitting" || stage === "refused" ? { payload: { stage: "retried" } } : {}) },
    });
  }
  // A note update alone doesn't change whether the booking itself is in Bókun.
  if (tasks.some((t) => t.operation !== NOTE)) await prisma.booking.update({ where: { id: bookingId }, data: { externalSyncStatus: "PENDING" } });
  const run = await processBokunSyncTasks({ bookingId });
  return { status: 200, run } as const;
}

/**
 * Queues upcoming confirmed bookings that aren't in Bókun yet (bookings made before Bókun was
 * connected). Each one is sent once; a booking already queued is left alone.
 */
export async function queueUpcomingBookings() {
  if (!bokunConnected()) return { status: 409, error: "Bókun isn't connected yet." } as const;
  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      bokunBookingId: null,
      syncTasks: { none: { provider: PROVIDER, operation: "CREATE" } },
      tourDeparture: { date: { gte: dateOnly(todayInMountainTime()) }, tourId: { not: null } },
    },
    select: { id: true },
  });
  for (const b of bookings) {
    await prisma.$transaction(async (tx) => queueBokunSync(tx, b.id, "CONFIRMED"));
  }
  return { status: 200, queued: bookings.length } as const;
}

/** Admin → Bookings → Bókun: connection, queue and the latest seat sync. */
export async function bokunSyncStatus() {
  const [counts, problems, lastSync] = await Promise.all([
    prisma.bookingSyncTask.groupBy({ by: ["status"], where: { provider: PROVIDER }, _count: true }),
    prisma.bookingSyncTask.findMany({
      where: { provider: PROVIDER, status: { in: ["FAILED", "RETRYABLE_FAILURE"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { booking: { select: { id: true, bookingReference: true, customerName: true, status: true } } },
    }),
    prisma.bokunSyncLog.findFirst({ where: { syncType: "POLL" }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    problems: problems.map((t) => ({
      id: t.id,
      operation: t.operation,
      status: t.status,
      attempts: t.attempts,
      lastError: t.lastError,
      nextAttemptAt: t.nextAttemptAt,
      updatedAt: t.updatedAt,
      booking: t.booking,
    })),
    lastSeatSync: lastSync ? { at: lastSync.createdAt, status: lastSync.status, details: lastSync.details } : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Airport transfers (owner, 2026-11-18): a private booking's Calgary Airport transfer is sent to
// Bókun as its own booking on the transfer product for where the guest stays (Banff 1356054,
// Canmore 1356055, Lake Louise 1356058), at the "up to 6" or "up to 12" guests rate, on the flight
// date. A round trip is two bookings (arrival and departure). Each one-way transfer is a
// CREATE_TRANSFER task keyed by its leg (BOKUN:<booking>:CREATE_TRANSFER:ARRIVAL); its Bókun code is
// the task's externalRef. Bókun's externalBookingReference is "<reference>-ARR" / "<reference>-DEP",
// so a lost answer can be looked up without doubling it. A transfer that can't go in raises its own
// flag ("Bókun airport transfer: ...") and never blocks the tour's Bókun booking.

export const TRANSFER_CREATE = "CREATE_TRANSFER";
export const TRANSFER_CANCEL = "CANCEL_TRANSFER";
const TRANSFER_FLAG = "Bókun airport transfer:";
const LEG_SUFFIX: Record<TransferLeg["leg"], string> = { ARRIVAL: "ARR", DEPARTURE: "DEP" };
const transferKey = (bookingId: string, operation: string, leg: TransferLeg["leg"]) => `${PROVIDER}:${bookingId}:${operation}:${leg}`;

/** The part of what the guest paid that belongs to one transfer leg (a deposit pays the same share of each). */
function legPaidCents(booking: { totalAmount: number; payments: { status: string; amount: number }[] }, leg: TransferLeg) {
  if (!leg.unitCents || booking.totalAmount <= 0) return 0;
  const paid = booking.payments.filter((p) => p.status === "SUCCEEDED").reduce((n, p) => n + p.amount, 0);
  return Math.round((paid * Math.min(leg.unitCents, booking.totalAmount)) / booking.totalAmount);
}

async function queueTransferSync(tx: Tx, bookingId: string, to: BookingStatus, priceSnapshot: unknown) {
  const legs = transferLegs(priceSnapshot);
  if (legs.length === 0) return;
  if (to === "CONFIRMED") {
    await tx.bookingSyncTask.createMany({
      data: legs.map((l) => ({ bookingId, provider: PROVIDER, operation: TRANSFER_CREATE, idempotencyKey: transferKey(bookingId, TRANSFER_CREATE, l.leg), payload: { leg: l.leg } })),
      skipDuplicates: true,
    });
  } else {
    const creates = await tx.bookingSyncTask.findMany({ where: { bookingId, provider: PROVIDER, operation: TRANSFER_CREATE }, select: { payload: true } });
    const queued = creates.map((c) => (c.payload as { leg?: TransferLeg["leg"] } | null)?.leg).filter((l): l is TransferLeg["leg"] => Boolean(l));
    if (queued.length === 0) return;
    await tx.bookingSyncTask.createMany({
      data: queued.map((leg) => ({ bookingId, provider: PROVIDER, operation: TRANSFER_CANCEL, idempotencyKey: transferKey(bookingId, TRANSFER_CANCEL, leg), payload: { leg } })),
      skipDuplicates: true,
    });
  }
  runSoon();
}

const taskLeg = (task: Pick<BookingSyncTask, "payload">) => (task.payload as { leg?: TransferLeg["leg"] } | null)?.leg;

async function runCreateTransfer(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const booking = await prisma.booking.findUnique({ where: { id: task.bookingId }, include: { pickupStop: true, payments: true } });
  const legName = taskLeg(task);
  const leg = booking ? transferLegs(booking.priceSnapshot).find((l) => l.leg === legName) : undefined;
  if (!booking || !leg) return finish(task, "SKIPPED", "No airport transfer on this booking.");
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") return finish(task, "SKIPPED", `Booking was ${booking.status.toLowerCase()} before the transfer reached Bókun.`);
  const product = airportTransferBokun(leg.area, leg.guests);
  const reference = `${booking.bookingReference}-${LEG_SUFFIX[leg.leg]}`;
  const payload = { ...((task.payload as object | null) ?? {}), leg: leg.leg };
  const stage = (task.payload as { stage?: string } | null)?.stage;
  let code = task.externalRef;
  let submitting = false;
  try {
    if (stage === "confirmed" && code) return finish(task, "SUCCEEDED", null, code);
    if (!code && stage === "submitting") {
      const found = await findInBokun(client, reference);
      if (found && (found.status === "CONFIRMED" || found.status === "RESERVED")) code = found.code;
      else if (!found || !found.gone) {
        throw new StopError(`An earlier attempt got no answer from Bókun while creating the transfer, and Bókun's booking search didn't show it. Look for ${reference} in Bókun before adding it by hand.`);
      }
      if (found?.status === "CONFIRMED") {
        await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: code, payload: { ...payload, stage: "confirmed" } } });
        await resolveFlags(booking.id, TRANSFER_FLAG);
        return finish(task, "SUCCEEDED", null, code);
      }
    }
    if (!code) {
      code = await reserveInBokun(
        client,
        {
          bookingReference: reference,
          productBokunId: product.productId,
          rateId: product.rateId,
          anyStartThatDay: true,
          pricedPerVehicle: true,
          category: "PRIVATE",
          date: leg.date,
          time: leg.time,
          adults: leg.guests,
          children: 0,
          infants: 0,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          country: knownCountry((booking.priceSnapshot as { customerCountry?: unknown } | null)?.customerCountry) ?? countryFromPhone(booking.customerPhone) ?? undefined,
          pickup: leg.from,
          specialRequests: `${leg.description} Tour booking ${booking.bookingReference}.`,
        },
        async () => {
          submitting = true;
          await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { payload: { ...payload, stage: "submitting" } } });
        },
      );
      submitting = false;
      await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: code, payload: { ...payload, stage: "reserved" } } });
    }
    const paid = booking.payments.filter((p) => p.status === "SUCCEEDED");
    await confirmInBokun(
      client,
      code,
      reference,
      { amount: legPaidCents(booking, leg) / 100, currency: booking.currency, transactionId: paid.find((p) => p.transactionId)?.transactionId ?? undefined },
      { testAccount: bokunIsTestAccount(), bookingTotal: (leg.unitCents ?? 0) / 100 },
    );
    await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { payload: { ...payload, stage: "confirmed" } } });
    await resolveFlags(booking.id, TRANSFER_FLAG);
    return finish(task, "SUCCEEDED", null, code);
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    const what = `${leg.leg === "ARRIVAL" ? "arrival" : "departure"} transfer on ${leg.date}`;
    let stop: string | null = null;
    if (error instanceof StopError) stop = message;
    else if (error instanceof BokunUnavailableError) stop = `Bókun wouldn't take the ${what}: ${message} Add it in Bókun by hand (the guest booked and paid it on the website).`;
    else if (error instanceof BokunApiError && error.status < 500) {
      stop = code
        ? `the ${what} is reserved in Bókun as ${code}, but Bókun refused the confirmation: ${message} Confirm it in Bókun by hand.`
        : `Bókun refused the ${what}: ${message} Add it in Bókun by hand, or fix the transfer product in Bókun and press Retry.`;
    } else if (submitting) {
      return retryLater(task, `No answer from Bókun while creating the ${what} (${message}); checking Bókun on the next try.`, now);
    }
    if (stop || task.attempts >= RETRY_MINUTES.length) {
      await raiseFlag(booking.id, `${TRANSFER_FLAG} not added. ${stop ?? `Bókun didn't answer after ${task.attempts} tries (${message}).`}`, TRANSFER_FLAG);
      return finish(task, "FAILED", stop ?? message);
    }
    return retryLater(task, message, now);
  }
}

async function runCancelTransfer(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const leg = taskLeg(task);
  if (!leg) return finish(task, "SKIPPED", "No transfer leg.");
  const create = await prisma.bookingSyncTask.findUnique({ where: { idempotencyKey: transferKey(task.bookingId, TRANSFER_CREATE, leg) } });
  if (!create) return finish(task, "SKIPPED", "The transfer was never sent to Bókun.");
  try {
    if (create.status === "IN_PROGRESS") return retryLater(task, "Waiting for the transfer create to finish.", now);
    if (create.status === "FAILED") {
      await raiseFlag(task.bookingId, `${TRANSFER_FLAG} cancelled on the website. It never reached Bókun automatically; if it was added in Bókun by hand, cancel it there too.`, TRANSFER_FLAG);
      return finish(task, "SKIPPED", "Transfer create had stopped; staff flagged.");
    }
    const confirmed = create.status === "SUCCEEDED" && create.externalRef;
    if (confirmed) {
      await cancelInBokun(client, create.externalRef!, "Cancelled on vistachase.com");
      return finish(task, "SUCCEEDED", null, create.externalRef);
    }
    if (create.externalRef) await abortInBokun(client, create.externalRef);
    if (create.status === "PENDING" || create.status === "RETRYABLE_FAILURE") {
      await prisma.bookingSyncTask.update({ where: { id: create.id }, data: { status: "SKIPPED", lastError: "Booking cancelled before the transfer reached Bókun." } });
    }
    return finish(task, "SKIPPED", "Transfer never confirmed in Bókun; nothing to cancel.", create.externalRef ?? null);
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    if ((error instanceof BokunApiError && error.status < 500) || task.attempts >= RETRY_MINUTES.length) {
      await raiseFlag(task.bookingId, `${TRANSFER_FLAG} cancelled on the website but not in Bókun (${message}). Cancel ${create.externalRef ?? "the transfer"} in Bókun by hand.`, TRANSFER_FLAG);
      return finish(task, "FAILED", message);
    }
    return retryLater(task, message, now);
  }
}
