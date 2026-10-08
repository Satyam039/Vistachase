// Live location opens only with a private tracking token: a booking reference (printed on vouchers
// and emails) must not reveal the vehicle, driver or position, and must not mint a token.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "@/app";
import prisma from "@/lib/db/prisma";
import { getLiveTrackingProvider } from "@/lib/tracking/tracking.provider";

let server: Server;
let base = "";
let reference = "";

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const booking = await prisma.booking.findFirst({ orderBy: { createdAt: "asc" } });
  reference = booking!.bookingReference;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("tracking privacy", () => {
  it("does not open tracking with a booking reference", async () => {
    expect(await getLiveTrackingProvider().getTrackingTelemetry(reference)).toBeNull();
    const res = await fetch(`${base}/api/track/${reference}`);
    expect(res.status).toBe(404);
  });

  it("does not open tracking with a booking id", async () => {
    const booking = await prisma.booking.findUnique({ where: { bookingReference: reference } });
    expect(await getLiveTrackingProvider().getTrackingTelemetry(booking!.id)).toBeNull();
  });

  it("opens tracking with the booking's tracking token until it expires", async () => {
    const token = "a".repeat(64);
    await prisma.booking.update({ where: { bookingReference: reference }, data: { trackingToken: token, trackingTokenExpiresAt: new Date(Date.now() + 60_000) } });
    expect(await getLiveTrackingProvider().getTrackingTelemetry(token)).not.toBeNull();

    await prisma.booking.update({ where: { bookingReference: reference }, data: { trackingTokenExpiresAt: new Date(Date.now() - 60_000) } });
    expect(await getLiveTrackingProvider().getTrackingTelemetry(token)).toBeNull();

    await prisma.booking.update({ where: { bookingReference: reference }, data: { trackingToken: null, trackingTokenExpiresAt: null } });
  });

  it("still serves a booking the caller has verified (concierge after the email check)", async () => {
    expect(await getLiveTrackingProvider().getTelemetryForVerifiedBooking(reference)).not.toBeNull();
  });

  it("keeps the tracking token out of the public booking lookup", async () => {
    await prisma.booking.update({ where: { bookingReference: reference }, data: { trackingToken: "b".repeat(64) } });
    const res = await fetch(`${base}/api/bookings?ref=${reference}`);
    expect(res.status).toBe(200);
    const { booking } = (await res.json()) as { booking: Record<string, unknown> };
    expect(booking.bookingReference).toBe(reference);
    expect(booking).not.toHaveProperty("trackingToken");
    expect(JSON.stringify(booking)).not.toContain("b".repeat(64));
    await prisma.booking.update({ where: { bookingReference: reference }, data: { trackingToken: null } });
  });

  it("refuses to send tracking alerts (and mint tokens) without a staff session", async () => {
    const res = await fetch(`${base}/api/track/${reference}/notify`, { method: "POST" });
    expect(res.status).toBe(403);
    const after = await prisma.booking.findUnique({ where: { bookingReference: reference } });
    expect(after?.trackingToken).toBeNull();
  });
});
