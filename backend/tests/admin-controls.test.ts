// Staff booking administration and controls (docs/ADMIN.md): role changes take effect at once,
// staff cancellation with a recorded refund (no provider call unless switched on), refunds marked
// as sent, Quick Book paid or unpaid, payment flags, departure management, pickup-stop editor,
// manifests (JSON and CSV) and the audit log filters.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { signToken } from "@/lib/auth/auth";
import { confirmPaidBooking, createBooking } from "@/modules/bookings/booking.repository";
import { setPaymentProviderForTests, type IPaymentProvider } from "@/lib/payment/payment.provider";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const app = createApp();
let adminCookie = "";
let dispatcherCookie = "";
let customerCookie = "";
let tourId = "";
let tourSlug = "";
let day = 0;

const cookieFor = (u: { id: string; email: string; role: string; name: string }, role = u.role) =>
  `vc_token=${signToken({ userId: u.id, email: u.email, role: role as never, name: u.name })}`;

/** A fresh LOCAL departure on its own date, so tests never share seats. */
async function departure(capacityTotal = 6) {
  day += 1;
  const date = new Date(Date.UTC(2028, 2, 1 + day)).toISOString().slice(0, 10);
  return prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay("08:30"), capacityTotal, price: 15000, childPrice: 9000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
}

const guest = (departureId: string, n: number, adultsCount = 2) => ({
  departureId,
  customerName: `Admin Test ${n}`,
  customerEmail: `admin.test${n}@example.com`,
  customerPhone: "+1 403 555 0142",
  adultsCount,
  childrenCount: 0,
  infantsCount: 0,
});

/** A paid, confirmed online booking (mock provider pays at once). */
async function paidBooking(n: number, adults = 2) {
  const dep = await departure(Math.max(6, adults));
  const result = await createBooking(guest(dep.id, n, adults));
  expect(result.booking?.status).toBe("CONFIRMED");
  return { dep, booking: await prisma.booking.findUniqueOrThrow({ where: { id: result.booking!.id } }) };
}

const seats = async (id: string) => (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).capacityBooked;

const refundSpy: string[] = [];
const recordingProvider: IPaymentProvider = {
  name: "mock",
  async createPaymentIntent(req) {
    return { clientSecret: "x", intentId: `mock_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: true };
  },
  async refundPayment(transactionId) {
    refundSpy.push(transactionId);
    return { success: true, refundId: `re_${transactionId}` };
  },
};

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const dispatcher = await prisma.user.findFirstOrThrow({ where: { role: "DISPATCHER" } });
  const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
  adminCookie = cookieFor(admin);
  dispatcherCookie = cookieFor(dispatcher);
  customerCookie = cookieFor(customer);
  const tour = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", bookingMode: "BOKUN" } });
  tourId = tour.id;
  tourSlug = tour.slug;
});

afterEach(() => {
  setPaymentProviderForTests(null);
  delete process.env.STAFF_REFUNDS_VIA_PROVIDER;
  refundSpy.length = 0;
});

describe("staff access follows the live role", () => {
  it("ends staff access as soon as the role changes, even with a valid token", async () => {
    const user = await prisma.user.create({ data: { email: "demoted.staff@example.com", passwordHash: "x", name: "Demoted", role: "OPERATOR" } });
    const cookie = cookieFor(user);
    expect((await request(app).get("/api/admin/metrics").set("Cookie", cookie)).status).toBe(200);

    const demoted = await request(app).patch(`/api/admin/staff/${user.id}`).set("Cookie", adminCookie).send({ role: "CUSTOMER" });
    expect(demoted.status).toBe(200);
    expect((await request(app).get("/api/admin/metrics").set("Cookie", cookie)).status).toBe(403);
    expect((await request(app).get("/api/operations/dashboard").set("Cookie", cookie)).status).toBe(403);
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body.user.role).toBe("CUSTOMER");
  });

  it("ignores a role written into the token that the account doesn't have", async () => {
    const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
    const forgedRole = cookieFor(customer, "ADMIN");
    expect((await request(app).get("/api/admin/audit-logs").set("Cookie", forgedRole)).status).toBe(403);
    expect((await request(app).get("/api/seo/admin/integrations").set("Cookie", forgedRole)).status).toBe(403);
    expect((await request(app).get("/api/affiliates/admin").set("Cookie", forgedRole)).status).toBe(403);
  });

  it("promotes an existing account by email and records the previous role", async () => {
    const user = await prisma.user.create({ data: { email: "new.dispatcher@example.com", passwordHash: "x", name: "New Dispatcher", role: "CUSTOMER" } });
    const res = await request(app).post("/api/admin/staff").set("Cookie", adminCookie).send({ email: "NEW.dispatcher@example.com", role: "DISPATCHER" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("DISPATCHER");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: user.id, action: "CHANGE_ROLE" } });
    expect(log.details).toMatchObject({ role: "DISPATCHER", previous: "CUSTOMER" });
    expect((await request(app).post("/api/admin/staff").set("Cookie", adminCookie).send({ email: "nobody.here@example.com", role: "ADMIN" })).status).toBe(404);
  });
});

describe("staff cancellation and refunds", () => {
  it("cancels inside 72 hours, frees the seats and records the refund owed without calling the provider", async () => {
    setPaymentProviderForTests(recordingProvider);
    const { dep, booking } = await paidBooking(1);
    expect(await seats(dep.id)).toBe(2);

    expect((await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", dispatcherCookie).send({ reason: "Road closed", refund: "FULL" })).status).toBe(403);
    expect((await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", adminCookie).send({ refund: "FULL" })).status).toBe(400);

    const res = await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", adminCookie).send({ reason: "Road closed", refund: "POLICY", notifyGuest: false });
    expect(res.status).toBe(200);
    expect(res.body.refundDue).toBe(300);
    expect(refundSpy).toEqual([]);
    expect(await seats(dep.id)).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: booking.id, type: "REFUND_DUE" } });
    expect(flag).toMatchObject({ status: "OPEN", amountCents: 30000 });

    const again = await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", adminCookie).send({ reason: "Road closed", refund: "POLICY" });
    expect(again.status).toBe(409);
    expect(await seats(dep.id)).toBe(0);

    // Refund sent by hand: booking becomes REFUNDED, once.
    const marked = await request(app).post(`/api/admin/flags/${flag.id}/mark-refunded`).set("Cookie", adminCookie).send({ reference: "ETR-5521" });
    expect(marked.status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("REFUNDED");
    expect((await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } })).status).toBe("REFUNDED");
    expect((await request(app).post(`/api/admin/flags/${flag.id}/mark-refunded`).set("Cookie", adminCookie).send({ reference: "ETR-5521" })).status).toBe(409);
  });

  it("refunds a shared tour in full under the policy choice whatever the group size, and nothing on NONE", async () => {
    const { booking } = await paidBooking(2, 7);
    const res = await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", adminCookie).send({ reason: "Group changed plans", refund: "POLICY", notifyGuest: false });
    expect(res.body.paid).toBe(1050);
    expect(res.body.refundOwed).toBe(1050);

    const { booking: other } = await paidBooking(3);
    const none = await request(app).post(`/api/admin/bookings/${other.id}/cancel`).set("Cookie", adminCookie).send({ reason: "No-show", refund: "NONE", notifyGuest: false });
    expect(none.body.refundDue).toBe(0);
    expect(await prisma.bookingFlag.count({ where: { bookingId: other.id } })).toBe(0);
  });

  it("refunds through the provider only when STAFF_REFUNDS_VIA_PROVIDER=true", async () => {
    setPaymentProviderForTests(recordingProvider);
    process.env.STAFF_REFUNDS_VIA_PROVIDER = "true";
    const { booking } = await paidBooking(4);
    const res = await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", adminCookie).send({ reason: "Weather", refund: "FULL", notifyGuest: false });
    expect(res.body.refunded).toBe(300);
    expect(refundSpy).toHaveLength(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("REFUNDED");
    expect(await prisma.bookingFlag.count({ where: { bookingId: booking.id } })).toBe(0);
  });
});

describe("Quick Book", () => {
  it("books for a guest paying cash: confirmed, seats taken, offline payment recorded, never the provider", async () => {
    setPaymentProviderForTests({ ...recordingProvider, createPaymentIntent: () => Promise.reject(new Error("must not be called")) });
    const dep = await departure();
    const body = { ...guest(dep.id, 10), payment: { method: "CASH", reference: "Desk 1" }, notifyGuest: false, idempotencyKey: "quickbook-test-key-0001" };
    expect((await request(app).post("/api/admin/quick-book").set("Cookie", dispatcherCookie).send(body)).status).toBe(403);
    const res = await request(app).post("/api/admin/quick-book").set("Cookie", adminCookie).send(body);
    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe("CONFIRMED");
    expect(await seats(dep.id)).toBe(2);
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: res.body.booking.id } });
    expect(payment).toMatchObject({ provider: "offline", status: "SUCCEEDED", amount: 30000 });

    const replay = await request(app).post("/api/admin/quick-book").set("Cookie", adminCookie).send(body);
    expect(replay.body.booking.id).toBe(res.body.booking.id);
    expect(await seats(dep.id)).toBe(2);
  });

  it("books unpaid with a payment-due flag, then records the payment", async () => {
    const dep = await departure();
    const res = await request(app).post("/api/admin/quick-book").set("Cookie", adminCookie).send({ ...guest(dep.id, 11, 1), payment: { method: "UNPAID" }, notifyGuest: false });
    expect(res.status).toBe(201);
    const bookingId = res.body.booking.id;
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.paymentExpiresAt).toBeNull();
    expect(await prisma.payment.count({ where: { bookingId } })).toBe(0);
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId, type: "PAYMENT_DUE" } });

    const list = await request(app).get("/api/admin/flags?status=OPEN&type=PAYMENT_DUE").set("Cookie", dispatcherCookie);
    expect(list.body.flags.some((f: { id: string }) => f.id === flag.id)).toBe(true);
    expect((await request(app).post(`/api/admin/flags/${flag.id}/resolve`).set("Cookie", adminCookie).send({ resolution: "just close it" })).status).toBe(400);

    const paid = await request(app).post(`/api/admin/flags/${flag.id}/record-payment`).set("Cookie", adminCookie).send({ method: "ETRANSFER", reference: "INT-77" });
    expect(paid.status).toBe(200);
    expect(await prisma.payment.findFirstOrThrow({ where: { bookingId } })).toMatchObject({ status: "SUCCEEDED", amount: 15000, provider: "offline" });
    expect((await request(app).post(`/api/admin/flags/${flag.id}/record-payment`).set("Cookie", adminCookie).send({ method: "CASH" })).status).toBe(409);
  });

  it("still refuses more guests than there are seats", async () => {
    const dep = await departure(2);
    const res = await request(app).post("/api/admin/quick-book").set("Cookie", adminCookie).send({ ...guest(dep.id, 12, 3), payment: { method: "CASH" }, notifyGuest: false });
    expect(res.status).toBe(409);
    expect(await seats(dep.id)).toBe(0);
  });
});

describe("payment flags", () => {
  it("lists a mismatched payment as an open flag that staff can resolve", async () => {
    setPaymentProviderForTests({ ...recordingProvider, async createPaymentIntent(req) { return { clientSecret: "s", intentId: `pi_${req.bookingReference}`, amount: req.amount, currency: req.currency, paid: false }; } });
    const dep = await departure();
    const created = await createBooking(guest(dep.id, 20, 1));
    await confirmPaidBooking(created.booking!.bookingReference, { amount: 1, currency: "CAD", transactionId: "pi_wrong" });
    const flag = await prisma.bookingFlag.findFirstOrThrow({ where: { bookingId: created.booking!.id } });
    expect(flag.type).toBe("PAYMENT_AMOUNT_MISMATCH");

    const resolved = await request(app).post(`/api/admin/flags/${flag.id}/resolve`).set("Cookie", adminCookie).send({ resolution: "Checked in Stripe, test payment" });
    expect(resolved.status).toBe(200);
    expect((await prisma.bookingFlag.findUniqueOrThrow({ where: { id: flag.id } })).status).toBe("RESOLVED");
  });
});

describe("departure management", () => {
  it("adds departures for several dates and times as LOCAL, skipping ones that exist", async () => {
    const body = { tourSlug, dates: ["2028-06-01", "2028-06-02"], times: ["07:00", "13:00"], capacityTotal: 10, price: 199, childPrice: 120 };
    expect((await request(app).post("/api/admin/departures").set("Cookie", dispatcherCookie).send(body)).status).toBe(403);
    const res = await request(app).post("/api/admin/departures").set("Cookie", adminCookie).send(body);
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(4);
    const again = await request(app).post("/api/admin/departures").set("Cookie", adminCookie).send({ ...body, dates: ["2028-06-02", "2028-06-03"] });
    expect(again.body.created).toHaveLength(2);
    expect(again.body.skipped).toBe(2);
    const dep = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: res.body.created[0] } });
    expect(dep).toMatchObject({ inventorySource: "LOCAL", price: 19900, childPrice: 12000, capacityTotal: 10 });

    const list = await request(app).get(`/api/admin/departures?tourSlug=${tourSlug}&from=2028-06-01&to=2028-06-03`).set("Cookie", dispatcherCookie);
    expect(list.body.departures).toHaveLength(6);
  });

  it("won't cut seats below what is booked, and won't cancel a departure with bookings", async () => {
    const { dep, booking } = await paidBooking(30);
    expect((await request(app).patch(`/api/admin/departures/${dep.id}`).set("Cookie", adminCookie).send({ capacityTotal: 1 })).status).toBe(400);
    expect((await request(app).patch(`/api/admin/departures/${dep.id}`).set("Cookie", adminCookie).send({ departureTime: "09:00" })).status).toBe(400);
    const priced = await request(app).patch(`/api/admin/departures/${dep.id}`).set("Cookie", adminCookie).send({ price: 175, capacityTotal: 8 });
    expect(priced.status).toBe(200);
    // Existing bookings keep their price.
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).totalAmount).toBe(30000);

    expect((await request(app).post(`/api/admin/departures/${dep.id}/status`).set("Cookie", adminCookie).send({ status: "CANCELLED" })).status).toBe(409);
    await request(app).post(`/api/admin/bookings/${booking.id}/cancel`).set("Cookie", adminCookie).send({ reason: "Moving guests", refund: "NONE", notifyGuest: false });
    expect((await request(app).post(`/api/admin/departures/${dep.id}/status`).set("Cookie", adminCookie).send({ status: "CANCELLED", reason: "Vehicle repair" })).status).toBe(200);
    expect((await prisma.tourDeparture.findUniqueOrThrow({ where: { id: dep.id } })).status).toBe("CANCELLED");
    const refused = await createBooking(guest(dep.id, 31));
    expect(refused.success).toBe(false);
  });
});

describe("pickup stops", () => {
  it("adds, edits and turns stops off, refusing duplicate names", async () => {
    const stop = { name: "Test Lodge Pickup", town: "Banff", address: "1 Test Ave, Banff", latitude: 51.17, longitude: -115.57, instructions: "Front door" };
    expect((await request(app).post("/api/admin/pickup-stops").set("Cookie", dispatcherCookie).send(stop)).status).toBe(403);
    const created = await request(app).post("/api/admin/pickup-stops").set("Cookie", adminCookie).send(stop);
    expect(created.status).toBe(201);
    expect((await request(app).post("/api/admin/pickup-stops").set("Cookie", adminCookie).send({ ...stop, name: "test lodge pickup" })).status).toBe(409);
    const off = await request(app).patch(`/api/admin/pickup-stops/${created.body.stop.id}`).set("Cookie", adminCookie).send({ isActive: false, instructions: "Side door" });
    expect(off.body.stop).toMatchObject({ isActive: false, instructions: "Side door" });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.body.stop.id, action: "UPDATE_PICKUP_STOP" } });
    expect(log.details).toMatchObject({ before: { isActive: true, instructions: "Front door" } });
  });
});

describe("manifests and the audit log", () => {
  it("lists travelling guests and exports a CSV that a spreadsheet can't run as formulas", async () => {
    const dep = await departure();
    await request(app).post("/api/admin/quick-book").set("Cookie", adminCookie).send({ ...guest(dep.id, 40), customerName: "=HYPERLINK(\"x\")", specialRequests: "Vegetarian, window seat", payment: { method: "UNPAID" }, notifyGuest: false });
    const json = await request(app).get(`/api/admin/departures/${dep.id}/manifest`).set("Cookie", dispatcherCookie);
    expect(json.status).toBe(200);
    expect(json.body.manifest.totals).toMatchObject({ bookings: 1, seats: 2 });
    expect(json.body.manifest.passengers[0].paymentDue).toBe(true);

    const csv = await request(app).get(`/api/admin/departures/${dep.id}/manifest?format=csv`).set("Cookie", dispatcherCookie);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.text).toContain(`"Vegetarian, window seat"`);
  });

  it("filters the audit log by action and pages through it, for admins only", async () => {
    expect((await request(app).get("/api/admin/audit-logs").set("Cookie", dispatcherCookie)).status).toBe(403);
    const res = await request(app).get("/api/admin/audit-logs?action=STAFF_CANCEL").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(res.body.logs.every((l: { action: string }) => l.action === "STAFF_CANCEL")).toBe(true);
    expect(res.body.filters.actions).toContain("STAFF_CANCEL");

    const first = await request(app).get("/api/admin/audit-logs").set("Cookie", adminCookie);
    if (first.body.next) {
      const second = await request(app).get(`/api/admin/audit-logs?before=${first.body.next}`).set("Cookie", adminCookie);
      expect(second.body.logs[0].id).not.toBe(first.body.logs[0].id);
    }
  });
});
