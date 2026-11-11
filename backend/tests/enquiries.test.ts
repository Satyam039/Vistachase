// Contact form / "Request this tour": validation, honeypot and storage.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "@/app";
import prisma from "@/lib/db/prisma";
import { issueFormToken } from "@/modules/enquiries/spam";

let server: Server;
let base = "";

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// A form opened 10 seconds ago, as the contact form sends it.
const ip = () => [0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".");
const formToken = () => issueFormToken(Date.now() - 10_000);
const post = (body: Record<string, unknown>, withToken = true) =>
  fetch(`${base}/api/enquiries`, {
    method: "POST",
    // Each call from its own address, so the per-IP limit (5 per 10 minutes) doesn't interfere.
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.${ip()}` },
    body: JSON.stringify(withToken ? { formToken: formToken(), ...body } : body),
  });

describe("POST /api/enquiries", () => {
  it("rejects incomplete messages", async () => {
    const res = await post({ name: "A", email: "not-an-email", message: "" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { fields: Record<string, unknown> };
    expect(json.fields).toHaveProperty("email");
  });

  it("stores a tour request", async () => {
    const res = await post({
      name: "Test Guest",
      email: "guest@example.com",
      tourSlug: "banff-private-tour",
      guests: 4,
      date: "2027-07-14",
      message: "Private tour for our family, please.",
    });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const saved = await prisma.enquiry.findUnique({ where: { id } });
    expect(saved).toMatchObject({ name: "Test Guest", tourSlug: "banff-private-tour", guests: 4, status: "NEW" });
  });

  it("takes a From and To date (Plan your trip, owner 2026-11-06)", async () => {
    const res = await post({ name: "Test Guest", email: "guest@example.com", guests: 2, date: "2027-07-14", toDate: "2027-07-18", message: "Planning a week in the Rockies." });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const saved = await prisma.enquiry.findUniqueOrThrow({ where: { id } });
    expect(saved.date?.toISOString().slice(0, 10)).toBe("2027-07-14");
    expect(saved.message).toContain("Trip dates: from 2027-07-14 to 2027-07-18");

    const backwards = await post({ name: "Test Guest", email: "guest@example.com", date: "2027-07-14", toDate: "2027-07-10", message: "Backwards dates here." });
    expect(backwards.status).toBe(400);
    expect(((await backwards.json()) as { fields: Record<string, unknown> }).fields).toHaveProperty("toDate");
  });

  it("refuses past trip dates and more than 28 guests (owner 2026-11-11)", async () => {
    const past = await post({ name: "Test Guest", email: "past@example.com", guests: 2, date: "1970-05-31", toDate: "1970-05-31", message: "Old dates please." });
    expect(past.status).toBe(400);
    expect(((await past.json()) as { fields: Record<string, unknown> }).fields).toHaveProperty("date");
    const big = await post({ name: "Test Guest", email: "big@example.com", guests: 49, date: "2027-07-14", message: "A very big group." });
    expect(big.status).toBe(400);
    expect(((await big.json()) as { fields: Record<string, unknown> }).fields).toHaveProperty("guests");
    const ok = await post({ name: "Test Guest", email: "group@example.com", guests: 28, date: "2027-07-14", message: "A group of 28." });
    expect(ok.status).toBe(201);
  });

  it("quietly drops the 11 Nov fake enquiry and form-less posts", async () => {
    const before = await prisma.enquiry.count();
    const fake = await post({ name: "cHXwtVPyDCAWVGSEFGhh", email: "spat2016@aol.com", phone: "+1 4370445537", guests: 20, date: "2027-05-31", message: "8054958299" });
    expect(fake.status).toBe(201);
    const digitsOnly = await post({ name: "Real Person", email: "digits@example.com", guests: 2, date: "2027-05-31", message: "8054958299" });
    expect(digitsOnly.status).toBe(201);
    const noToken = await post({ name: "Real Person", email: "notoken@example.com", guests: 2, date: "2027-05-31", message: "Hello there, a question." }, false);
    expect(noToken.status).toBe(201);
    const tooFast = await post({ formToken: issueFormToken(Date.now()), name: "Real Person", email: "fast@example.com", guests: 2, date: "2027-05-31", message: "Hello there, a question." });
    expect(tooFast.status).toBe(201);
    const forged = await post({ formToken: `${Date.now() - 10_000}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, name: "Real Person", email: "forged@example.com", message: "Hello there, a question." });
    expect(forged.status).toBe(201);
    expect(await prisma.enquiry.count()).toBe(before);
  });

  it("hands out a form token", async () => {
    const res = await fetch(`${base}/api/enquiries/form-token`);
    const json = (await res.json()) as { token: string; turnstile: boolean };
    expect(json.token).toMatch(/^\d+\.[\w-]{32}$/);
    expect(json.turnstile).toBe(false);
  });

  it("quietly drops bot submissions (honeypot)", async () => {
    const before = await prisma.enquiry.count();
    const res = await post({ name: "Bot", email: "bot@example.com", message: "spam spam", website: "http://spam" });
    expect(res.status).toBe(201);
    expect(await prisma.enquiry.count()).toBe(before);
  });
});
