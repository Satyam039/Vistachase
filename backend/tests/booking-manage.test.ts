// Admin Manage booking page (modules/admin/booking-manage.ts) and changes made in Bókun coming back
// to the website (modules/bokun/bokun-inbound.ts). A stand-in answers as the Bókun API.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/db/prisma";
import { setBokunClientForTests, type BokunApi } from "@/modules/bokun/config";
import { processBokunSyncTasks, setBokunAutoRunForTests } from "@/modules/bokun/bokun-sync";
import { pullBokunChanges, readBokunBooking, setBokunInboundForTests, undoTimeOnlyMoves } from "@/modules/bokun/bokun-inbound";
import { bookingOverview, changeBookingDate, dateOptions, updateGuestContact } from "@/modules/admin/booking-manage";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const SHARED_SLUG = "banff-highlights-tour"; // Bókun 796650
const DAY = "2036-08-11";
const OTHER_DAY = "2036-08-12";

let codes = 0;

class FakeBokun {
  calls: { method: string; path: string; body?: any }[] = [];
  /** Bókun's bookings by confirmation code, as GET /booking.json/booking/<code> returns them. */
  bookings: Record<string, any> = {};
  slots: Record<string, any[]> = {};

  slot(productId: string, date: string, time: string, left: number) {
    (this.slots[productId] ??= []).push({ date: Date.parse(`${date}T00:00:00Z`), startTime: time, startTimeId: 7700000 + codes++, availabilityCount: left, defaultRateId: 5, rates: [{ id: 5 }] });
  }

  api(): BokunApi {
    return {
      getAvailabilities: async (id: string) => this.slots[id] ?? [],
      fetch: async (method: string, path: string, body?: any) => {
        this.calls.push({ method, path, body });
        if (path.startsWith("/activity.json/")) return { pricingCategories: [{ id: 1, title: "Adults" }, { id: 2, title: "Child" }] };
        if (path.startsWith("/checkout.json/options")) return { options: [{ type: "CUSTOMER_FULL_PAYMENT", paymentMethods: { allowedMethods: ["RESERVE_FOR_EXTERNAL_PAYMENT"] } }] };
        if (path.startsWith("/booking.json/booking-search")) return { results: [] };
        if (path.startsWith("/checkout.json/submit")) return { booking: { confirmationCode: `MAN-${process.pid}-${++codes}` } };
        if (path.startsWith("/booking.json/booking/")) {
          const code = decodeURIComponent(path.split("/").pop()!);
          return this.bookings[code] ?? null;
        }
        return null;
      },
    } as unknown as BokunApi;
  }

  made(prefix: string) {
    return this.calls.filter((c) => c.path.startsWith(prefix));
  }
}

let bokun: FakeBokun;
let tourId = "";
let staffId = "";
let minute = 0;

async function departure(day: string, time = `07:${String(minute++).padStart(2, "0")}`, capacity = 12) {
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(day), departureTime: timeOfDay(time), capacityTotal: capacity, price: 18900, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

async function book(dep: { id: string }) {
  const result = await createBooking({
    departureId: dep.id,
    customerName: "Grace Hopper",
    customerEmail: "grace.manage@example.com",
    customerPhone: "+1 403 555 0111",
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
  });
  expect(result.success).toBe(true);
  return prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id } });
}

const reload = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id } });
const seats = (id: string) => prisma.tourDeparture.findUniqueOrThrow({ where: { id } }).then((d) => d.capacityBooked);

beforeAll(async () => {
  setBokunAutoRunForTests(false);
  tourId = (await prisma.tour.findUniqueOrThrow({ where: { slug: SHARED_SLUG } })).id;
  const staff = await prisma.user.create({ data: { email: `manage-staff-${process.pid}@example.com`, name: "Ravinder Singh", role: "ADMIN", passwordHash: "x" } as never });
  staffId = staff.id;
});

beforeEach(() => {
  bokun = new FakeBokun();
  setBokunClientForTests(bokun.api());
  setBokunInboundForTests(true);
});

afterAll(() => {
  setBokunClientForTests(null);
  setBokunAutoRunForTests(true);
  setBokunInboundForTests(null);
});

describe("Change tour date (staff)", () => {
  it("moves the seats, records it, re-books Bókun on the new date and only then cancels the old Bókun booking", async () => {
    const from = await departure(DAY, "08:30");
    const to = await departure(OTHER_DAY, "08:30");
    bokun.slot("796650", DAY, "08:30", 10);
    bokun.slot("796650", OTHER_DAY, "08:30", 10);
    const booking = await book(from);
    await processBokunSyncTasks({ bookingId: booking.id });
    const oldCode = (await reload(booking.id)).bokunBookingId!;
    expect(oldCode).toMatch(/^MAN-/);

    const options = await dateOptions(booking.id, {});
    expect(options.status).toBe(200);
    expect("departures" in options && (options.departures ?? []).some((d) => d.id === to.id && d.fits)).toBe(true);

    const result = await changeBookingDate(booking.id, { departureId: to.id, reason: "Guest asked for the next day", notifyGuest: true }, staffId);
    expect(result).toMatchObject({ status: 200, from: `${DAY} 08:30`, to: `${OTHER_DAY} 08:30`, email: "sent", bokun: "queued" });
    expect(await seats(from.id)).toBe(0);
    expect(await seats(to.id)).toBe(2);
    const moved = await reload(booking.id);
    expect(moved.tourDepartureId).toBe(to.id);
    expect(moved.bokunBookingId).toBeNull();
    expect(moved.externalSyncStatus).toBe("PENDING");

    const history = await prisma.auditLog.findMany({ where: { entityId: booking.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["CHANGE_DATE", "DATE_CHANGE_EMAIL_SENT"]));

    // The new date is created in Bókun first; only then is the old Bókun booking cancelled.
    await processBokunSyncTasks({ bookingId: booking.id });
    await processBokunSyncTasks({ bookingId: booking.id, now: new Date(Date.now() + 10 * 60_000) });
    const newCode = (await reload(booking.id)).bokunBookingId!;
    expect(newCode).toMatch(/^MAN-/);
    expect(newCode).not.toBe(oldCode);
    const paths = bokun.calls.map((c) => c.path);
    const cancelAt = paths.indexOf(`/booking.json/cancel-booking/${oldCode}`);
    expect(cancelAt).toBeGreaterThan(paths.lastIndexOf(paths.filter((p) => p.startsWith("/checkout.json/confirm-reserved/")).at(-1)!));
    expect(bokun.made("/booking.json/cancel-booking")).toHaveLength(1);
    expect((await reload(booking.id)).externalSyncStatus).toBe("SYNCED");
  });

  it("refuses a departure without enough seats, and a departure of another tour", async () => {
    setBokunClientForTests(null); // without Bókun: our own seats decide
    const from = await departure(DAY);
    const full = await departure(OTHER_DAY, undefined, 1);
    const booking = await book(from);
    const refused = await changeBookingDate(booking.id, { departureId: full.id, reason: "test", notifyGuest: false }, staffId);
    expect(refused).toMatchObject({ status: 409 });
    expect((await reload(booking.id)).tourDepartureId).toBe(from.id);

    const otherTour = await prisma.tour.findFirstOrThrow({ where: { slug: { not: SHARED_SLUG } } });
    const elsewhere = await prisma.tourDeparture.create({ data: { tourId: otherTour.id, date: dateOnly(OTHER_DAY), departureTime: timeOfDay("09:00"), capacityTotal: 12, price: 100, status: "ACTIVE", inventorySource: "LOCAL" } });
    expect(await changeBookingDate(booking.id, { departureId: elsewhere.id, reason: "test", notifyGuest: false }, staffId)).toMatchObject({ status: 400 });
  });
});

describe("Edit guest details (staff)", () => {
  it("changes name, email and phone and records what changed", async () => {
    setBokunClientForTests(null);
    const booking = await book(await departure(DAY));
    const result = await updateGuestContact(booking.id, { customerName: "Grace B. Hopper", customerPhone: "+1 403 555 0199", customerEmail: booking.customerEmail }, staffId);
    expect(result).toMatchObject({ status: 200, changed: ["customerName", "customerPhone"] });
    const after = await reload(booking.id);
    expect(after.customerName).toBe("Grace B. Hopper");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: booking.id, action: "EDIT_GUEST_DETAILS" } });
    expect(log.userId).toBe(staffId);
  });
});

describe("Changes made in Bókun come back to the website", () => {
  it("reads Bókun's booking: status, date (epoch or text) and start time", () => {
    expect(readBokunBooking({ status: "CONFIRMED", activityBookings: [{ status: "CONFIRMED", date: Date.parse("2036-08-12T00:00:00Z"), startTime: "08:30", totalParticipants: 2 }] })).toEqual({
      status: "CONFIRMED",
      date: "2036-08-12",
      time: "08:30",
      participants: 2,
    });
    expect(readBokunBooking({ status: "CANCELLED", activityBookings: [{ startDateTime: "2036-08-12T09:15:00" }] })).toMatchObject({ status: "CANCELLED", date: "2036-08-12", time: "09:15" });
  });

  it("cancels the website booking when it was cancelled in Bókun, without sending a cancel back", async () => {
    const dep = await departure(DAY, "10:10");
    bokun.slot("796650", DAY, "10:10", 10);
    const booking = await book(dep);
    await processBokunSyncTasks({ bookingId: booking.id });
    const code = (await reload(booking.id)).bokunBookingId!;
    bokun.bookings[code] = { status: "CANCELLED", activityBookings: [{ status: "CANCELLED", date: Date.parse(`${DAY}T00:00:00Z`), startTime: "10:10" }] };

    const result = await pullBokunChanges({ bookingId: booking.id });
    expect(result).toMatchObject({ checked: 1, cancelled: 1 });
    expect((await reload(booking.id)).status).toBe("CANCELLED");
    expect(await seats(dep.id)).toBe(0);
    await processBokunSyncTasks({ bookingId: booking.id, now: new Date(Date.now() + 60 * 60_000) });
    expect(bokun.made("/booking.json/cancel-booking")).toHaveLength(0);
    const flag = await prisma.bookingFlag.findFirst({ where: { bookingId: booking.id, status: "OPEN" } });
    expect(flag?.note).toContain("cancelled in Bókun");
    const overview = await bookingOverview(booking.id);
    expect(overview?.bokun.events.map((e) => e.action)).toContain("BOKUN_CANCELLED");
  });

  it("moves the website booking to our departure on the date and time Bókun now shows, and emails the updated ticket", async () => {
    const from = await departure(DAY, "11:20");
    const to = await departure(OTHER_DAY, "11:20");
    bokun.slot("796650", DAY, "11:20", 10);
    const booking = await book(from);
    await processBokunSyncTasks({ bookingId: booking.id });
    const code = (await reload(booking.id)).bokunBookingId!;
    bokun.bookings[code] = { status: "CONFIRMED", activityBookings: [{ status: "CONFIRMED", date: Date.parse(`${OTHER_DAY}T00:00:00Z`), startTime: "11:20" }] };

    expect(await pullBokunChanges({ bookingId: booking.id })).toMatchObject({ moved: 1 });
    expect((await reload(booking.id)).tourDepartureId).toBe(to.id);
    expect(await seats(to.id)).toBe(2);
    expect(await seats(from.id)).toBe(0);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: booking.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["BOKUN_DATE_CHANGED", "DATE_CHANGE_EMAIL_SENT"]));
  });

  it("doesn't move a booking when Bókun's start shows another clock time on the same day (VC-2026-EBB006F4)", async () => {
    const at7 = await departure(DAY, "07:05");
    const at8 = await departure(DAY, "08:05");
    bokun.slot("796650", DAY, "07:05", 10);
    const booking = await book(at7);
    await processBokunSyncTasks({ bookingId: booking.id });
    const code = (await reload(booking.id)).bokunBookingId!;
    // Midnight in Banff as epoch ms (07:00 UTC), and the private tours' single 8am start.
    bokun.bookings[code] = { status: "CONFIRMED", activityBookings: [{ status: "CONFIRMED", date: Date.parse(`${DAY}T07:00:00Z`), startTime: "08:05" }] };
    expect(await pullBokunChanges({ bookingId: booking.id })).toMatchObject({ checked: 1, moved: 0, flagged: 0 });
    expect((await reload(booking.id)).tourDepartureId).toBe(at7.id);
    expect(await seats(at8.id)).toBe(0);
  });

  it("puts back a booking the first release moved to another time on the same day, once", async () => {
    setBokunClientForTests(null);
    const at7 = await departure(DAY, "07:10");
    const at8 = await departure(DAY, "08:10");
    const booking = await book(at7);
    // What the first release did: moved it to 08:10 and logged it.
    await prisma.$executeRaw`UPDATE "TourDeparture" SET "capacityBooked" = "capacityBooked" - 2 WHERE id = ${at7.id}`;
    await prisma.$executeRaw`UPDATE "TourDeparture" SET "capacityBooked" = "capacityBooked" + 2 WHERE id = ${at8.id}`;
    await prisma.booking.update({ where: { id: booking.id }, data: { tourDepartureId: at8.id } });
    await prisma.auditLog.create({
      data: { action: "BOKUN_DATE_CHANGED", entityType: "Booking", entityId: booking.id, details: { code: "X", from: `${DAY} 07:10`, to: `${DAY} 08:10`, fromDepartureId: at7.id, toDepartureId: at8.id } },
    });
    expect(await undoTimeOnlyMoves()).toBeGreaterThanOrEqual(1);
    expect((await reload(booking.id)).tourDepartureId).toBe(at7.id);
    expect(await seats(at7.id)).toBe(2);
    expect(await seats(at8.id)).toBe(0);
    await undoTimeOnlyMoves();
    expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "BOKUN_MOVE_UNDONE" } })).toBe(1);
  });

  it("flags staff when the website has no departure on Bókun's new date", async () => {
    const from = await departure(DAY, "12:30");
    bokun.slot("796650", DAY, "12:30", 10);
    const booking = await book(from);
    await processBokunSyncTasks({ bookingId: booking.id });
    const code = (await reload(booking.id)).bokunBookingId!;
    bokun.bookings[code] = { status: "CONFIRMED", activityBookings: [{ date: "2036-09-30", startTime: "12:30" }] };
    expect(await pullBokunChanges({ bookingId: booking.id })).toMatchObject({ flagged: 1 });
    expect((await reload(booking.id)).tourDepartureId).toBe(from.id);
    expect((await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, status: "OPEN" } })).note).toContain("2036-09-30");
  });
});
