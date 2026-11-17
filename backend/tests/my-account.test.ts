// My Account (/account/settings): first/last name and phone, email change confirmed from the new
// inbox, password change (other sign-ins end), sign out everywhere, and account deletion (refused
// while trips are upcoming; past bookings are kept but unlinked).

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { hashPassword, signToken } from "@/lib/auth/auth";
import { createBooking } from "@/modules/bookings/booking.repository";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const app = createApp();
const unique = () => crypto.randomBytes(5).toString("hex");
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const PASSWORD = "correct horse 42";
let tourId = "";
// The account routes are rate limited per IP: give each request its own address.
const ip = () => `10.${crypto.randomInt(255)}.${crypto.randomInt(255)}.${crypto.randomInt(1, 255)}`;
const api = {
  patch: (url: string) => request(app).patch(url).set("X-Forwarded-For", ip()),
  post: (url: string) => request(app).post(url).set("X-Forwarded-For", ip()),
  delete: (url: string) => request(app).delete(url).set("X-Forwarded-For", ip()),
};
let day = 0;

const cookieFor = (u: { id: string; email: string; role: string; name: string }, iat?: number) =>
  `vc_token=${
    iat === undefined
      ? signToken({ userId: u.id, email: u.email, role: u.role as never, name: u.name })
      : jwt.sign({ userId: u.id, email: u.email, role: u.role, name: u.name, iat }, process.env.JWT_SECRET!, { expiresIn: "7d" })
  }`;

async function customer(extra: Partial<{ emailVerified: boolean; role: "CUSTOMER" | "OPERATOR" }> = {}) {
  return prisma.user.create({
    data: { email: `acct.${unique()}@example.com`, name: "Asha Verma", passwordHash: await hashPassword(PASSWORD), role: "CUSTOMER", emailVerified: true, ...extra },
  });
}

async function bookingOn(date: string, email: string, customerId?: string) {
  day += 1;
  // Booked on a future date, then moved to `date` (a past date can't be booked).
  const dep = await prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(`2029-0${(day % 9) + 1}-1${day % 9}`), departureTime: timeOfDay(`0${day % 9}:15`), capacityTotal: 10, price: 15000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
  const result = await createBooking({ departureId: dep.id, customerName: "Asha Verma", customerEmail: email, customerPhone: "+1 403 555 0100", adultsCount: 1, childrenCount: 0, infantsCount: 0 });
  expect(result.booking).toBeTruthy();
  await prisma.tourDeparture.update({ where: { id: dep.id }, data: { date: dateOnly(date) } });
  if (customerId) await prisma.booking.update({ where: { id: result.booking!.id }, data: { customerId } });
  return result.booking!;
}

beforeAll(async () => {
  tourId = (await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } })).id;
});

describe("personal information and phone", () => {
  it("saves first and last name as one name and validates the phone", async () => {
    const u = await customer();
    const cookie = cookieFor(u);

    const ok = await api.patch("/api/account/profile").set("Cookie", cookie).send({ firstName: "  Nishika ", lastName: "Sharma  Rao" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe("Nishika Sharma Rao");

    expect((await api.patch("/api/account/profile").set("Cookie", cookie).send({ firstName: "", lastName: "X" })).status).toBe(400);
    expect((await api.patch("/api/account/profile").set("Cookie", cookie).send({ phone: "<b>call me</b>" })).status).toBe(400);
    expect((await api.patch("/api/account/profile").set("Cookie", cookie).send({ phone: "12345" })).status).toBe(400);

    const phone = await api.patch("/api/account/profile").set("Cookie", cookie).send({ phone: "+1 (403) 555-0199" });
    expect(phone.status).toBe(200);
    expect(phone.body.user.phone).toBe("+1 (403) 555-0199");
  });

  it("needs a sign-in", async () => {
    expect((await api.patch("/api/account/profile").send({ firstName: "A" })).status).toBe(401);
  });
});

describe("email change", () => {
  it("stays pending until the link from the new inbox is opened, can be cancelled, and keeps the old email's trips", async () => {
    const u = await customer();
    const cookie = cookieFor(u);
    const guest = await bookingOn("2027-01-05", u.email); // made as a guest with the old address
    const newEmail = `new.${unique()}@example.com`;

    // Pending: nothing changes yet.
    await prisma.user.update({ where: { id: u.id }, data: { pendingEmail: newEmail, emailChangeToken: sha256("a".repeat(64)), emailChangeExpiry: new Date(Date.now() + 3600_000) } });
    expect((await request(app).get("/api/account/profile").set("Cookie", cookie)).body.user.email).toBe(u.email);

    // Cancelled: the link no longer works.
    expect((await api.delete("/api/account/change-email").set("Cookie", cookie)).status).toBe(200);
    expect((await api.post("/api/account/verify-email-change").send({ token: "a".repeat(64) })).status).toBe(400);

    // Confirmed from the new inbox.
    const token = "b".repeat(64);
    await prisma.user.update({ where: { id: u.id }, data: { pendingEmail: newEmail, emailChangeToken: sha256(token), emailChangeExpiry: new Date(Date.now() + 3600_000) } });
    const done = await api.post("/api/account/verify-email-change").send({ token });
    expect(done.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.email).toBe(newEmail);
    expect(after.pendingEmail).toBeNull();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: guest.id } })).customerId).toBe(u.id);
  });

  it("refuses the switch if another account took the address meanwhile", async () => {
    const u = await customer();
    const other = await customer();
    const token = "c".repeat(64);
    await prisma.user.update({ where: { id: u.id }, data: { pendingEmail: other.email, emailChangeToken: sha256(token), emailChangeExpiry: new Date(Date.now() + 3600_000) } });
    const res = await api.post("/api/account/verify-email-change").send({ token });
    expect(res.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe(u.email);
  });
});

describe("account security", () => {
  it("changes the password with the current one, ends other sign-ins and keeps this one", async () => {
    const u = await customer();
    const oldCookie = cookieFor(u, Math.floor(Date.now() / 1000) - 60);

    expect((await api.post("/api/account/password").set("Cookie", oldCookie).send({ currentPassword: "wrong", newPassword: "new password 1" })).status).toBe(401);
    expect((await api.post("/api/account/password").set("Cookie", oldCookie).send({ currentPassword: PASSWORD, newPassword: "short" })).status).toBe(400);

    const res = await api.post("/api/account/password").set("Cookie", oldCookie).send({ currentPassword: PASSWORD, newPassword: "new password 1" });
    expect(res.status).toBe(200);
    const fresh = String(res.headers["set-cookie"]).match(/vc_token=[^;]+/)![0];

    expect((await request(app).get("/api/account/profile").set("Cookie", oldCookie)).status).toBe(401);
    expect((await request(app).get("/api/account/profile").set("Cookie", fresh)).status).toBe(200);
  });

  it("signs out every device", async () => {
    const u = await customer();
    const cookie = cookieFor(u);
    expect((await api.post("/api/account/sign-out-everywhere").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/api/account/profile").set("Cookie", cookie)).status).toBe(401);
  });
});

describe("delete account", () => {
  it("needs the password and the word DELETE, and staff can't delete themselves here", async () => {
    const u = await customer();
    const cookie = cookieFor(u);
    expect((await api.delete("/api/account").set("Cookie", cookie).send({ password: PASSWORD })).status).toBe(400);
    expect((await api.delete("/api/account").set("Cookie", cookie).send({ password: "wrong", confirm: "DELETE" })).status).toBe(401);

    const staff = await customer({ role: "OPERATOR" });
    expect((await api.delete("/api/account").set("Cookie", cookieFor(staff)).send({ password: PASSWORD, confirm: "DELETE" })).status).toBe(403);
  });

  it("is refused while a trip is upcoming", async () => {
    const u = await customer();
    const b = await bookingOn("2028-08-10", u.email, u.id);
    const res = await api.delete("/api/account").set("Cookie", cookieFor(u)).send({ password: PASSWORD, confirm: "DELETE" });
    expect(res.status).toBe(409);
    expect(res.body.upcoming).toContain(b.bookingReference);
    expect(await prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
  });

  it("deletes the account, keeps past bookings unlinked, and the sign-in stops working", async () => {
    const u = await customer();
    const cookie = cookieFor(u);
    const past = await bookingOn("2025-06-01", u.email, u.id);
    const cancelled = await bookingOn("2028-09-01", u.email, u.id);
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });

    const res = await api.delete("/api/account").set("Cookie", cookie).send({ password: PASSWORD, confirm: "delete" });
    expect(res.status).toBe(200);

    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: past.id } });
    expect(kept.customerId).toBeNull();
    expect(kept.bookingReference).toBe(past.bookingReference);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "ACCOUNT_DELETED_BY_CUSTOMER", entityId: u.id } });
    expect(JSON.stringify(log.details)).not.toContain(u.email);
    expect((await request(app).get("/api/account/profile").set("Cookie", cookie)).status).toBe(401);
  });
});
