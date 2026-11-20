// Bókun integration (docs/BOKUN.md): every confirmed website booking is also created in Bókun and
// cancellations follow, through the BookingSyncTask outbox; Bókun's seats are read into our
// departures. A stand-in answers as the Bókun API.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/db/prisma";
import { BokunApiError } from "@/modules/bokun/bokun.client";
import { answerErrors, answerQuestions, BOKUN_NOTE_MAX, buildNoteUpdate, buildPassengers, findSlot, repairAnswers, seasonRateId } from "@/modules/bokun/bokun-booking";
import { setBokunClientForTests, type BokunApi } from "@/modules/bokun/config";
import { processBokunSyncTasks, queueBokunNoteUpdate, queueUpcomingBookings, retryBokunSync, setBokunAutoRunForTests } from "@/modules/bokun/bokun-sync";
import { syncBokunSeats } from "@/modules/bokun/availability-sync";
import { CALENDAR_DAYS, syncFarCalendarFromBokun } from "@/jobs/tasks";
import { cancelBooking, createBooking } from "@/modules/bookings/booking.repository";
import { airportTransferBokun } from "@/modules/bookings/airport-transfer";
import { createReservationHold } from "@/modules/reservations/reservation.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const SHARED_SLUG = "banff-highlights-tour"; // Bókun 796650
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
  failConfirm: Error[] = [];
  failCancel: Error | null = null;
  questions: unknown = undefined;
  codes = 0;
  /** What Bókun's booking search shows (by our reference). */
  inBokun: { externalBookingReference: string; confirmationCode: string; status: string }[] = [];
  /** Booking notes (REST v2 experience booking notes). */
  noteIds = 900;
  failNote: Error | null = null;
  noteGone = false;
  /** Each failSubmit error, once (then failSubmit applies). */
  failSubmits: Error[] = [];

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
        if (path.startsWith("/checkout.json/options")) return { options: [{ type: "CUSTOMER_FULL_PAYMENT", paymentMethods: { allowedMethods: ["RESERVE_FOR_EXTERNAL_PAYMENT"] } }], questions: this.questions };
        if (path.startsWith("/booking.json/booking-search")) return { totalHits: this.inBokun.length, results: this.inBokun };
        if (path.startsWith("/checkout.json/submit")) {
          if (this.failSubmits.length) throw this.failSubmits.shift();
          if (this.failSubmit) throw this.failSubmit;
          return { booking: { confirmationCode: `VIS-${process.pid}-${++lastCode}` } };
        }
        if (path.startsWith("/checkout.json/confirm-reserved/") && this.failConfirm.length) throw this.failConfirm.shift();
        if (path.startsWith("/booking.json/cancel-booking") && this.failCancel) throw this.failCancel;
        if (path.includes("/notes")) {
          if (this.failNote) throw this.failNote;
          if (method === "POST") return { id: ++this.noteIds, owner_id: 1, type: "GENERAL", text: body.text };
          if (method === "PUT" && this.noteGone) throw new BokunApiError(404, "Bókun API Error: 404 Not Found - note not found");
          return { id: Number(path.split("/").pop()), owner_id: 1, type: "GENERAL", text: body.text };
        }
        if (method === "GET" && path.startsWith("/booking.json/booking/")) return { confirmationCode: decodeURIComponent(path.split("/").pop()!), activityBookings: [{ id: 153720548 }] };
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

describe("Bókun refused answers", () => {
  const input = {
    bookingReference: "VC-2026-REPAIR01", productBokunId: "1167962", category: "SHARED", date: "2026-11-25", time: "08:00",
    adults: 2, children: 0, infants: 0, customerName: "Mei Tan", customerEmail: "m@example.com", customerPhone: "+65 9123 4567", country: "SG",
  };
  const refusal = (errors: unknown[]) =>
    new BokunApiError(400, `Bókun API Error: 400 Bad Request - ${JSON.stringify({ message: "Error occurred: is.bokun.dtos.questions.validation.InvalidAnswersException - Invalid or missing answers for the booking", fields: { errors } })}`);
  const request = () => {
    const answers = [{ questionId: "1527999", values: ["Fairmont"] }, { questionId: "77", values: ["13:00 flight"] }];
    return {
      mainContactDetails: [
        { questionId: "firstName", values: ["Mei"] },
        { questionId: "email", values: ["m@example.com"] },
        { questionId: "phoneNumber", values: ["+6591234567"] },
        { questionId: "nationality", values: ["SG"] },
      ],
      activityBookings: [{ answers, questions: answers, passengers: [{ pricingCategoryId: 1 }, { pricingCategoryId: 1 }] }],
    } as Record<string, any>;
  };

  it("reads Bókun's list of refused answers", () => {
    expect(answerErrors(refusal([{ reason: "INVALID", path: "/mainContactDetails/4", questionId: "phoneNumber" }]))).toEqual([{ reason: "INVALID", path: "/mainContactDetails/4", questionId: "phoneNumber" }]);
    expect(answerErrors(new BokunApiError(400, "Bókun API Error: 400 - logic.InvalidDataException - Payment amount must be positive"))).toBeNull();
    expect(answerErrors(new Error("fetch failed"))).toBeNull();
  });

  it("takes out an invalid answer (phone, nationality or a product question) and keeps name and email", () => {
    const b = request();
    expect(repairAnswers(b, [{ reason: "INVALID", path: "/mainContactDetails/9", questionId: "nationality" }, { reason: "INVALID", questionId: "77" }], input)).toBe(true);
    expect(b.mainContactDetails.map((d: any) => d.questionId)).toEqual(["firstName", "email", "phoneNumber"]);
    expect(b.activityBookings[0].answers.map((d: any) => d.questionId)).toEqual(["1527999"]);
    expect(b.activityBookings[0].questions).toBe(b.activityBookings[0].answers);
    expect(repairAnswers(request(), [{ reason: "INVALID", questionId: "email" }], input)).toBe(false);
  });

  it("answers a missing question on the booking or on the passenger Bókun names", () => {
    const b = request();
    b.mainContactDetails = b.mainContactDetails.filter((d: any) => d.questionId !== "phoneNumber");
    expect(
      repairAnswers(
        b,
        [
          { reason: "MISSING", path: "/activityBookings/0/passengers/1", questionId: "501" },
          { reason: "MISSING", path: "/activityBookings/0", questionId: "88" },
          { reason: "MISSING", path: "/mainContactDetails", questionId: "phoneNumber" },
        ],
        input,
      ),
    ).toBe(true);
    expect(b.activityBookings[0].passengers[1].answers).toEqual([{ questionId: "501", values: ["See booking note (vistachase.com VC-2026-REPAIR01)"] }]);
    expect(b.activityBookings[0].passengers[0].answers).toBeUndefined();
    expect(b.activityBookings[0].answers.at(-1)).toEqual({ questionId: "88", values: ["See booking note (vistachase.com VC-2026-REPAIR01)"] });
    // Bókun requires a phone: the office number goes in (the guest's is in the note).
    expect(b.mainContactDetails.at(-1)).toEqual({ questionId: "phoneNumber", values: ["+18257349456"] });
  });

  it("gets a booking into Bókun after several refusals in a row", async () => {
    const dep = await departure(sharedTourId, { time: "12:35" });
    bokun.slot("796650", DAY, "12:35", 10);
    bokun.failSubmits = [
      refusal([{ reason: "INVALID", path: "/mainContactDetails/3", questionId: "phoneNumber" }]),
      refusal([{ reason: "MISSING", path: "/activityBookings/0", questionId: "4242" }]),
    ];
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    const submits = bokun.made("/checkout.json/submit");
    expect(submits).toHaveLength(3);
    const last = submits[2].body.directBooking;
    expect(last.mainContactDetails.find((d: any) => d.questionId === "phoneNumber").values).toEqual(["+18257349456"]);
    expect(last.activityBookings[0].answers).toContainEqual({ questionId: "4242", values: [`See booking note (vistachase.com ${booking.bookingReference})`] });
  });

  it("gets past Bókun requiring a phone the guest's number can't fill (VC-2026-9F41CB14)", async () => {
    const dep = await departure(sharedTourId, { time: "12:40" });
    bokun.slot("796650", DAY, "12:40", 10);
    bokun.failSubmits = [refusal([{ reason: "INVALID", path: "/mainContactDetails/4", questionId: "phoneNumber" }])];
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    const last = bokun.made("/checkout.json/submit").at(-1)!.body.directBooking;
    expect(last.mainContactDetails.find((d: any) => d.questionId === "phoneNumber").values).toEqual(["+18257349456"]);
    expect(last.activityBookings[0].note).toContain("Guest phone: +1 403 555 0100");
  });

  it("stops for staff when the refusal can't be fixed (a bad email)", async () => {
    const dep = await departure(sharedTourId, { time: "12:45" });
    bokun.slot("796650", DAY, "12:45", 10);
    bokun.failSubmit = refusal([{ reason: "INVALID", path: "/mainContactDetails/2", questionId: "email" }]);
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("FAILED");
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);
  });
});

describe("Bókun booking requests", () => {
  it("answers the product's booking questions from the booking", () => {
    const input = {
      bookingReference: "VC-2026-EBB006F4", productBokunId: "1167962", category: "PRIVATE", date: "2026-11-25", time: "07:00",
      adults: 4, children: 1, infants: 0, customerName: "Ryan Lim", customerEmail: "r@example.com", customerPhone: "+1 213 278 8225",
      pickup: "Elk + Avenue Hotel", specialRequests: "Booster seat for an 8yo",
    };
    expect(
      answerQuestions(
        [
          { questionId: 1527999, label: "Pickup location / hotel", required: true, dataType: "SHORT_TEXT" },
          { questionId: 2, label: "Dietary requirements", required: false },
          { questionId: 3, label: "Tour language", required: true, answerOptions: [{ label: "English", value: "EN" }, { label: "French", value: "FR" }] },
          { questionId: 4, label: "I accept the terms", required: true, dataType: "CHECKBOX_TOGGLE" },
          { questionId: 5, label: "Favourite colour", required: true },
          { questionId: 6, label: "Optional thing", required: false },
        ],
        input,
      ),
    ).toEqual([
      { questionId: "1527999", values: ["Elk + Avenue Hotel"] },
      { questionId: "2", values: ["Booster seat for an 8yo"] },
      { questionId: "3", values: ["EN"] },
      { questionId: "4", values: ["true"] },
      { questionId: "5", values: ["See booking note (vistachase.com VC-2026-EBB006F4)"] },
    ]);
  });

  it("books the season's Bókun rate: summer June 1 to October 10, winter otherwise", () => {
    const rates = { summer: 2319946, winter: 2319969 };
    const slot = { rates: [{ id: 2319946 }, { id: 2319969 }] };
    expect(seasonRateId(rates, "2026-11-25", slot)).toBe(2319969);
    expect(seasonRateId(rates, "2027-06-01", slot)).toBe(2319946);
    expect(seasonRateId(rates, "2027-10-10", slot)).toBe(2319946);
    expect(seasonRateId(rates, "2027-10-11", slot)).toBe(2319969);
    expect(seasonRateId(rates, "2027-07-01", { rates: [] })).toBe(2319946); // slot doesn't list its rates
    expect(seasonRateId(rates, "2027-07-01", { rates: [{ id: 5 }] })).toBeUndefined(); // not offered: Bókun's default
    expect(seasonRateId(undefined, "2027-07-01", slot)).toBeUndefined();
  });

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
    bokun.slot("796650", DAY, "08:30", 10);
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
    // Every passenger is named (Bókun can require it): the lead, then "Guest 2", "Guest 3".
    expect(submit.directBooking.activityBookings[0].passengers.map((p: any) => p.passengerDetails.map((d: any) => d.values[0]).join(" "))).toEqual([
      "Ada Lovelace",
      "Guest 2 Lovelace",
      "Guest 3 Lovelace",
    ]);
    // +1 is shared by several countries, so no nationality is guessed.
    expect(submit.directBooking.mainContactDetails.map((q: any) => q.questionId)).not.toContain("nationality");
    const confirm = bokun.made("/checkout.json/confirm-reserved/")[0];
    expect(confirm.path).toContain(encodeURIComponent(synced.bokunBookingId!));
    expect(confirm.body.amount).toBe(booking.totalAmount / 100);

    expect(submit.directBooking.activityBookings[0].answers).toBeUndefined();
    // Running again sends nothing twice.
    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);
  });

  it("sends answers to the product's required booking questions", async () => {
    const dep = await departure(sharedTourId, { time: "08:45" });
    bokun.slot("796650", DAY, "08:45", 10);
    bokun.questions = { activityBookings: [{ questions: [{ questionId: 1527999, label: "Where should we pick you up?", required: true }], passengers: [] }] };
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    const sent = bokun.made("/checkout.json/submit")[0].body.directBooking.activityBookings[0];
    expect(sent.answers).toEqual([{ questionId: "1527999", values: [expect.any(String)] }]);
  });

  it("cancels in Bókun when the booking is cancelled on the website", async () => {
    const dep = await departure(sharedTourId);
    bokun.slot("796650", DAY, `06:${String(minute - 1).padStart(2, "0")}`, 10);
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
    bokun.slot("796650", DAY, `06:${String(minute - 1).padStart(2, "0")}`, 10);
    const booking = await book(dep);
    await cancelBooking(booking.bookingReference, booking.customerEmail);
    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(0);
    expect(bokun.made("/booking.json/")).toHaveLength(0);
    expect((await tasksFor(booking.id)).map((t) => t.status)).toEqual(["SKIPPED", "SKIPPED"]);
  });

  it("flags staff when Bókun has no seats, and keeps the website booking confirmed", async () => {
    const dep = await departure(sharedTourId, { time: "09:15" });
    bokun.slot("796650", DAY, "09:15", 3);
    const booking = await book(dep);
    bokun.slots["796650"][0].availabilityCount = 1; // sold on another channel before it was sent
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
    bokun.slot("796650", DAY, "09:45", 10);
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

  it("never re-sends a create that got no answer; looks in Bókun, then staff check and press Retry", async () => {
    const dep = await departure(sharedTourId, { time: "10:15" });
    bokun.slot("796650", DAY, "10:15", 10);
    bokun.failSubmit = new Error("The operation was aborted due to timeout");
    const booking = await book(dep);
    const now = new Date();
    await processBokunSyncTasks({ bookingId: booking.id, now });
    expect((await tasksFor(booking.id))[0].status).toBe("RETRYABLE_FAILURE");

    // Next try: Bókun's booking search doesn't show it, so it stops for staff instead of sending again.
    await processBokunSyncTasks({ bookingId: booking.id, now: new Date(now.getTime() + 61_000) });
    expect((await tasksFor(booking.id))[0].status).toBe("FAILED");
    expect(bokun.made("/booking.json/booking-search")).toHaveLength(1);
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "OTHER" } });
    expect(flag.note).toContain(`may still be there. Look for ${booking.bookingReference} in Bókun`);

    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);

    bokun.failSubmit = null;
    expect((await retryBokunSync(booking.id)).status).toBe(200);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(2);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    expect((await prisma.bookingFlag.findUniqueOrThrow({ where: { id: flag.id } })).status).toBe("RESOLVED");
  });

  it("finds a create that got no answer in Bókun and confirms that one, without sending it again", async () => {
    const dep = await departure(sharedTourId, { time: "10:25" });
    bokun.slot("796650", DAY, "10:25", 10);
    bokun.failSubmits = [new Error("socket hang up")];
    const booking = await book(dep);
    const now = new Date();
    await processBokunSyncTasks({ bookingId: booking.id, now });
    // Bókun did create it before the answer was lost.
    bokun.inBokun = [
      { externalBookingReference: `${booking.bookingReference}-other`, confirmationCode: "VIS-WRONG", status: "RESERVED" },
      { externalBookingReference: booking.bookingReference, confirmationCode: "VIS-LOST-1", status: "RESERVED" },
    ];
    await processBokunSyncTasks({ bookingId: booking.id, now: new Date(now.getTime() + 61_000) });
    const after = await reload(booking.id);
    expect(after.externalSyncStatus).toBe("SYNCED");
    expect(after.bokunBookingId).toBe("VIS-LOST-1");
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);
    expect(bokun.made("/checkout.json/confirm-reserved/")[0].path).toContain("VIS-LOST-1");
  });

  it("keeps trying while Bókun is down, flags staff once, and clears the flag when it goes in", async () => {
    const dep = await departure(sharedTourId, { time: "10:35" });
    bokun.slot("796650", DAY, "10:35", 10);
    bokun.failAvailability = new Error("fetch failed");
    const booking = await book(dep);
    let now = Date.now();
    for (let i = 0; i < 8; i++) {
      await processBokunSyncTasks({ bookingId: booking.id, now: new Date(now) });
      now += 7 * 3_600_000;
    }
    const [task] = await tasksFor(booking.id);
    expect(task.status).toBe("RETRYABLE_FAILURE");
    expect(task.attempts).toBe(8);
    const flags = await prisma.bookingFlag.findMany({ where: { bookingId: booking.id, type: "OTHER", status: "OPEN" } });
    expect(flags).toHaveLength(1);
    expect(flags[0].note).toContain("keeps trying");

    bokun.failAvailability = null;
    await processBokunSyncTasks({ bookingId: booking.id, now: new Date(now) });
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    expect(await prisma.bookingFlag.count({ where: { bookingId: booking.id, status: "OPEN" } })).toBe(0);
  });

  it("reserves again when Bókun let the reservation lapse before it was confirmed, then confirms the new one", async () => {
    const dep = await departure(sharedTourId, { time: "11:45" });
    bokun.slot("796650", DAY, "11:45", 10);
    const lapsed = () => new BokunApiError(400, 'Bókun API Error: 400 Bad Request - {"message":"Error occurred: logic.InvalidDataException - Confirming a booking which is not in reserved state [VistaChase-1]: TIMEOUT"}');
    bokun.failConfirm = [lapsed()];
    const booking = await book(dep);
    await run(booking.id);
    const after = await reload(booking.id);
    expect(after.externalSyncStatus).toBe("SYNCED");
    expect(bokun.made("/checkout.json/submit")).toHaveLength(2);
    const confirms = bokun.made("/checkout.json/confirm-reserved/").map((c) => c.path);
    expect(confirms).toHaveLength(2);
    expect(confirms[1]).toContain(encodeURIComponent(after.bokunBookingId!));
    expect(confirms[0]).not.toBe(confirms[1]);
  });

  it("reserves again when Bókun has no booking under the reserved code (VC-2026-DCC9AB6D, WEB-276670)", async () => {
    const dep = await departure(sharedTourId, { time: "11:55" });
    bokun.slot("796650", DAY, "11:55", 10);
    bokun.failConfirm = [new BokunApiError(400, 'Bókun API Error: 400 Bad Request - {"message":"Error occurred: logic.InvalidDataException - CheckoutService: No such booking found [WEB-276670]","fields":{}}')];
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    expect(bokun.made("/booking.json/booking-search")).toHaveLength(1);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(2);
  });

  it("confirms the booking Bókun holds under another code instead of reserving again", async () => {
    const dep = await departure(sharedTourId, { time: "11:58" });
    bokun.slot("796650", DAY, "11:58", 10);
    bokun.failConfirm = [new BokunApiError(400, "Bókun API Error: 400 - CheckoutService: No such booking found [WEB-1]")];
    const booking = await book(dep);
    bokun.inBokun = [{ externalBookingReference: booking.bookingReference, confirmationCode: "VIS-REAL-7", status: "RESERVED" }];
    await run(booking.id);
    const after = await reload(booking.id);
    expect(after.bokunBookingId).toBe("VIS-REAL-7");
    expect(bokun.made("/checkout.json/submit")).toHaveLength(1);
  });

  it("stops instead of reserving a third time when the new reservation also can't be confirmed", async () => {
    const dep = await departure(sharedTourId, { time: "12:05" });
    bokun.slot("796650", DAY, "12:05", 10);
    const lapsed = () => new BokunApiError(400, "Bókun API Error: 400 - Confirming a booking which is not in reserved state [X]: TIMEOUT");
    bokun.failConfirm = [lapsed(), lapsed()];
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("FAILED");
    expect(bokun.made("/checkout.json/submit")).toHaveLength(2);
  });

  it("sends the phone in E.164, and the office number if Bókun still can't read it", async () => {
    const dep = await departure(sharedTourId, { time: "12:25" });
    bokun.slot("796650", DAY, "12:25", 10);
    bokun.failSubmit = new BokunApiError(400, 'Bókun API Error: 400 Bad Request - {"message":"Error occurred: is.bokun.dtos.questions.validation.InvalidAnswersException - Invalid or missing answers for the booking","fields":{"errors":[{"reason":"INVALID","path":"/mainContactDetails/4","questionId":"phoneNumber","message":"Not a valid phone number"}]}}');
    const booking = await book(dep);
    let first = true;
    const original = bokun.failSubmit;
    // Refuse only the first submit.
    const api = bokun.api();
    setBokunClientForTests({
      ...api,
      fetch: async (method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: any) => {
        if (path.startsWith("/checkout.json/submit") && first) {
          first = false;
          bokun.calls.push({ method, path, body: JSON.parse(JSON.stringify(body)) });
          throw original;
        }
        bokun.failSubmit = null;
        return api.fetch(method, path, body);
      },
    } as BokunApi);
    await run(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    const submits = bokun.made("/checkout.json/submit").map((c) => c.body.directBooking.mainContactDetails);
    expect(submits).toHaveLength(2);
    expect(submits[0].find((d: any) => d.questionId === "phoneNumber").values).toEqual(["+14035550100"]);
    expect(submits[1].find((d: any) => d.questionId === "phoneNumber").values).toEqual(["+18257349456"]);
    expect(bokun.made("/checkout.json/submit")[1].body.directBooking.activityBookings[0].note).toContain("Guest phone: +1 403 555 0100");
  });

  it("flags a refused cancellation for staff to cancel in Bókun by hand", async () => {
    const dep = await departure(sharedTourId, { time: "10:45" });
    bokun.slot("796650", DAY, "10:45", 10);
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
    bokun.slot("796650", DAY, "11:15", 10);
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

describe("never more seats than Bókun has", () => {
  const guest = { customerName: "Ada Lovelace", customerEmail: "ada.bokun@example.com", customerPhone: "+1 403 555 0100", infantsCount: 0 };

  it("refuses a booking for more guests than Bókun has left, though our own calendar has room", async () => {
    const dep = await departure(sharedTourId, { time: "12:15", capacity: 12 });
    bokun.slot("796650", DAY, "12:15", 5);
    const tooMany = await createBooking({ ...guest, departureId: dep.id, adultsCount: 6, childrenCount: 0 });
    expect(tooMany).toMatchObject({ success: false, error: "Only 5 seats left for this departure. Requested: 6" });
    const fits = await createBooking({ ...guest, departureId: dep.id, adultsCount: 5, childrenCount: 0 });
    expect(fits.success).toBe(true);
    // Bókun doesn't have that booking yet, so its 5 seats are already gone here.
    const after = await createBooking({ ...guest, departureId: dep.id, adultsCount: 1, childrenCount: 0 });
    expect(after).toMatchObject({ success: false, error: "This departure is sold out. Please choose another date or time." });
  });

  it("refuses a seat hold Bókun can't cover, and counts other guests' holds", async () => {
    const dep = await departure(sharedTourId, { time: "12:45" });
    bokun.slot("796650", DAY, "12:45", 4);
    const first = await createReservationHold({ departureId: dep.id, seatsCount: 3, customerName: "A", customerEmail: "a@example.com" });
    expect(first.success).toBe(true);
    const second = await createReservationHold({ departureId: dep.id, seatsCount: 2, customerName: "B", customerEmail: "b@example.com" });
    expect(second).toMatchObject({ success: false, error: "Only 1 seat left for this departure. Requested: 2" });
    // The first guest's own hold isn't counted against them.
    const booked = await createBooking({ ...guest, departureId: dep.id, adultsCount: 3, childrenCount: 0, holdToken: first.holdToken });
    expect(booked.success).toBe(true);
  });

  it("refuses a departure Bókun doesn't offer that day, and a private vehicle Bókun has sold", async () => {
    const shared = await departure(sharedTourId, { time: "13:15" });
    bokun.slot("796650", "2035-07-15", "13:15", 10); // the next day only
    expect(await createBooking({ ...guest, departureId: shared.id, adultsCount: 1, childrenCount: 0 })).toMatchObject({
      success: false,
      error: "This departure is no longer available. Please choose another date or time.",
    });
    const priv = await departure(privateTourId, { time: "13:15", capacity: 1 });
    bokun.slot("1167962", DAY, "13:15", 0);
    expect(await createBooking({ ...guest, departureId: priv.id, adultsCount: 2, childrenCount: 0 })).toMatchObject({
      success: false,
      error: "This private vehicle is already booked for this departure.",
    });
  });

  it("goes on with our own seats when Bókun can't be reached", async () => {
    const dep = await departure(sharedTourId, { time: "13:45" });
    bokun.failAvailability = new Error("fetch failed");
    expect((await createBooking({ ...guest, departureId: dep.id, adultsCount: 2, childrenCount: 0 })).success).toBe(true);
  });

  it("sends the booking to Bókun on its own date and time, never another free day", async () => {
    const dep = await departure(sharedTourId, { time: "14:15" });
    bokun.slot("796650", DAY, "14:15", 5);
    const booking = await book(dep);
    bokun.slots["796650"] = [];
    bokun.slot("796650", "2035-07-15", "14:15", 15); // a free day next to it
    await run(booking.id);
    expect(bokun.made("/checkout.json/submit")).toHaveLength(0);
    expect((await reload(booking.id)).externalSyncStatus).toBe("FAILED");
  });
});

describe("Bókun seats in our calendar", () => {
  it("shared tours: seats sold on other channels come off our seats; our bookings not yet in Bókun still count", async () => {
    const dep = await departure(sharedTourId, { time: "13:00", capacity: 12 });
    setBokunClientForTests(null); // booked before Bókun had this start
    const booking = await book(dep); // 3 seats, not in Bókun yet
    setBokunClientForTests(bokun.api());
    bokun.slot("796650", DAY, "13:00", 4, 8); // Bókun: 12 seats, 8 sold elsewhere, 4 left
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

  it("takes our departures Bókun doesn't offer off sale, lists them and logs the run", async () => {
    const dep = await departure(sharedTourId, { time: "15:55" });
    const result = await syncBokunSeats({ from: DAY, days: 1 });
    expect("notInBokun" in result && result.notInBokun).toContain(`${SHARED_SLUG} ${DAY} 15:55`);
    const after = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } });
    expect(after.capacityTotal).toBe(12);
    expect(after.inventorySource).toBe("UNVERIFIED");
    expect(after.status).toBe("ACTIVE");
    expect(await prisma.bokunSyncLog.findFirst({ where: { syncType: "POLL" }, orderBy: { createdAt: "desc" } })).not.toBeNull();
  });

  it("puts a departure back on sale once Bókun offers it", async () => {
    const dep = await departure(sharedTourId, { time: "15:56" });
    await syncBokunSeats({ from: DAY, days: 1 });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).inventorySource).toBe("UNVERIFIED");
    bokun.slot("796650", DAY, "15:56", 12, 0);
    const result = await syncBokunSeats({ from: DAY, days: 1 });
    expect(result).toMatchObject({ onSale: 1 });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).inventorySource).toBe("LOCAL");
  });

  it("keeps everything on sale when Bókun can't be read", async () => {
    const dep = await departure(sharedTourId, { time: "15:57" });
    bokun.failAvailability = new Error("Bókun is down");
    await syncBokunSeats({ from: DAY, days: 1 });
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).inventorySource).toBe("LOCAL");
  });
});

describe("the calendar five years ahead follows Bókun (owner, 2026-11-06)", () => {
  it("reads Bókun a year at a time past the 15-minute window, out to five years", async () => {
    const now = new Date("2026-11-06T18:00:00Z");
    const result = await syncFarCalendarFromBokun(now);
    expect("runs" in result && result.runs!.map((r) => r.from)).toEqual(["2027-02-04", "2028-02-04", "2029-02-03", "2030-02-03", "2031-02-03"]);
    const ranges = bokun.made("/activity.json/796650/availabilities");
    expect(ranges[0].path).toContain("start=2027-02-04&end=2028-02-03");
    expect(ranges.at(-1)!.path).toContain("end=2031-11-05");
    expect("runs" in result && result.runs!.reduce((n, r) => n + r.days, 0)).toBe(CALENDAR_DAYS - 90 + 1);
  });
});

describe("the guest's country for Bókun", () => {
  it("comes from the phone field's country, or from a calling code only one country uses", async () => {
    const { countryFromPhone, knownCountry } = await import("@/lib/utils/phone-country");
    expect(knownCountry("in")).toBe("IN");
    expect(knownCountry("XX")).toBeNull();
    expect(countryFromPhone("+91 98765 43210")).toBe("IN");
    expect(countryFromPhone("+44 7700 900123")).toBe("GB");
    expect(countryFromPhone("+1 403 555 0100")).toBeNull();
    expect(countryFromPhone("403 555 0100")).toBeNull();
  });

  it("is sent as the main contact's nationality", async () => {
    const dep = await departure(sharedTourId, { time: "09:41" });
    bokun.slot("796650", DAY, "09:41", 10);
    const result = await createBooking({
      departureId: dep.id,
      customerName: "Ravi Kumar",
      customerEmail: "ravi.bokun@example.com",
      customerPhone: "+1 403 555 0101",
      customerCountry: "us",
      adultsCount: 1,
      childrenCount: 0,
      infantsCount: 0,
    });
    await run(result.booking!.id);
    const contact = bokun.made("/checkout.json/submit")[0].body.directBooking.mainContactDetails;
    expect(contact).toContainEqual({ questionId: "nationality", values: ["US"] });
  });
});

describe("Bókun products without a clock time", () => {
  it("match any of our departures that day", () => {
    const day = Date.parse(`${DAY}T00:00:00Z`);
    expect(findSlot([{ date: day, startTime: "00:00", startTimeId: 7 }], DAY, "08:00")?.startTimeId).toBe(7);
    expect(findSlot([{ date: day, startTimeId: 8 }], DAY, "08:00")?.startTimeId).toBe(8);
    expect(findSlot([{ date: day, startTime: "07:00", startTimeId: 9 }], DAY, "08:00")).toBeUndefined();
  });
});

describe("Bókun start time IDs (owner's doc, 2026-11-05)", () => {
  const day = Date.parse(`${DAY}T00:00:00Z`);
  it("match the start with the product's ID whatever its clock time", () => {
    // Columbia Icefield: summer and winter starts have their own IDs and times.
    expect(findSlot([{ date: day, startTime: "07:30", startTimeId: 4945518 }], DAY, "08:00", [4945517, 4945518])?.startTimeId).toBe(4945518);
    // A private tour's 8am start serves the 07:00 departure too.
    expect(findSlot([{ date: day, startTime: "08:00", startTimeId: 4787116 }], DAY, "07:00", [4787116])?.startTimeId).toBe(4787116);
  });
  it("pick by clock time when the day has several known starts, and ignore other starts", () => {
    const list = [
      { date: day, startTime: "03:15", startTimeId: 6012584 },
      { date: day, startTime: "04:15", startTimeId: 6012585 },
      { date: day, startTime: "05:00", startTimeId: 999 },
    ];
    const ids = [6012584, 6012585];
    expect(findSlot(list, DAY, "04:15", ids)?.startTimeId).toBe(6012585);
    expect(findSlot(list, DAY, "05:00", ids)).toBeUndefined();
  });
  it("fall back to the clock time when Bókun returns none of them (test account)", () => {
    expect(findSlot([{ date: day, startTime: "08:00", startTimeId: 1 }], DAY, "08:00", [4787116])?.startTimeId).toBe(1);
  });
});

describe("Airport transfers in Bókun (owner, 2026-11-18)", () => {
  it("each one-way transfer is its own Bókun booking on the area's product, at the group-size rate, and cancels with the booking", async () => {
    const dep = await departure(privateTourId, { time: "07:30", capacity: 13 });
    bokun.slot("1167962", DAY, "07:30", 1);
    // Banff transfer product: one start a day, rates "up to 6" (2712881) and "up to 12" (2712882).
    for (const date of ["2035-07-13", "2035-07-16"]) {
      (bokun.slots["1356054"] ??= []).push({ date: Date.parse(`${date}T00:00:00Z`), startTime: "00:00", startTimeId: 999, availabilityCount: 5, defaultRateId: 2712882, rates: [{ id: 2712881 }, { id: 2712882 }] });
    }
    const result = await createBooking({
      departureId: dep.id,
      customerName: "Ada Lovelace",
      customerEmail: "ada.transfer@example.com",
      customerPhone: "+1 403 555 0100",
      adultsCount: 4,
      childrenCount: 0,
      infantsCount: 0,
      airportTransfer: { type: "ROUND_TRIP", area: "BANFF", arrivalDate: "2035-07-13", arrivalTime: "14:30", departureDate: "2035-07-16", departureTime: "18:05", from: "Calgary Airport (YYC)", to: "Fairmont Banff Springs" },
    });
    expect(result.success).toBe(true);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id } });
    expect(booking.totalAmount).toBe(18900 + 2 * 36400);
    expect((await tasksFor(booking.id)).map((t) => t.operation).sort()).toEqual(["CREATE", "CREATE_TRANSFER", "CREATE_TRANSFER"]);

    await run(booking.id);
    const submits = bokun.made("/checkout.json/submit").map((c) => c.body.directBooking);
    expect(submits).toHaveLength(3);
    const transfers = submits.filter((b) => b.activityBookings[0].activityId === 1356054);
    expect(transfers.map((b) => [b.externalBookingReference, b.activityBookings[0].rateId, b.activityBookings[0].date])).toEqual(
      expect.arrayContaining([
        [`${booking.bookingReference}-ARR`, 2712881, "2035-07-13"],
        [`${booking.bookingReference}-DEP`, 2712881, "2035-07-16"],
      ]),
    );
    const dep2 = transfers.find((b) => b.externalBookingReference.endsWith("-DEP"))!;
    expect(dep2.activityBookings[0].note).toContain("Departure transfer: Fairmont Banff Springs to Calgary Airport (YYC), flight leaves 2035-07-16 18:05, 4 guests.");
    // The tour is confirmed with the tour's price, each transfer with its own.
    const amounts = bokun.made("/checkout.json/confirm-reserved/").map((c) => c.body.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([189, 364, 364]);
    expect((await tasksFor(booking.id)).every((t) => t.status === "SUCCEEDED")).toBe(true);

    await cancelBooking(booking.bookingReference, booking.customerEmail);
    await run(booking.id);
    expect(bokun.made("/booking.json/cancel-booking")).toHaveLength(3);
  });

  it("7 to 12 guests take the 'up to 12' rate; Lake Louise uses its own product", () => {
    expect(airportTransferBokun("LAKE_LOUISE", 9)).toEqual({ productId: "1356058", rateId: 2712890 });
    expect(airportTransferBokun("CANMORE", 6)).toEqual({ productId: "1356055", rateId: 2712883 });
    expect(airportTransferBokun("CANMORE", 7)).toEqual({ productId: "1356055", rateId: 2712886 });
  });
});

describe("staff edits to pickup, phone and requests reach the Bókun booking note (owner, 2026-11-20)", () => {
  const notes = () => bokun.calls.filter((c) => c.path.includes("/notes"));
  const inBokun = async () => {
    const dep = await departure(sharedTourId);
    bokun.slot("796650", DAY, formatTime(dep.departureTime), 10);
    const booking = await book(dep);
    await run(booking.id);
    expect((await reload(booking.id)).bokunBookingId).toBeTruthy();
    return booking;
  };
  const formatTime = (t: Date) => t.toISOString().slice(11, 16);

  it("builds a note of at most 255 characters with the pickup, phone and requests", () => {
    const text = buildNoteUpdate({ bookingReference: "VC-2026-10F1D9E4", pickup: "Calgary", customerPhone: "+91 9518031326", specialRequests: "Reservation for Banff gondola" });
    expect(text).toBe("Updated on vistachase.com (VC-2026-10F1D9E4).\nPickup: Calgary.\nGuest phone: +91 9518031326.\nGuest requests: Reservation for Banff gondola");
    const long = buildNoteUpdate({ bookingReference: "VC-2026-10F1D9E4", pickup: "Calgary", customerPhone: null, specialRequests: "x".repeat(600) });
    expect(long.length).toBe(BOKUN_NOTE_MAX);
    expect(long.endsWith("…")).toBe(true);
    expect(long).toContain("Guest phone: not given.");
  });

  it("adds a note to the Bókun booking after a pickup change, then updates that same note on the next change", async () => {
    const booking = await inBokun();
    const code = (await reload(booking.id)).bokunBookingId!;
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "Calgary", pickupTime: "07:30" } });
    await queueBokunNoteUpdate(booking.id);
    await run(booking.id);
    expect(bokun.calls.some((c) => c.method === "GET" && c.path === `/booking.json/booking/${code}`)).toBe(true);
    expect(notes()).toHaveLength(1);
    expect(notes()[0]).toMatchObject({ method: "POST", path: "/restapi/v2.0/experienceBooking/153720548/notes", body: { type: "GENERAL" } });
    expect(notes()[0].body.text).toContain("Pickup: Calgary at 07:30.");
    const task = (await tasksFor(booking.id)).find((t) => t.operation === "NOTE")!;
    expect(task.status).toBe("SUCCEEDED");
    expect(task.externalRef).toBe(`${code}|153720548|${bokun.noteIds}`);

    await prisma.booking.update({ where: { id: booking.id }, data: { specialRequests: "Child seat please" } });
    await queueBokunNoteUpdate(booking.id);
    await run(booking.id);
    expect(notes()).toHaveLength(2);
    expect(notes()[1]).toMatchObject({ method: "PUT", path: `/restapi/v2.0/experienceBooking/153720548/notes/${bokun.noteIds}` });
    expect(notes()[1].body.text).toContain("Guest requests: Child seat please");

    // Nothing new: nothing sent.
    await queueBokunNoteUpdate(booking.id);
    await run(booking.id);
    expect(notes()).toHaveLength(2);
    // The booking itself is untouched.
    const after = await reload(booking.id);
    expect(after.bokunBookingId).toBe(code);
    expect(after.externalSyncStatus).toBe("SYNCED");
  });

  it("adds a new note when staff deleted the old one in Bókun", async () => {
    const booking = await inBokun();
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "Fairmont Chateau Lake Louise" } });
    await queueBokunNoteUpdate(booking.id);
    await run(booking.id);
    bokun.noteGone = true;
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "Banff Springs" } });
    await queueBokunNoteUpdate(booking.id);
    await run(booking.id);
    expect(notes().map((c) => c.method)).toEqual(["POST", "PUT", "POST"]);
  });

  it("several quick edits send the latest details once", async () => {
    const booking = await inBokun();
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "A" } });
    await queueBokunNoteUpdate(booking.id);
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "B" } });
    await queueBokunNoteUpdate(booking.id);
    expect((await tasksFor(booking.id)).filter((t) => t.operation === "NOTE")).toHaveLength(1);
    await run(booking.id);
    expect(notes()).toHaveLength(1);
    expect(notes()[0].body.text).toContain("Pickup: B.");
  });

  it("queues nothing for a booking not sent to Bókun yet (the create carries the new details)", async () => {
    const dep = await departure(sharedTourId);
    bokun.slot("796650", DAY, formatTime(dep.departureTime), 10);
    const booking = await book(dep);
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "Calgary" } });
    await queueBokunNoteUpdate(booking.id);
    expect((await tasksFor(booking.id)).filter((t) => t.operation === "NOTE")).toHaveLength(0);
    await run(booking.id);
    const submit = bokun.made("/checkout.json/submit")[0].body;
    expect(JSON.stringify(submit)).toContain("Pickup: Calgary.");
  });

  it("flags staff with the new details when Bókun refuses the note, and leaves the booking as it is", async () => {
    const booking = await inBokun();
    bokun.failNote = new BokunApiError(403, "Bókun API Error: 403 Forbidden - Insufficient permissions");
    await prisma.booking.update({ where: { id: booking.id }, data: { pickupCustomText: "Calgary" } });
    await queueBokunNoteUpdate(booking.id);
    await run(booking.id);
    const task = (await tasksFor(booking.id)).find((t) => t.operation === "NOTE")!;
    expect(task.status).toBe("FAILED");
    const flags = await prisma.bookingFlag.findMany({ where: { bookingId: booking.id, status: "OPEN" } });
    expect(flags).toHaveLength(1);
    expect(flags[0].note).toMatch(/^Bókun note: .*Pickup: Calgary\./);
    const after = await reload(booking.id);
    expect(after.externalSyncStatus).toBe("SYNCED");

    // Staff Retry once Bókun allows it: the note goes in and the flag closes; the booking stays SYNCED.
    bokun.failNote = null;
    await retryBokunSync(booking.id);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
    expect(await prisma.bookingFlag.count({ where: { bookingId: booking.id, status: "OPEN" } })).toBe(0);
  });
});
