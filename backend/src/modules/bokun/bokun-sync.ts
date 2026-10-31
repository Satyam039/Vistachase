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
import { BokunApiError } from "@/modules/bokun/bokun.client";
import { abortInBokun, BokunUnavailableError, cancelInBokun, confirmInBokun, reserveInBokun } from "@/modules/bokun/bokun-booking";
import { bokunClient, bokunConnected, type BokunApi } from "@/modules/bokun/config";
import { formatDateOnly, formatTimeOfDay, todayInMountainTime, dateOnly } from "@/lib/utils/time";
import { PRODUCT_MAP } from "@/modules/tours/product-map";

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
export function bokunProductId(tour: { slug: string; bokunId: string | null } | null | undefined) {
  if (!tour) return null;
  const mapped = PRODUCT_MAP.find((p) => p.slug === tour.slug);
  if (mapped) return mapped.bookingMode === "BOKUN" ? mapped.bokunId : null;
  return tour.bokunId;
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
    select: { bokunBookingId: true, tourDeparture: { select: { tour: { select: { slug: true, bokunId: true } } } } },
  });
  if (!booking) return;

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
    const outcome = task.operation === "CREATE" ? await runCreate(client, claimedTask, now) : await runCancel(client, claimedTask, now);
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
    if (!code) {
      if (stage === "submitting") {
        throw new StopError(`An earlier attempt got no answer from Bókun while creating it, so it may already be there. Look for ${booking.bookingReference} in Bókun before adding it by hand.`);
      }
      const dep = booking.tourDeparture;
      const place = booking.pickupStop?.name ?? booking.pickupCustomText ?? "";
      code = await reserveInBokun(
        client,
        {
          bookingReference: booking.bookingReference,
          productBokunId: productId,
          category: tour.category,
          date: formatDateOnly(dep.date),
          time: formatTimeOfDay(dep.departureTime),
          adults: booking.adultsCount,
          children: booking.childrenCount,
          infants: booking.infantsCount,
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          pickup: [place, booking.pickupTime ? `at ${booking.pickupTime}` : ""].filter(Boolean).join(" ") || undefined,
          specialRequests: booking.specialRequests ?? undefined,
        },
        async () => {
          submitting = true;
          await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { payload: { stage: "submitting" } } });
        },
      );
      submitting = false;
      await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { externalRef: code, payload: { stage: "reserved" } } });
    }

    const paid = booking.payments.filter((p) => p.status === "SUCCEEDED");
    const paidCents = paid.reduce((sum, p) => sum + p.amount, 0);
    await confirmInBokun(client, code, booking.bookingReference, {
      amount: paidCents / 100,
      currency: booking.currency,
      transactionId: paid.find((p) => p.transactionId)?.transactionId ?? undefined,
    });
    await prisma.booking.update({ where: { id: booking.id }, data: { bokunBookingId: code, externalSyncStatus: "SYNCED", lastSyncAttemptAt: now } });
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
        stop = `No answer from Bókun while creating it (${message}), so it may already be there. Look for ${booking.bookingReference} in Bókun before adding it by hand.`;
      }
    } else if (error instanceof BokunApiError && error.status < 500) {
      stop = code
        ? `Reserved in Bókun as ${code}, but Bókun refused the confirmation: ${message} Confirm it in Bókun by hand.`
        : `Bókun refused it: ${message} Add it in Bókun by hand, or fix the product in Bókun and press Retry.`;
    }
    if (stop || task.attempts >= RETRY_MINUTES.length) {
      await failBooking(booking.id, stop ?? `Bókun didn't answer after ${task.attempts} tries (${message}). Press Retry in Admin → Bookings → Bókun, or add it in Bókun by hand.`);
      return finish(task, "FAILED", stop ?? message);
    }
    return retryLater(task, message, now);
  }
}

async function runCancel(client: BokunApi, task: BookingSyncTask, now: Date): Promise<Outcome> {
  const booking = await prisma.booking.findUnique({ where: { id: task.bookingId }, select: { id: true, bookingReference: true, bokunBookingId: true } });
  if (!booking) return finish(task, "SKIPPED", "Booking not found.");
  const create = await prisma.bookingSyncTask.findUnique({ where: { idempotencyKey: taskKey(booking.id, "CREATE") } });
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

/** One open Bókun flag per booking (Admin → Bookings → Flags). */
async function raiseFlag(bookingId: string, note: string) {
  const open = await prisma.bookingFlag.findFirst({ where: { bookingId, status: "OPEN", type: "OTHER", note: { startsWith: FLAG_PREFIX } } });
  if (open) {
    await prisma.bookingFlag.update({ where: { id: open.id }, data: { note: note.slice(0, 1000) } });
    return;
  }
  console.warn(`[bokun] booking ${bookingId} flagged: ${note}`);
  await prisma.bookingFlag.create({ data: { bookingId, type: "OTHER", note: note.slice(0, 1000) } });
}

/** Tasks left IN_PROGRESS by a run that died. A create that was mid-submit can't be retried blindly. */
async function recoverStaleTasks(now: Date, scope: { bookingId?: string }) {
  const stale = await prisma.bookingSyncTask.findMany({
    where: { ...scope, provider: PROVIDER, status: "IN_PROGRESS", lastAttemptAt: { lt: new Date(now.getTime() - STALE_MS) } },
  });
  for (const task of stale) {
    const midSubmit = task.operation === "CREATE" && !task.externalRef && (task.payload as { stage?: string } | null)?.stage === "submitting";
    if (midSubmit) {
      const booking = await prisma.booking.findUnique({ where: { id: task.bookingId }, select: { bookingReference: true } });
      await failBooking(task.bookingId, `The server stopped while creating it in Bókun, so it may already be there. Look for ${booking?.bookingReference ?? "the booking"} in Bókun before adding it by hand.`);
      await prisma.bookingSyncTask.update({ where: { id: task.id }, data: { status: "FAILED", lastError: "Interrupted while creating in Bókun." } });
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
  await prisma.booking.update({ where: { id: bookingId }, data: { externalSyncStatus: "PENDING" } });
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
