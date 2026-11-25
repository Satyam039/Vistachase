// Two-Day Rockies Explorer: both day tours booked together, 10% off, one payment for both. Covers
// the API, the Stripe webhook confirming both days on the full amount, releasing day 1 when day 2
// can't be booked, and refunds of one day landing on that day's booking.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { activitiesSummary, PACKAGE_ACTIVITY_PRICES } from "@/modules/bookings/package-activities";
import { promoUses } from "@/modules/pricing/promo-codes";
import request from "supertest";
import Stripe from "stripe";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { setPaymentProviderForTests, stripeId, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { createPackageBooking } from "@/modules/bookings/package-booking";
import { cancelBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, getMountainTimeInstant, timeOfDay } from "@/lib/utils/time";

const refunds: { transactionId: string; amount?: number; metadata?: Record<string, string> }[] = [];
const browserPays: IPaymentProvider = {
  name: "stripe",
  async createPaymentIntent(req) {
    return { clientSecret: `pi_pkg_${req.bookingReference}_secret`, intentId: `pi_pkg_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false };
  },
  async refundPayment(transactionId, amount, metadata) {
    refunds.push({ transactionId, amount, metadata });
    return { success: true, refundId: `re_${refunds.length}_${Date.now()}` };
  },
  async retrievePaymentIntent(intentId) {
    return { clientSecret: `${stripeId(intentId)}_secret`, intentId: stripeId(intentId), amount: 0, currency: "CAD", paid: false };
  },
};

const WEBHOOK_SECRET = "whsec_package_secret";
let day1 = "";
let day2 = "";
let day2Full = "";
let sameDay2 = "";

async function departure(slug: string, date: string, capacityBooked = 0) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  const d = await prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("08:30"), capacityTotal: 12, capacityBooked, capacityHeld: 0, price: slug === "banff-highlights-tour" ? 18900 : 22900, status: "ACTIVE" },
  });
  return d.id;
}

beforeAll(async () => {
  day1 = await departure("banff-highlights-tour", "2027-06-14");
  day2 = await departure("shared-tours-icefields-jasper", "2027-06-15");
  day2Full = await departure("shared-tours-icefields-jasper", "2027-06-16", 12);
  sameDay2 = await departure("shared-tours-icefields-jasper", "2027-06-14");
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterEach(() => setPaymentProviderForTests(null));
afterAll(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

const guest = (n: number, departureIds = [day1, day2]) => ({
  packageSlug: "two-day-rockies-explorer",
  departureIds,
  customerName: `Two Day ${n}`,
  customerEmail: `twoday${n}@example.com`,
  customerPhone: "+1 403 555 0101",
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
});

function signed(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}_${Math.random()}`, object: "event", type, data: { object } });
  return { payload, header: Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) };
}

const post = (app: ReturnType<typeof createApp>, e: { payload: string; header: string }) =>
  request(app).post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", e.header).send(e.payload);

describe("two-day package", () => {
  it("books both days with 10% off and starts one payment for the sum", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createPackageBooking(guest(1));
    expect(result.success).toBe(true);
    expect(result.bookings).toHaveLength(2);
    // (2 x 189 - 10%) + (2 x 229 - 10%)
    expect(result.totalAmount).toBe(340.2 + 412.2);
    expect(result.payment?.amount).toBe(752.4);

    const [a, b] = await Promise.all(result.bookings!.map((x) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: x.bookingReference }, include: { payments: true } })));
    expect(a.tourDepartureId).toBe(day1);
    expect(b.tourDepartureId).toBe(day2);
    expect(a.payments[0]).toMatchObject({ amount: 34020, status: "PENDING" });
    expect(b.payments[0]).toMatchObject({ amount: 41220, status: "PENDING", transactionId: `${a.payments[0].transactionId}:2` });
    expect((a.priceSnapshot as { package?: { references: string[] } }).package?.references).toEqual([a.bookingReference, b.bookingReference]);
    expect(a.adminNotes).toContain(b.bookingReference);
  });

  it("confirms both days only when Stripe reports the full package amount", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createPackageBooking(guest(2));
    const refs = result.bookings!.map((b) => b.bookingReference);
    const intentId = `pi_pkg_${refs[0]}`;
    const app = createApp();
    const intent = (amount: number) => ({ id: intentId, object: "payment_intent", amount, amount_received: amount, currency: "cad", metadata: { bookingReference: refs[0], kind: "PACKAGE", packageRefs: refs.join(",") } });

    // Only day 1's share: not enough, nothing confirmed.
    expect((await post(app, signed("payment_intent.succeeded", intent(34020)))).status).toBe(200);
    const after = await prisma.booking.findMany({ where: { bookingReference: { in: refs } } });
    expect(after.map((b) => b.status)).toEqual(["PENDING_PAYMENT", "PENDING_PAYMENT"]);

    expect((await post(app, signed("payment_intent.succeeded", intent(75240)))).status).toBe(200);
    const paid = await prisma.booking.findMany({ where: { bookingReference: { in: refs } }, include: { payments: true } });
    expect(paid.map((b) => b.status)).toEqual(["CONFIRMED", "CONFIRMED"]);
    expect(paid.flatMap((b) => b.payments.map((p) => p.status))).toEqual(["SUCCEEDED", "SUCCEEDED"]);
  });

  it("releases day 1 when day 2 is sold out, and refuses the same date twice", async () => {
    setPaymentProviderForTests(browserPays);
    const before = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: day1 } });
    const full = await createPackageBooking(guest(3, [day1, day2Full]));
    expect(full.success).toBe(false);
    expect(full.error).toMatch(/^Day 2/);
    const afterSeats = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: day1 } });
    expect(afterSeats.capacityBooked).toBe(before.capacityBooked);

    const same = await createPackageBooking(guest(4, [day1, sameDay2]));
    expect(same.success).toBe(false);
    expect(same.error).toMatch(/different days/);

    const swapped = await createPackageBooking(guest(5, [day2, day1]));
    expect(swapped.success).toBe(false);
  });

  it("answers a retried checkout with the same two bookings", async () => {
    setPaymentProviderForTests(browserPays);
    const app = createApp();
    const key = "pkg-retry-key-0123456789";
    const first = await request(app).post("/api/bookings/package").set("Idempotency-Key", key).send(guest(6));
    expect(first.status).toBe(200);
    const again = await request(app).post("/api/bookings/package").set("Idempotency-Key", key).send(guest(6));
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.bookings.map((b: { bookingReference: string }) => b.bookingReference)).toEqual(first.body.bookings.map((b: { bookingReference: string }) => b.bookingReference));
    expect(again.body.payment.amount).toBe(752.4);
  });

  it("refunds a cancelled day from the shared payment, tagged with that day's booking", async () => {
    setPaymentProviderForTests(browserPays);
    const result = await createPackageBooking(guest(7));
    const refs = result.bookings!.map((b) => b.bookingReference);
    const app = createApp();
    const intentId = `pi_pkg_${refs[0]}`;
    await post(app, signed("payment_intent.succeeded", { id: intentId, object: "payment_intent", amount: 75240, amount_received: 75240, currency: "cad", metadata: { bookingReference: refs[0], kind: "PACKAGE", packageRefs: refs.join(",") } }));

    refunds.length = 0;
    const cancelled = await cancelBooking(refs[1], "twoday7@example.com");
    expect(cancelled.success).toBe(true);
    expect(refunds).toEqual([{ transactionId: `${intentId}:2`, amount: 41220, metadata: { bookingReference: refs[1] } }]);

    // Stripe then reports the partial refund on the shared charge: day 1 stays confirmed, no flag.
    const charge = { id: `ch_${refs[0]}`, object: "charge", payment_intent: intentId, amount: 75240, amount_refunded: 41220, refunds: { data: [{ id: "re_x", amount: 41220, status: "succeeded", metadata: { bookingReference: refs[1] } }] } };
    expect((await post(app, signed("charge.refunded", charge))).status).toBe(200);
    const [a, b] = await Promise.all(refs.map((r) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: r }, include: { flags: true } })));
    expect(a.status).toBe("CONFIRMED");
    expect(a.flags).toHaveLength(0);
    expect(b.status).toBe("REFUNDED");

    // A refund made in the Stripe dashboard can't be pinned to a day: staff get one flag.
    const dashboard = { ...charge, amount_refunded: 51220, refunds: { data: [...charge.refunds.data, { id: "re_dash", amount: 10000, status: "succeeded", metadata: {} }] } };
    await post(app, signed("charge.refunded", dashboard));
    const flagged = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: refs[0] }, include: { flags: true } });
    expect(flagged.flags).toHaveLength(1);
    expect(flagged.flags[0].note).toContain("refunded in Stripe");
  });
});

// Private journeys (owner 2026-11-06: booked like a private tour, a date the guest picks for each day).
describe("private multi-day journeys", () => {
  async function vehicle(slug: string, date: string, price: number) {
    const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
    const d = await prisma.tourDeparture.create({
      data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay("08:00"), capacityTotal: 13, capacityBooked: 0, capacityHeld: 0, price, status: "ACTIVE" },
    });
    return d.id;
  }
  const party = (n: number, packageSlug: string, departureIds: string[], extra: Record<string, unknown> = {}) => ({
    packageSlug,
    departureIds,
    customerName: `Private Journey ${n}`,
    customerEmail: `journey${n}@example.com`,
    customerPhone: "+1 403 555 0102",
    adultsCount: 4,
    childrenCount: 0,
    infantsCount: 0,
    ...extra,
  });

  it("three days on dates the guest picks (not in a row): CAD 1,575 a vehicle a day in summer", async () => {
    setPaymentProviderForTests(browserPays);
    const ids = [
      await vehicle("banff-private-tour", "2027-07-02", 175000),
      await vehicle("banff-private-tour", "2027-07-05", 175000),
      await vehicle("icefields-jasper-private-tour", "2027-07-09", 175000),
    ];
    const result = await createPackageBooking(party(1, "three-day-rockies-discovery", ids));
    expect(result.success).toBe(true);
    expect(result.bookings).toHaveLength(3);
    expect(result.totalAmount).toBe(1575 * 3);
    const stored = await prisma.booking.findMany({ where: { bookingReference: { in: result.bookings!.map((b) => b.bookingReference) } } });
    expect(stored.map((b) => b.totalAmount).sort()).toEqual([157500, 157500, 157500]);
  });

  it("four-day journey: summer only, and the days follow the itinerary's tours", async () => {
    const winter = [
      await vehicle("banff-private-tour", "2027-11-02", 124000),
      await vehicle("banff-private-tour", "2027-11-03", 124000),
      await vehicle("icefields-jasper-private-tour", "2027-11-04", 124000),
      await vehicle("icefields-jasper-private-tour", "2027-11-05", 124000),
    ];
    const refused = await createPackageBooking(party(2, "four-day-rockies-and-jasper", winter));
    expect(refused).toMatchObject({ success: false });
    expect(refused.error).toContain("June 1 to October 10");

    const wrongOrder = [winter[2], winter[0], winter[1], winter[3]];
    expect((await createPackageBooking(party(3, "four-day-rockies-and-jasper", wrongOrder))).success).toBe(false);
  });

  it("four-day (owner, 2026-11-24): Jasper tours on consecutive dates, other tours any free date, all four dates different", async () => {
    setPaymentProviderForTests(browserPays);
    const banff = await vehicle("banff-private-tour", "2027-07-20", 175000);
    const yoho = await vehicle("banff-private-tour", "2027-07-14", 175000);
    const icefields = await vehicle("icefields-jasper-private-tour", "2027-07-16", 175000);
    const jasperGap = await vehicle("icefields-jasper-private-tour", "2027-07-18", 175000);
    const jasperNext = await vehicle("icefields-jasper-private-tour", "2027-07-17", 175000);
    const final = { finalDestination: { area: "CANMORE" } };

    const gap = await createPackageBooking(party(41, "four-day-rockies-and-jasper", [banff, yoho, icefields, jasperGap], final));
    expect(gap.success).toBe(false);
    expect(gap.error).toContain("Jasper Highlights & Return must be the day after Icefields Parkway to Jasper");

    const noFinal = await createPackageBooking(party(42, "four-day-rockies-and-jasper", [banff, yoho, icefields, jasperNext]));
    expect(noFinal).toMatchObject({ success: false });
    expect(noFinal.error).toContain("finishes");

    // Up to 14 guests in the van, more than the day tour's 13 seats; Banff after the Jasper tours is fine.
    const ok = await createPackageBooking(
      party(43, "four-day-rockies-and-jasper", [banff, yoho, icefields, jasperNext], {
        adultsCount: 14,
        finalDestination: { area: "CALGARY_AIRPORT", address: "Flight AC123 at 19:30" },
        dayPickups: [{ pickupCustomText: "Canmore Inn" }, { pickupCustomText: "Canmore Inn" }, { pickupCustomText: "Canmore Inn" }, { pickupCustomText: "Jasper: Whistlers Inn" }],
      }),
    );
    expect(ok.success).toBe(true);
    expect(ok.totalAmount).toBe(6300);
    const stored = await prisma.booking.findMany({ where: { bookingReference: { in: ok.bookings!.map((b) => b.bookingReference) } } });
    const last = stored.find((b) => b.bookingReference === ok.bookings![3].bookingReference)!;
    expect(last.pickupCustomText).toBe("Jasper: Whistlers Inn");
    expect(last.specialRequests).toContain("Final drop-off: Calgary Airport (extra-cost request");
    expect(stored.find((b) => b.bookingReference === ok.bookings![0].bookingReference)!.specialRequests ?? "").not.toContain("Final drop-off");

    const fifteen = await createPackageBooking(
      party(44, "four-day-rockies-and-jasper", [
        await vehicle("banff-private-tour", "2027-08-20", 175000),
        await vehicle("banff-private-tour", "2027-08-21", 175000),
        await vehicle("icefields-jasper-private-tour", "2027-08-22", 175000),
        await vehicle("icefields-jasper-private-tour", "2027-08-23", 175000),
      ], { adultsCount: 15, ...final }),
    );
    expect(fifteen.error).toContain("up to 14 guests");
  });

  it("four-day: the outbound tours can't pick up in Lake Louise", async () => {
    const stop = await prisma.shuttleStop.create({ data: { name: "Test Lake Louise Lodge", town: "Lake Louise", address: "1 Lake Louise Dr", latitude: 51.42, longitude: -116.18, instructions: "Front door" } });
    const ids = [
      await vehicle("banff-private-tour", "2027-09-01", 175000),
      await vehicle("banff-private-tour", "2027-09-02", 175000),
      await vehicle("icefields-jasper-private-tour", "2027-09-03", 175000),
      await vehicle("icefields-jasper-private-tour", "2027-09-04", 175000),
    ];
    const result = await createPackageBooking(party(45, "four-day-rockies-and-jasper", ids, { pickupStopId: stop.id, finalDestination: { area: "LAKE_LOUISE" } }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("Banff or Canmore");
  });

  it("three-day (owner, 2026-11-24): any order, different dates, 14 guests, Banff/Canmore pickups and transfers, tour names in errors", async () => {
    setPaymentProviderForTests(browserPays);
    const llStop = await prisma.shuttleStop.create({ data: { name: "Test Lake Louise Inn", town: "Lake Louise", address: "2 Village Rd", latitude: 51.42, longitude: -116.18, instructions: "Front door" } });
    // Icefields before Banff is fine (any order); 14 guests fit the van.
    const ids = [
      await vehicle("banff-private-tour", "2027-09-20", 175000),
      await vehicle("banff-private-tour", "2027-09-12", 175000),
      await vehicle("icefields-jasper-private-tour", "2027-09-08", 175000),
    ];
    const lakeLouise = await createPackageBooking(party(46, "three-day-rockies-discovery", ids, { pickupStopId: llStop.id }));
    expect(lakeLouise.success).toBe(false);
    expect(lakeLouise.error).toContain("all three tours are from Banff or Canmore");
    const llTransfer = await createPackageBooking(
      party(47, "three-day-rockies-discovery", ids, { airportTransfer: { type: "ARRIVAL", area: "LAKE_LOUISE", arrivalDate: "2027-09-07", arrivalTime: "14:00", from: "Calgary Airport", to: "Lake Louise" } }),
    );
    expect(llTransfer.error).toContain("Special requests");
    expect((await createPackageBooking(party(49, "three-day-rockies-discovery", ids, { adultsCount: 15 }))).error).toContain("up to 14 guests");
    const fourteen = await createPackageBooking(party(48, "three-day-rockies-discovery", ids, { adultsCount: 14 }));
    expect(fourteen.success).toBe(true);
    // Errors name the tour, never a blank or "Day N".
    const winter = await vehicle("icefields-jasper-private-tour", "2027-11-03", 124000);
    const off = await createPackageBooking(party(50, "three-day-rockies-discovery", [await vehicle("banff-private-tour", "2027-08-01", 175000), await vehicle("banff-private-tour", "2027-08-03", 175000), winter]));
    expect(off.error).toMatch(/^Icefields Parkway & Columbia Icefield: /);
  });

  it("private two-day (owner, 2026-11-25): either order, mixed seasons priced per day, 14 guests, no same date, tour names, no winter glacier, flight numbers kept", async () => {
    setPaymentProviderForTests(browserPays);
    // Icefields (summer) before Banff & Yoho (winter): CAD 1,575 + 1,240 = 2,815.
    const banffWinter = await vehicle("banff-private-tour", "2027-10-20", 124000);
    const iceSummer = await vehicle("icefields-jasper-private-tour", "2027-10-02", 175000);
    const transfer = { type: "ARRIVAL" as const, area: "CANMORE" as const, arrivalDate: "2027-10-01", arrivalTime: "15:00", from: "Calgary Airport", to: "Canmore", flightNumbers: "AC 123" };
    const mixed = await createPackageBooking(party(60, "two-day-rockies-explorer-private", [banffWinter, iceSummer], { adultsCount: 14, airportTransfer: transfer }));
    expect(mixed.success).toBe(true);
    // 7-14 passengers: CAD 850 one way, never discounted.
    expect(mixed.totalAmount).toBe(1240 + 1575 + 850);
    const first = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: mixed.bookings![0].bookingReference } });
    expect(first.specialRequests ?? "").toContain("flight AC 123");

    expect((await createPackageBooking(party(61, "two-day-rockies-explorer-private", [await vehicle("banff-private-tour", "2027-08-01", 175000), await vehicle("icefields-jasper-private-tour", "2027-08-02", 175000)], { adultsCount: 15 }))).error).toContain("up to 14 guests");
    const sameDay = await createPackageBooking(party(62, "two-day-rockies-explorer-private", [await vehicle("banff-private-tour", "2027-08-05", 175000), await vehicle("icefields-jasper-private-tour", "2027-08-05", 175000)]));
    expect(sameDay.error).toContain("different date");

    const iceWinter = await vehicle("icefields-jasper-private-tour", "2027-11-10", 124000);
    const glacier = await createPackageBooking(
      party(63, "two-day-rockies-explorer-private", [await vehicle("banff-private-tour", "2027-11-12", 124000), iceWinter], { packageActivities: [{ id: "columbia-icefield-adventure", adults: 2, children: 0, infants: 0 }] }),
    );
    expect(glacier.error).toContain("June 1 to October 10");
    const cruise = await createPackageBooking(
      party(64, "two-day-rockies-explorer-private", [await vehicle("banff-private-tour", "2027-11-14", 124000), await vehicle("icefields-jasper-private-tour", "2027-11-16", 124000)], { packageActivities: [{ id: "lake-minnewanka-cruise", adults: 3, children: 0, infants: 0 }] }),
    );
    expect(cruise.success).toBe(true);

    // A vehicle that's gone is named by its tour, not left blank or "Day 2".
    const taken = await vehicle("icefields-jasper-private-tour", "2027-08-20", 175000);
    await prisma.tourDeparture.update({ where: { id: taken }, data: { capacityBooked: 13 } });
    const gone = await createPackageBooking(party(65, "two-day-rockies-explorer-private", [await vehicle("banff-private-tour", "2027-08-22", 175000), taken]));
    expect(gone.error).toMatch(/^Columbia Icefield Adventure: /);
  });

  it("private journeys can be paid with a 20% deposit; the webhook confirms both days on the deposits (owner, 2026-11-11)", async () => {
    setPaymentProviderForTests(browserPays);
    const ids = [await vehicle("banff-private-tour", "2027-08-02", 175000), await vehicle("icefields-jasper-private-tour", "2027-08-04", 175000)];
    const result = await createPackageBooking(party(9, "two-day-rockies-explorer-private", ids, { paymentPlan: "DEPOSIT" }));
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(1575 * 2);
    expect(result.amountDueNow).toBe(315 * 2);
    expect(result.payment?.amount).toBe(630);
    const refs = result.bookings!.map((b) => b.bookingReference);
    const stored = await prisma.booking.findMany({ where: { bookingReference: { in: refs } }, include: { payments: true } });
    for (const b of stored) {
      expect(b).toMatchObject({ paymentPlan: "DEPOSIT", depositAmount: 31500, totalAmount: 157500 });
      expect(b.payments).toEqual([expect.objectContaining({ amount: 31500, kind: "DEPOSIT", status: "PENDING" })]);
    }
    // Both balances are due 7 days before the FIRST tour day (owner, 2026-11-18).
    const firstDep = (await prisma.tourDeparture.findUnique({ where: { id: ids[0] } }))!;
    const firstDayAt = getMountainTimeInstant(firstDep.date, firstDep.departureTime);
    for (const b of stored) expect(b.balanceDueAt?.getTime()).toBe(firstDayAt.getTime() - 7 * 86_400_000);
    const intentId = `pi_pkg_${refs[0]}`;
    const app = createApp();
    const paid = signed("payment_intent.succeeded", { id: intentId, object: "payment_intent", amount: 63000, amount_received: 63000, currency: "cad", metadata: { bookingReference: refs[0], kind: "PACKAGE", packageRefs: refs.join(",") } });
    expect((await post(app, paid)).status).toBe(200);
    const after = await prisma.booking.findMany({ where: { bookingReference: { in: refs } } });
    expect(after.map((b) => b.status)).toEqual(["CONFIRMED", "CONFIRMED"]);
  });

  it("no deposit on the shared two-day package or for a journey under 15 days away", async () => {
    const shared = await createPackageBooking({ ...guest(20, [await departure("banff-highlights-tour", "2027-09-01"), await departure("shared-tours-icefields-jasper", "2027-09-02")]), paymentPlan: "DEPOSIT" });
    expect(shared).toMatchObject({ success: false });
    expect(shared.error).toContain("paid in full");
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const ids = [await vehicle("banff-private-tour", soon, 175000), await vehicle("icefields-jasper-private-tour", later, 175000)];
    const close = await createPackageBooking(party(10, "two-day-rockies-explorer-private", ids, { paymentPlan: "DEPOSIT" }));
    expect(close).toMatchObject({ success: false });
    expect(close.error).toContain("deposit");
  });

  it("private two-day in winter is CAD 1,240 a day, and the airport transfer is booked once with Day 1", async () => {
    setPaymentProviderForTests(browserPays);
    const ids = [await vehicle("banff-private-tour", "2027-12-08", 124000), await vehicle("icefields-jasper-private-tour", "2027-12-10", 124000)];
    const transfer = { type: "ROUND_TRIP" as const, area: "BANFF" as const, arrivalDate: "2027-12-07", arrivalTime: "14:00", departureDate: "2027-12-11", departureTime: "10:00", from: "Calgary Airport", to: "Banff" };
    const result = await createPackageBooking(party(4, "two-day-rockies-explorer-private", ids, { airportTransfer: transfer }));
    expect(result.success).toBe(true);
    // Round trip to Banff for 4 guests: 2 x CAD 364 (up to 6 guests, owner 2026-11-18), charged with Day 1, never discounted.
    expect(result.totalAmount).toBe(1240 * 2 + 2 * 364);
    const [a, b] = await Promise.all(result.bookings!.map((x) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: x.bookingReference } })));
    expect((a.priceSnapshot as { airportTransfer?: unknown }).airportTransfer).toBeTruthy();
    expect((b.priceSnapshot as { airportTransfer?: unknown }).airportTransfer).toBeUndefined();
  });

  it("a promo code comes off on top of the package price and counts as one use (owner, 2026-11-20)", async () => {
    setPaymentProviderForTests(browserPays);
    await prisma.promoCode.createMany({
      data: [
        { code: "PKGTEN", percentOff: 10, maxUses: 1 },
        { code: "PKG100", amountOffCents: 10000 },
      ],
    });
    const days = async (start: number) => [
      await vehicle("banff-private-tour", `2027-09-${String(start).padStart(2, "0")}`, 175000),
      await vehicle("banff-private-tour", `2027-09-${String(start + 1).padStart(2, "0")}`, 175000),
      await vehicle("icefields-jasper-private-tour", `2027-09-${String(start + 2).padStart(2, "0")}`, 175000),
    ];

    // 10% off every day's package price (CAD 1,575 a day).
    const pct = await createPackageBooking(party(20, "three-day-rockies-discovery", await days(1), { promoCode: "pkgten" }));
    expect(pct.success).toBe(true);
    expect(pct.totalAmount).toBe(1417.5 * 3);
    const stored = await prisma.booking.findMany({ where: { bookingReference: { in: pct.bookings!.map((b) => b.bookingReference) } } });
    expect(await promoUses("PKGTEN")).toBe(1);
    expect(stored.filter((b) => (b.priceSnapshot as { promo?: { code?: string } }).promo?.code === "PKGTEN")).toHaveLength(1);

    // Its one use is gone.
    const again = await createPackageBooking(party(21, "three-day-rockies-discovery", await days(5), { promoCode: "PKGTEN" }));
    expect(again.success).toBe(false);
    expect(again.error).toContain("fully used");

    // A fixed amount comes off once, from Day 1.
    const amount = await createPackageBooking(party(22, "three-day-rockies-discovery", await days(9), { promoCode: "PKG100" }));
    expect(amount.totalAmount).toBe(1575 * 3 - 100);
  });

  it("add-on activities: each with its own guests, kept on Day 1, charged only once priced (owner, 2026-11-18)", async () => {
    setPaymentProviderForTests(browserPays);
    const days = async (start: number) => [
      await vehicle("banff-private-tour", `2027-08-${start}`, 175000),
      await vehicle("banff-private-tour", `2027-08-${start + 1}`, 175000),
      await vehicle("icefields-jasper-private-tour", `2027-08-${start + 2}`, 175000),
    ];
    const chosen = [
      { id: "banff-gondola", adults: 2, children: 1, infants: 0 },
      { id: "lake-minnewanka-cruise", adults: 3, children: 0, infants: 0 },
    ];

    // Not offered with this journey (Maligne is 4-day only), or more people than the party: refused.
    expect((await createPackageBooking(party(5, "three-day-rockies-discovery", await days(10), { packageActivities: [{ id: "maligne-lake-cruise", adults: 2, children: 0, infants: 0 }] }))).error).toContain("can't be added");
    expect((await createPackageBooking(party(6, "three-day-rockies-discovery", await days(14), { packageActivities: [{ id: "banff-gondola", adults: 5, children: 0, infants: 0 }] }))).error).toContain("Choose 1 to 4 guests");

    // No price yet: recorded with who joins, total unchanged.
    const unpriced = await createPackageBooking(party(7, "three-day-rockies-discovery", await days(18), { packageActivities: chosen }));
    expect(unpriced.success).toBe(true);
    expect(unpriced.totalAmount).toBe(1575 * 3);
    const [first, second] = await Promise.all(unpriced.bookings!.slice(0, 2).map((x) => prisma.booking.findUniqueOrThrow({ where: { bookingReference: x.bookingReference } })));
    expect(activitiesSummary(first.priceSnapshot)).toBe("Banff Gondola for 2 adults, 1 child (price confirmed by our team); Lake Minnewanka Cruise for 3 adults (price confirmed by our team)");
    expect(first.specialRequests).toContain("Add-on activities: Banff Gondola for 2 adults, 1 child");
    expect(activitiesSummary(second.priceSnapshot)).toBeNull();

    // Priced: charged with Day 1, never discounted.
    const saved = { ...PACKAGE_ACTIVITY_PRICES["banff-gondola"]! };
    PACKAGE_ACTIVITY_PRICES["banff-gondola"] = { adultCents: 8000, childCents: 4000, infantCents: 0 };
    try {
      const priced = await createPackageBooking(party(8, "three-day-rockies-discovery", await days(22), { packageActivities: chosen }));
      expect(priced.totalAmount).toBe(1575 * 3 + 200);
      const day1 = await prisma.booking.findUniqueOrThrow({ where: { bookingReference: priced.bookings![0]!.bookingReference }, include: { items: true } });
      expect(day1.items.map((i) => [i.name, i.price])).toContainEqual(["Banff Gondola (activity)", 20000]);
      expect(activitiesSummary(day1.priceSnapshot)).toContain("Banff Gondola for 2 adults, 1 child (CAD $200)");
    } finally {
      PACKAGE_ACTIVITY_PRICES["banff-gondola"] = saved;
    }
  });
});
