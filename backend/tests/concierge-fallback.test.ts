// The concierge without an AI key: every answer comes from the booking data or the published
// policy, follow-ups keep the tour in context, and it says so when it can't answer.
// Also covers "Chat with a live agent" (POST /api/concierge/handoff).

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "@/lib/db/prisma";
import { createApp } from "@/app";
import { answerWithoutModel, mentionedDate } from "@/lib/ai/concierge.fallback";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import type { SessionState } from "@/lib/ai/ai.provider";

const ctx = { isStaff: false };
const ask = (content: string, state?: SessionState, language?: string) => answerWithoutModel([{ role: "user", content }], state, ctx, language);
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

let shared: { slug: string; title: string };

beforeAll(async () => {
  shared = await prisma.tour.findFirstOrThrow({ where: { category: "SHARED", basePrice: { gt: 0 } }, select: { id: true, slug: true, title: true } }).then(async (t) => {
    await prisma.tourDeparture.create({
      data: { inventorySource: "LOCAL", tourId: t.id, date: dateOnly("2027-06-17"), departureTime: timeOfDay("08:30"), capacityTotal: 12, capacityBooked: 0, capacityHeld: 0, price: 18900, status: "ACTIVE" },
    });
    return t;
  });
});

describe("concierge without an AI model", () => {
  it("reads dates the way guests write them", () => {
    expect(mentionedDate("tomorrow please", "2026-10-27")).toBe("2026-10-28");
    expect(mentionedDate("June 3rd", "2026-10-27")).toBe("2027-06-03");
    expect(mentionedDate("on 12 November", "2026-10-27")).toBe("2026-11-12");
    expect(mentionedDate("2027-07-01", "2026-10-27")).toBe("2027-07-01");
    expect(mentionedDate("I may come back", "2026-10-27")).toBeNull();
  });

  it("gives a different, data-backed answer to each question", async () => {
    const privateTour = await prisma.tour.findFirstOrThrow({ where: { category: "PRIVATE", basePrice: { gt: 0 }, title: { contains: "Jasper" } } });
    const price = await ask("How much is the private Jasper tour?");
    expect(price.message).toContain(privateTour.title);
    expect(price.message).toContain(money(privateTour.basePrice));

    const pickup = await ask("Do you pick up from the Moxy Banff?");
    expect(pickup.message).toContain("Moxy Banff");

    const policy = await ask("Can I get a refund if I cancel?");
    expect(policy.message).toContain("72 hours");

    expect(new Set([price.message, pickup.message, policy.message]).size).toBe(3);
  });

  it("keeps the tour in context for follow-ups", async () => {
    const first = await ask("Tell me about the private Jasper tour");
    const slug = first.sessionState?.tourSlug;
    expect(slug).toBeTruthy();
    const tour = await prisma.tour.findUniqueOrThrow({ where: { slug: slug! } });

    const followUp = await answerWithoutModel(
      [
        { role: "user", content: "Tell me about the private Jasper tour" },
        { role: "assistant", content: first.message },
        { role: "user", content: "how much is it?" },
      ],
      first.sessionState,
      ctx,
    );
    expect(followUp.message).toContain(tour.title);
    expect(followUp.message).toContain(money(tour.basePrice));
  });

  it("checks real seats for the tour being discussed", async () => {
    const res = await ask("Any seats on 2027-06-17?", { tourSlug: shared.slug });
    expect(res.message).toContain("2027-06-17 at 08:30");
    expect(res.message).toContain("12 seats left");
    expect(res.data?.type).toBe("availability");

    const none = await ask("What about 2027-06-18?", { tourSlug: shared.slug });
    expect(none.message).toContain("can't find free seats");
  });

  it("hands over the real checkout link for a chosen departure, without claiming a hold", async () => {
    const res = await ask("I choose the departure on 2027-06-17 at 08:30", { tourSlug: shared.slug });
    expect(res.message).toMatch(/\/book\?departureId=\w+/);
    expect(res.checkoutUrl).toBeUndefined();
  });

  it("needs both the booking reference and the email", async () => {
    const first = await ask("What's the status of VC-2026-ABCDEFGH?");
    expect(first.message).toContain("What email address");
    const second = await answerWithoutModel(
      [
        { role: "user", content: "What's the status of VC-2026-ABCDEFGH?" },
        { role: "assistant", content: first.message },
        { role: "user", content: "someone@example.com" },
      ],
      first.sessionState,
      ctx,
    );
    expect(second.message).toContain("No booking matches");
  });

  it("says plainly when it doesn't know, and offers a live agent", async () => {
    const res = await ask("Is the gelato shop on Banff Avenue open on Sundays?");
    expect(res.message).toContain("I don't have reliable information");
    expect(res.data?.type).toBe("handoff");
  });

  it("refuses card details", async () => {
    const res = await ask("My card is 4111 1111 1111 1111");
    expect(res.hasSafetyRefusal).toBe(true);
  });

  it("says once that other languages need the AI assistant", async () => {
    const first = await ask("hello", undefined, "fr");
    expect(first.message).toContain("Replies in French need the full AI assistant");
    const again = await ask("hello", first.sessionState, "fr");
    expect(again.message).not.toContain("Replies in French");
  });
});

describe("POST /api/concierge/handoff", () => {
  it("needs a name and a valid email", async () => {
    const res = await request(createApp()).post("/api/concierge/handoff").send({ name: "A", email: "nope", transcript: [] });
    expect(res.status).toBe(400);
  });

  it("sends the conversation to the support team as an enquiry", async () => {
    const res = await request(createApp())
      .post("/api/concierge/handoff")
      .send({
        name: "Handoff Guest",
        email: "handoff@example.com",
        note: "Need wheelchair access",
        language: "de",
        transcript: [
          { role: "user", content: "Can the van take a wheelchair? My card is 4111 1111 1111 1111" },
          { role: "assistant", content: "I don't have reliable information to answer that here." },
        ],
      });
    expect(res.status).toBe(201);
    const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(enquiry.email).toBe("handoff@example.com");
    expect(enquiry.message).toContain("Live agent request from the AI concierge");
    expect(enquiry.message).toContain("Language chosen: German");
    expect(enquiry.message).toContain("Guest: Can the van take a wheelchair?");
    expect(enquiry.message).not.toContain("4111");
  });
});
