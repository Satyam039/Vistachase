// Bókun integration (docs/BOKUN.md): every confirmed website booking is also created in Bókun and
// cancellations follow, through the BookingSyncTask outbox; Bókun's seats are read into our
// departures. A stand-in answers as the Bókun API.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/db/prisma";
import { BokunApiError } from "@/modules/bokun/bokun.client";
import { buildPassengers, findSlot } from "@/modules/bokun/bokun-booking";
import { setBokunClientForTests, type BokunApi } from "@/modules/bokun/config";
import { processBokunSyncTasks, queueUpcomingBookings, retryBokunSync, setBokunAutoRunForTests } from "@/modules/bokun/bokun-sync";
import { syncBokunSeats } from "@/modules/bokun/availability-sync";
import { cancelBooking, createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const SHARED_SLUG = "banff-highlights-tour"; // Bókun 1142134
const PRIVATE_SLUG = "banff-private-tour"; // Bókun 1167962
const DAY = "2035-07-14";

interface Slot {
  date: number;
  startTime: string;
  startTimeId: number;
  availabilityCount: number;
  bookedParticipants?: number;
  soldOut?: boolean;
  defaultRateId: number;
  rates: { id: number }[];
}

let lastCode = 0; // Bókun's confirmation codes are unique across tests too

/** A stand-in for the Bókun API that records every call. */
class FakeBokun {
  calls: { method: string; path: string; body?: any }[] = [];
  slots: Record<string, Slot[]> = {};
  failAvailability: Error | null = null;
  failSubmit: Error | null = null;
  failCancel: Error | null = null;
  codes = 0;

  slot(productId: string, date: string, time: string, left: number, booked = 0) {
    (this.slots[productId] ??= []).push({ date: Date.parse(`${date}T00:00:00Z`), startTime: time, startTimeId: 4600000 + this.codes++, availabilityCount: left, bookedParticipants: booked, defaultRateId: 5, rates: [{ id: 5 }] });
  }

  api(): BokunApi {
    return {
      getAvailabilities: async (id: string, start: string, end: string) => {
        this.calls.push({ method: "GET", path: `/activity.json/${id}/availabilities?start=${start}&end=${end}` });
        if (this.failAvailability) throw this.failAvailability;
        return this.slots[id] ?? [];
      },
      fetch: async (method: string, path: string, body?: any) => {
        this.calls.push({ method, path, body });
        if (path.startsWith("/activity.json/")) return { pricingCategories: [{ id: 767927, title: "Adults" }, { id: 773211, title: "Child (1-13)" }] };
        if (path.startsWith("/checkout.json/options")) return { options: [{ type: "CUSTOMER_FULL_PAYMENT", paymentMethods: { allowedMethods: ["RESERVE_FOR_EXTERNAL_PAYMENT"] } }] };
        if (path.startsWith("/checkout.json/submit")) {
          if (this.failSubmit) throw this.failSubmit;
          return { booking: { confirmationCode: `VIS-${process.pid}-${++lastCode}` } };
        }
        if (path.startsWith("/booking.json/cancel-booking") && this.failCancel) throw this.failCancel;
        return null;
      },
    } as unknown as BokunApi;
  }

  made(prefix: string) {
    return this.calls.filter((c) => c.path.startsWith(prefix));
  }
}

let bokun: FakeBokun;
let sharedTourId = "";
let privateTourId = "";
let minute = 0;

async function departure(tourId: string, opts: { time?: string; capacity?: number } = {}) {
  const time = opts.time ?? `06:${String(minute++).padStart(2, "0")}`;
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(DAY), departureTime: timeOfDay(time), capacityTotal: opts.capacity ?? 12, price: 18900, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

/** A paid booking (the test payment provider pays instantly) for 2 adults and 1 child. */
async function book(dep: { id: string }) {
  const result = await createBooking({
    departureId: dep.id,
    customerName: "Ada Lovelace",
    customerEmail: "ada.bokun@example.com",
    customerPhone: "+1 403 555 0100",
    adultsCount: 2,
    childrenCount: 1,
    infantsCount: 0,
  });
  expect(result.success).toBe(true);
  return prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id } });
}

const tasksFor = (bookingId: string) => prisma.bookingSyncTask.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
const reload = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id } });
const run = (bookingId: string) => processBokunSyncTasks({ bookingId });

beforeAll(async () => {
  setBokunAutoRunForTests(false);
  sharedTourId = (await prisma.tour.findUniqueOrThrow({ where: { slug: SHARED_SLUG } })).id;
  privateTourId = (await prisma.tour.findUniqueOrThrow({ where: { slug: PRIVATE_SLUG } })).id;
});

beforeEach(() => {
  bokun = new FakeBokun();
  setBokunClientForTests(bokun.api());
});

afterAll(() => {
  setBokunClientForTests(null);
  setBokunAutoRunForTests(true);
});

describe("Bókun booking requests", () => {
  it("puts each guest in Bókun's categories and finds the slot by date and start time", () => {
    const { passengers } = buildPassengers({ category: "SHARED", adults: 2, children: 1, infants: 0 }, [
      { id: 1, title: "Adults" },
      { id: 2, title: "Child (1-13)" },
    ]);
    expect(passengers).toEqual([{ pricingCategoryId: 1 }, { pricingCategoryId: 1 }, { pricingCategoryId: 2 }]);
    const slot = findSlot([{ date: Date.parse("2035-07-14T00:00:00Z"), startTime: "08:30" }], "2035-07-14", "08:30");
    expect(slot?.startTime).toBe("08:30");
  });
});

describe("website bookings reach Bókun", () => {
  it("creates a confirmed booking in Bókun and saves Bókun's code; the website booking stays as it is", async () => {
    const dep = await departure(sharedTourId, { time: "08:30" });
    bokun.slot("1142134", DAY, "08:30", 10);
    const booking = await book(dep);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.externalSyncStatus).toBe("PENDING");
    expect((await tasksFor(booking.id)).map((t) => [t.operation, t.status])).toEqual([["CREATE", "PENDING"]]);

    await run(booking.id);
    const synced = await reload(booking.id);
    expect(synced.status).toBe("CONFIRMED");
    expect(synced.externalSyncStatus).toBe("SYNCED");
    expect(synced.bokunBookingId).toMatch(/^VIS-/);

    const submit = bokun.made("/checkout.json/submit")[0].body;
    expect(submit.paymentMethod).toBe("RESERVE_FOR_EXTERNAL_PAYMENT");
    expect(submit.directBooking.externalBookingReference).toBe(booking.bookingReference);
    expect(submit.directBooking.activityBookings[0].passengers).toHaveLength(3);
    const confirm = bokun.made("/checkout.json/confirm-reserved/")[0];
    expect(confirm.path).toContain(encodeURIComponent(synced.bokunBookingId!));
    expect(confirm.body.amount).toBe(booking.totalAmount / 100);

    // Running again sends nothing twice.
    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);
  });

  it("cancels in Bókun when the booking is cancelled on the website", async () => {
    const dep = await departure(sharedTourId);
    bokun.slot("1142134", DAY, `06:${String(minute - 1).padStart(2, "0")}`, 10);
    const booking = await book(dep);
    await run(booking.id);
    const code = (await reload(booking.id)).bokunBookingId!;

    const cancelled = await cancelBooking(booking.bookingReference, booking.customerEmail);
    expect(cancelled).toBeTruthy();
    expect((await reload(booking.id)).status).toMatch(/CANCELLED|REFUNDED/);
    await run(booking.id);
    expect(bokun.made("/booking.json/cancel-booking/").map((c) => c.path)).toEqual([`/booking.json/cancel-booking/${encodeURIComponent(code)}`]);
    expect((await tasksFor(booking.id)).map((t) => [t.operation, t.status])).toEqual([
      ["CREATE", "SUCCEEDED"],
      ["CANCEL", "SUCCEEDED"],
    ]);
  });

  it("sends nothing when the booking is cancelled before it reached Bókun", async () => {
    const dep = await departure(sharedTourId);
    const booking = await book(dep);
    await cancelBooking(booking.bookingReference, booking.customerEmail);
    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(0);
    expect(bokun.made("/booking.json/")).toHaveLength(0);
    expect((await tasksFor(booking.id)).map((t) => t.status)).toEqual(["SKIPPED", "SKIPPED"]);
  });

  it("flags staff when Bókun has no seats, and keeps the website booking confirmed", async () => {
    const dep = await departure(sharedTourId, { time: "09:15" });
    bokun.slot("1142134", DAY, "09:15", 1);
    const booking = await book(dep);
    await run(booking.id);
    const after = await reload(booking.id);
    expect(after.status).toBe("CONFIRMED");
    expect(after.externalSyncStatus).toBe("FAILED");
    expect((await tasksFor(booking.id))[0].status).toBe("FAILED");
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "OTHER" } });
    expect(flag.note).toMatch(/^Bókun: not added\. Bókun wouldn't take it/);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(0);
  });

  it("retries later when Bókun can't be reached before anything was created", async () => {
    const dep = await departure(sharedTourId, { time: "09:45" });
    bokun.slot("1142134", DAY, "09:45", 10);
    bokun.failAvailability = new Error("fetch failed");
    const booking = await book(dep);
    const now = new Date();
    await processBokunSyncTasks({ bookingId: booking.id, now });
    const [task] = await tasksFor(booking.id);
    expect(task.status).toBe("RETRYABLE_FAILURE");
    expect(task.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);

    bokun.failAvailability = null;
    await processBokunSyncTasks({ bookingId: booking.id, now: new Date(now.getTime() + 61_000) });
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
  });

  it("never re-sends a create that got no answer; staff check Bókun and press Retry", async () => {
    const dep = await departure(sharedTourId, { time: "10:15" });
    bokun.slot("1142134", DAY, "10:15", 10);
    bokun.failSubmit = new Error("The operation was aborted due to timeout");
    const booking = await book(dep);
    await run(booking.id);
    expect((await tasksFor(booking.id))[0].status).toBe("FAILED");
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "OTHER" } });
    expect(flag.note).toContain(`may already be there. Look for ${booking.bookingReference} in Bókun`);

    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);

    bokun.failSubmit = null;
    expect((await retryBokunSync(booking.id)).status).toBe(200);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(2);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
  });

  it("flags a refused cancellation for staff to cancel in Bókun by hand", async () => {
    const dep = await departure(sharedTourId, { time: "10:45" });
    bokun.slot("1142134", DAY, "10:45", 10);
    const booking = await book(dep);
    await run(booking.id);
    bokun.failCancel = new BokunApiError(400, "Bókun API Error: 400 Booking is already cancelled");
    await cancelBooking(booking.bookingReference, booking.customerEmail);
    await run(booking.id);
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "OTHER" } });
    expect(flag.note).toMatch(/cancelled on the website but not in Bókun/);
  });

  it("queues upcoming bookings made before Bókun was connected", async () => {
    const dep = await departure(sharedTourId, { time: "11:15" });
    bokun.slot("1142134", DAY, "11:15", 10);
    setBokunClientForTests(null); // not connected yet: nothing queued
    const booking = await book(dep);
    expect(await tasksFor(booking.id)).toHaveLength(0);

    setBokunClientForTests(bokun.api());
    const queued = await queueUpcomingBookings();
    expect(queued.status).toBe(200);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
  });
});

describe("Bókun seats in our calendar", () => {
  it("shared tours: seats sold on other channels come off our seats; our bookings not yet in Bókun still count", async () => {
    const dep = await departure(sharedTourId, { time: "13:00", capacity: 12 });
    const booking = await book(dep); // 3 seats, not in Bókun yet (queue not run)
    bokun.slot("1142134", DAY, "13:00", 4, 8); // Bókun: 12 seats, 8 sold elsewhere, 4 left
    const result = await syncBokunSeats({ from: DAY, days: 1 });
    expect(result).toMatchObject({ errors: [] });
    const after = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } });
    expect(after.capacityTotal).toBe(12);
    expect(after.capacityBooked).toBe(8 + booking.totalSeats);
    expect(after.price).toBe(18900); // prices stay ours
    expect(after.status).toBe("ACTIVE");
  });

  it("private tours: sold out here when Bókun has no vehicle left, unless we already booked it", async () => {
    const free = await departure(privateTourId, { time: "07:00", capacity: 6 });
    bokun.slot("1167962", DAY, "07:00", 0, 1);
    await syncBokunSeats({ from: DAY, days: 1 });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: free.id } })).capacityBooked).toBe(6);

    bokun.slots["1167962"] = [];
    bokun.slot("1167962", DAY, "07:00", 1, 0);
    await syncBokunSeats({ from: DAY, days: 1 });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: free.id } })).capacityBooked).toBe(0);
  });

  it("lists our departures Bókun doesn't offer and logs the run", async () => {
    const dep = await departure(sharedTourId, { time: "15:55" });
    const result = await syncBokunSeats({ from: DAY, days: 1 });
    expect("notInBokun" in result && result.notInBokun).toContain(`${SHARED_SLUG} ${DAY} 15:55`);
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).capacityTotal).toBe(12);
    expect(await prisma.bokunSyncLog.findFirst({ where: { syncType: "POLL" }, orderBy: { createdAt: "desc" } })).not.toBeNull();
  });
});
