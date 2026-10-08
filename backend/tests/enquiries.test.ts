// Contact form / "Request this tour": validation, honeypot and storage.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "@/app";
import prisma from "@/lib/db/prisma";

let server: Server;
let base = "";

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (body: unknown) =>
  fetch(`${base}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

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

  it("quietly drops bot submissions (honeypot)", async () => {
    const before = await prisma.enquiry.count();
    const res = await post({ name: "Bot", email: "bot@example.com", message: "spam spam", website: "http://spam" });
    expect(res.status).toBe(200);
    expect(await prisma.enquiry.count()).toBe(before);
  });
});
