// P1 hardening: atomic rate limits, validated and capped seat holds, the T-60 WhatsApp job's
// one-hour window, and the start-up configuration warnings.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { dispatchT60ScheduledBatch } from "@/lib/whatsapp/whatsapp.provider";
import { configWarnings } from "@/lib/config/startup-checks";
import { dateOnly, timeOfDay } from "@/lib/utils/time";

const app = createApp();
const unique = () => crypto.randomBytes(5).toString("hex");
let tourId = "";

/** Banff wall-clock date and time of an instant, as the departure columns store them. */
function mountain(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

async function confirmedBookingAt(at: Date) {
  const { date, time } = mountain(at);
  const dep = await prisma.tourDeparture.create({
    data: { tourId, date: dateOnly(date), departureTime: timeOfDay(time), capacityTotal: 10, capacityBooked: 1, price: 15000, status: "ACTIVE", inventorySource: "LOCAL" },
  });
  return prisma.booking.create({
    data: {
      bookingReference: `VC-T60-${unique()}`,
      customerName: "Pickup Guest",
      customerEmail: `t60.${unique()}@example.com`,
      customerPhone: "+14035550100",
      tourDepartureId: dep.id,
      totalSeats: 1,
      subtotal: 15000,
      totalAmount: 15000,
      status: "CONFIRMED",
      voucherCode: `V-${unique()}`,
    },
  });
}

beforeAll(async () => {
  tourId = (await prisma.tour.findFirstOrThrow({ where: { category: "SHARED" } })).id;
});

describe("rate limiter", () => {
  it("lets exactly the limit through when requests arrive at once", async () => {
    const key = `burst_${unique()}`;
    const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(key, { maxRequests: 5, windowSeconds: 30 })));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.every((r) => r.resetSeconds > 0)).toBe(true);
  });
});

describe("seat holds", () => {
  it("refuses malformed input", async () => {
    for (const body of [
      { departureId: "dep", seatsCount: "abc", customerName: "Al Guest", customerEmail: "a@example.com" },
      { departureId: "dep", seatsCount: 500, customerName: "Al Guest", customerEmail: "a@example.com" },
      { departureId: "dep", seatsCount: 2, customerName: "Al Guest", customerEmail: "not-an-email" },
    ]) {
      expect((await request(app).post("/api/reservations/hold").send(body)).status).toBe(400);
    }
    expect((await request(app).get("/api/reservations/hold?token=../../x")).status).toBe(400);
  });

  it("caps active holds per email", async () => {
    const day = mountain(new Date(Date.now() + 40 * 86_400_000)).date;
    const dep = await prisma.tourDeparture.create({
      data: { tourId, date: dateOnly(day), departureTime: timeOfDay("09:00"), capacityTotal: 20, price: 15000, status: "ACTIVE", inventorySource: "LOCAL" },
    });
    const email = `holder.${unique()}@example.com`;
    const hold = () => request(app).post("/api/reservations/hold").send({ departureId: dep.id, seatsCount: 1, customerName: "Hold Er", customerEmail: email });
    for (let i = 0; i < 3; i++) expect((await hold()).status).toBe(200);
    expect((await hold()).status).toBe(429);
  });
});

describe("T-60 WhatsApp job", () => {
  it("messages only guests picked up within the next hour, once", async () => {
    const soon = await confirmedBookingAt(new Date(Date.now() + 30 * 60_000));
    const later = await confirmedBookingAt(new Date(Date.now() + 3 * 60 * 60_000));

    await dispatchT60ScheduledBatch();
    const sent = async (bookingId: string) => prisma.whatsAppNotification.count({ where: { bookingId, type: "T_60_TRACKING" } });
    expect(await sent(soon.id)).toBe(1);
    expect(await sent(later.id)).toBe(0);

    await dispatchT60ScheduledBatch(); // the next 5-minute run
    expect(await sent(soon.id)).toBe(1);
  });
});

describe("start-up configuration warnings", () => {
  it("flags the example JWT secret, Stripe test mode, missing email and WhatsApp", () => {
    const warnings = configWarnings({
      NODE_ENV: "production",
      JWT_SECRET: "super-secret-jwt-token-vista-chase-rockies-2026-development-only",
      STRIPE_SECRET_KEY: "sk_test_123",
      FRONTEND_URL: "http://13.50.3.165",
    });
    const text = warnings.join("\n");
    expect(text).toContain("JWT_SECRET is the example value");
    expect(text).toContain("TEST mode");
    expect(text).toContain("STRIPE_WEBHOOK_SECRET");
    expect(text).toContain("Email is not being sent");
    expect(text).toContain("WHATSAPP_PROVIDER");
  });

  it("is quiet for a complete production setup", () => {
    expect(
      configWarnings({
        NODE_ENV: "production",
        JWT_SECRET: "x".repeat(48),
        VOUCHER_SECRET: "y".repeat(48),
        STRIPE_SECRET_KEY: "sk_live_123",
        STRIPE_WEBHOOK_SECRET: "whsec_1",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_1",
        WHATSAPP_PROVIDER: "twilio",
        FRONTEND_URL: "https://www.vistachase.com",
      }),
    ).toEqual([]);
  });

  it("accepts an SMTP mailbox (Gmail) instead of Resend, and names what SMTP lacks", () => {
    const base = {
      NODE_ENV: "production",
      JWT_SECRET: "x".repeat(48),
      VOUCHER_SECRET: "y".repeat(48),
      STRIPE_SECRET_KEY: "sk_live_123",
      STRIPE_WEBHOOK_SECRET: "whsec_1",
      WHATSAPP_PROVIDER: "twilio",
      FRONTEND_URL: "https://www.vistachase.com",
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "support@vistachase.com",
    };
    expect(configWarnings({ ...base, SMTP_PASS: "app-password" })).toEqual([]);
    expect(configWarnings(base).join(" ")).toContain("EMAIL_PROVIDER=smtp without SMTP_HOST, SMTP_USER and SMTP_PASS");
  });
});
