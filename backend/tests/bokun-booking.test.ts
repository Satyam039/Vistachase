import { afterEach, describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { buildNote, buildPassengers, findSlot, reserveInBokun, confirmInBokun, abortInBokun, cancelInBokun, BokunUnavailableError, type BokunReservationInput } from "@/modules/bokun/bokun-booking";
import { MockBokunOperationsProvider, setBokunOperationsProvider } from "@/modules/bokun/bokun.provider";
import { cancelBooking, confirmPaidBooking, createBooking, failPendingBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import type { BokunApiClient } from "@/modules/bokun/bokun.client";

const SHARED = [
  { id: 767927, title: "Adults" },
  { id: 773211, title: "Child (1-13)" },
];

const input = (over: Partial<BokunReservationInput> = {}): BokunReservationInput => ({
  bookingReference: "VC-2031-TEST",
  productBokunId: "1142134",
  category: "SHARED",
  date: "2031-05-01",
  time: "08:00",
  adults: 2,
  children: 1,
  infants: 1,
  customerName: "Ada Lovelace King",
  customerEmail: "ada@example.com",
  customerPhone: "+14035550100",
  pickup: "Banff Train Station at 07:40",
  ...over,
});

/** A fake Bókun client that answers like the live API and records every call. */
function fakeClient(opts: { seatsLeft?: number; reserveOption?: boolean; categories?: { id: number; title: string }[] } = {}) {
  const calls: { method: string; path: string; body?: any }[] = [];
  const client = {
    getAvailabilities: async (id: string, start: string, end: string) => {
      calls.push({ method: "GET", path: `/activity.json/${id}/availabilities?start=${start}&end=${end}` });
      return [
        { date: Date.parse("2031-05-01T00:00:00Z"), startTime: "07:00", startTimeId: 111, availabilityCount: 20, defaultRateId: 9, rates: [{ id: 9 }] },
        { date: Date.parse("2031-05-01T00:00:00Z"), startTime: "08:00", startTimeId: 4601217, availabilityCount: opts.seatsLeft ?? 10, defaultRateId: 5, rates: [{ id: 5 }] },
      ];
    },
    fetch: async (method: string, path: string, body?: any) => {
      calls.push({ method, path, body });
      if (path.startsWith("/activity.json/")) return { pricingCategories: opts.categories ?? SHARED };
      if (path.startsWith("/checkout.json/options")) {
        return { options: [{ type: "CUSTOMER_FULL_PAYMENT", paymentMethods: { allowedMethods: opts.reserveOption === false ? ["CARD"] : ["CARD", "RESERVE_FOR_EXTERNAL_PAYMENT"] } }] };
      }
      if (path.startsWith("/checkout.json/submit")) return { booking: { confirmationCode: "VIS-T123", bookingId: 1 } };
      return null;
    },
  };
  return { client: client as unknown as BokunApiClient, calls };
}

describe("Bókun booking requests", () => {
  it("puts each guest in Bókun's category; infants go in the note when Bókun has no infant category", () => {
    const { passengers, infantsInNote } = buildPassengers(input(), SHARED);
    expect(passengers).toEqual([{ pricingCategoryId: 767927 }, { pricingCategoryId: 767927 }, { pricingCategoryId: 773211 }]);
    expect(infantsInNote).toBe(1);

    const withInfants = buildPassengers(input(), [...SHARED, { id: 3, title: "Infant (0-2)" }]);
    expect(withInfants.passengers).toHaveLength(4);
    expect(withInfants.infantsInNote).toBe(0);

    // Private tours: everyone in the one category; "Group of N" products take the group that fits.
    expect(buildPassengers(input({ category: "PRIVATE", infants: 0 }), [{ id: 905314, title: "Travellers" }]).passengers).toHaveLength(3);
    const group = buildPassengers(input({ category: "PRIVATE", adults: 5, children: 3 }), [
      { id: 991656, title: "Group of 13" },
      { id: 992625, title: "Group of 6" },
    ]);
    expect(group.passengers).toEqual([{ pricingCategoryId: 991656 }]);
  });

  it("finds Bókun's start for the departure and writes a useful note", () => {
    const list = [{ date: Date.parse("2031-05-01T00:00:00Z"), startTime: "08:00", startTimeId: 7 }, { date: Date.parse("2031-05-01T00:00:00Z"), startTime: "", startTimeId: 8 }];
    expect(findSlot(list, "2031-05-01", "08:00")?.startTimeId).toBe(7);
    expect(findSlot(list, "2031-05-01", "00:00")?.startTimeId).toBe(8);
    expect(findSlot(list, "2031-05-02", "08:00")).toBeUndefined();
    const note = buildNote(input({ specialRequests: "Window seat" }), 1);
    expect(note).toContain("VC-2031-TEST");
    expect(note).toContain("Banff Train Station at 07:40");
    expect(note).toContain("1 infant");
    expect(note).toContain("Window seat");
  });

  it("reserves for external payment, then confirms, aborts or cancels by confirmation code", async () => {
    const { client, calls } = fakeClient();
    expect(await reserveInBokun(client, input())).toBe("VIS-T123");

    const submit = calls.find((c) => c.path.startsWith("/checkout.json/submit"))!;
    expect(submit.method).toBe("POST");
    expect(submit.body).toMatchObject({ checkoutOption: "CUSTOMER_FULL_PAYMENT", paymentMethod: "RESERVE_FOR_EXTERNAL_PAYMENT", source: "DIRECT_REQUEST", sendNotificationToMainContact: false });
    const booking = submit.body.directBooking;
    expect(booking.externalBookingReference).toBe("VC-2031-TEST");
    expect(booking.mainContactDetails).toEqual([
      { questionId: "firstName", values: ["Ada"] },
      { questionId: "lastName", values: ["Lovelace King"] },
      { questionId: "email", values: ["ada@example.com"] },
      { questionId: "phoneNumber", values: ["+14035550100"] },
    ]);
    expect(booking.activityBookings[0]).toMatchObject({ activityId: 1142134, rateId: 5, date: "2031-05-01", startTimeId: 4601217 });
    expect(booking.activityBookings[0].passengers).toHaveLength(3);

    await confirmInBokun(client, "VIS-T123", "VC-2031-TEST", { amount: 573, currency: "CAD", transactionId: "pi_123" });
    await abortInBokun(client, "VIS-T124");
    await cancelInBokun(client, "VIS-T125");
    const tail = calls.slice(-3);
    expect(tail[0]).toMatchObject({ method: "POST", path: "/checkout.json/confirm-reserved/VIS-T123", body: { amount: 573, currency: "CAD", transactionDetails: { transactionId: "pi_123" } } });
    expect(tail[1]).toMatchObject({ method: "POST", path: "/booking.json/VIS-T124/abort-reserved" });
    expect(tail[2]).toMatchObject({ method: "POST", path: "/booking.json/cancel-booking/VIS-T125", body: { notify: false, refund: false } });
  });

  it("refuses when Bókun has too few seats, and never submits", async () => {
    const { client, calls } = fakeClient({ seatsLeft: 2 });
    await expect(reserveInBokun(client, input())).rejects.toBeInstanceOf(BokunUnavailableError);
    await expect(reserveInBokun(client, input({ time: "09:30" }))).rejects.toBeInstanceOf(BokunUnavailableError);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("fails clearly when Bókun offers no reserve checkout", async () => {
    const { client } = fakeClient({ reserveOption: false });
    await expect(reserveInBokun(client, input())).rejects.toThrow(/reserve-for-external-payment/);
  });
});

/** Mock provider that records calls and can be told to fail. */
class RecordingProvider extends MockBokunOperationsProvider {
  calls: string[] = [];
  failReserve: Error | null = null;
  failConfirm = false;
  async reserve(i: BokunReservationInput) {
    this.calls.push(`reserve ${i.bookingReference}`);
    if (this.failReserve) throw this.failReserve;
    return `BK-${i.bookingReference}`;
  }
  async confirmReservation(code: string) {
    this.calls.push(`confirm ${code}`);
    if (this.failConfirm) throw new Error("Bókun 500");
  }
  async abortReservation(code: string) {
    this.calls.push(`abort ${code}`);
  }
  async cancelBooking(code: string) {
    this.calls.push(`cancel ${code}`);
  }
}

describe("Bookings through Bókun", () => {
  let provider: RecordingProvider;
  afterEach(() => setBokunOperationsProvider(null));

  async function departure(date: string) {
    const tour = await prisma.tour.findUniqueOrThrow({ where: { slug: "full-day-at-lake-louise-and-moraine-lake" } });
    return prisma.tourDeparture.create({
      data: { tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("09:00"), capacityTotal: 12, capacityBooked: 0, capacityHeld: 0, price: 17500, status: "ACTIVE" },
    });
  }
  const book = (departureId: string, n = 1) =>
    createBooking({ departureId, customerName: "Guest Test", customerEmail: "guest@example.com", customerPhone: "+14035550100", adultsCount: n, childrenCount: 0, infantsCount: 0 });

  function useProvider() {
    provider = new RecordingProvider();
    setBokunOperationsProvider(provider);
  }

  it("reserves at booking, confirms once paid, cancels in Bókun when the guest cancels", async () => {
    useProvider();
    const dep = await departure("2031-06-01");
    const result = await book(dep.id, 2); // the mock payment pays at once
    expect(result.success, result.error).toBe(true);
    const ref = result.booking!.bookingReference;
    expect(provider.calls).toEqual([`reserve ${ref}`, `confirm BK-${ref}`]);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref } });
    expect(stored).toMatchObject({ status: "CONFIRMED", bokunBookingId: `BK-${ref}` });

    await cancelBooking(ref, "guest@example.com");
    expect(provider.calls.at(-1)).toBe(`cancel BK-${ref}`);
  });

  it("refuses the booking before payment when Bókun is sold out, and frees the seats", async () => {
    useProvider();
    provider.failReserve = new BokunUnavailableError("Bókun has 0 seat(s) left.");
    const dep = await departure("2031-06-02");
    const result = await book(dep.id, 2);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sold out/);
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).capacityBooked).toBe(0);
    expect(await prisma.payment.count({ where: { booking: { tourDepartureId: dep.id } } })).toBe(0);
  });

  it("still takes the booking when Bókun is unreachable, and reserves it after payment", async () => {
    useProvider();
    provider.failReserve = new Error("fetch failed");
    const dep = await departure("2031-06-03");
    const result = await book(dep.id);
    expect(result.success, result.error).toBe(true);
    const ref = result.booking!.bookingReference;
    // Reserve at creation failed and again after payment: paid, staff finish it.
    expect(provider.calls).toEqual([`reserve ${ref}`, `reserve ${ref}`]);
    expect(await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref } })).toMatchObject({ status: "PAID_UNSYNCED", bokunBookingId: null });
  });

  it("marks the booking for staff and releases Bókun's hold when confirmation fails", async () => {
    useProvider();
    provider.failConfirm = true;
    const dep = await departure("2031-06-04");
    const result = await book(dep.id);
    const ref = result.booking!.bookingReference;
    expect(provider.calls).toEqual([`reserve ${ref}`, `confirm BK-${ref}`, `abort BK-${ref}`]);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: ref } });
    expect(stored.status).toBe("PAID_UNSYNCED");
    expect(stored.bokunBookingId).toBeNull();
    expect(stored.adminNotes).toContain(`reservation BK-${ref} not confirmed`);
  });

  it("aborts the Bókun reservation when the payment fails", async () => {
    useProvider();
    const dep = await departure("2031-06-05");
    // A pending booking with a Bókun reservation, as if the guest were still paying with Stripe.
    const pending = await prisma.booking.create({
      data: {
        bookingReference: `VC-ABORT-${Date.now()}`, customerName: "P", customerEmail: "p@example.com", customerPhone: "+14035550100",
        tourDepartureId: dep.id, adultsCount: 1, childrenCount: 0, infantsCount: 0, totalSeats: 1, bokunBookingId: `BK-ABORT-${Date.now()}`,
        subtotal: 17500, tax: 0, totalAmount: 17500, currency: "CAD", status: "PENDING_PAYMENT", voucherCode: `VOUCH-ABORT-${Date.now()}`,
      },
    });
    expect(await failPendingBooking(pending.bookingReference, "card declined")).toBe(true);
    expect(provider.calls).toEqual([`abort ${pending.bokunBookingId}`]);
    // Webhook retries after that change nothing.
    expect((await confirmPaidBooking(pending.bookingReference))?.status).toBe("CANCELLED");
  });
});
