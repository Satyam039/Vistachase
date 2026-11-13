// The concierge's product knowledgebase (lib/ai/knowledge): every entry is a live website product,
// prices and times come from the live departures, recommendations fit the guest's date, party and
// style, and the concierge asks before it recommends.

import { describe, it, expect, beforeAll } from "vitest";
import prisma from "@/lib/db/prisma";
import { WEBSITE_CATALOG } from "@/lib/ai/knowledge/website-catalog";
import { recommendTours, renderCatalogKnowledge, resetLiveCatalog, tourDetail } from "@/lib/ai/knowledge/catalog-live";
import { conciergeTours } from "@/modules/tours/product-map";
import { WEBSITE_NAMES } from "@/lib/ai/concierge.catalog";
import { answerWithoutModel, preferencesIn } from "@/lib/ai/concierge.fallback";
import { runConciergeTool } from "@/lib/ai/concierge.agent";
import { VISTACHASE_STATIC_KNOWLEDGE_BASE } from "@/lib/ai/knowledge.base";
import { dateOnly, timeOfDay } from "@/lib/utils/time";
import type { ChatMessage, SessionState } from "@/lib/ai/ai.provider";

const ctx = { isStaff: false };

async function departure(slug: string, date: string, time: string, price: number, capacity = 12) {
  const tour = await prisma.tour.findUniqueOrThrow({ where: { slug } });
  return prisma.tourDeparture.create({
    data: { inventorySource: "LOCAL", tourId: tour.id, date: dateOnly(date), departureTime: timeOfDay(time), capacityTotal: capacity, capacityBooked: 0, capacityHeld: 0, price: price * 100, status: "ACTIVE" },
  });
}

beforeAll(async () => {
  // Summer 2027 for the shared Banff tour and the private Banff tour; winter 2027 for the winter tour.
  await departure("banff-highlights-tour", "2027-07-14", "08:00", 220);
  await departure("banff-highlights-tour", "2027-07-15", "08:00", 220);
  await departure("banff-private-tour", "2027-07-14", "08:00", 1750, 14);
  await departure("banff-private-tour", "2027-01-20", "08:00", 1240, 14);
  await departure("winter-special", "2027-01-20", "08:00", 199);
  await departure("full-day-at-lake-louise-and-moraine-lake", "2027-07-14", "06:30", 120, 14);
  resetLiveCatalog();
});

describe("product knowledgebase", () => {
  it("lists only products the website sells, by their website names", async () => {
    const listed = await prisma.tour.findMany({ where: conciergeTours(), select: { slug: true } });
    const slugs = new Set(listed.map((t) => t.slug));
    for (const p of WEBSITE_CATALOG.filter((p) => p.bookIn === "chat")) {
      expect(slugs.has(p.slug), `${p.slug} is on sale`).toBe(true);
      if (WEBSITE_NAMES[p.slug]) expect(p.name.replace(/ – /, " — ")).toContain(WEBSITE_NAMES[p.slug].split(" (")[0].replace(/ – /, " — ").split(" — ")[0]);
    }
    for (const p of WEBSITE_CATALOG) {
      expect(p.page.startsWith("/")).toBe(true);
      expect(p.image.startsWith("/media/")).toBe(true);
      expect(p.overview.length).toBeGreaterThan(40);
    }
  });

  it("puts live prices and departure times in the concierge's knowledge, never old Webflow names", async () => {
    const text = await renderCatalogKnowledge();
    expect(text).toContain("### Banff & Yoho Discovery [slug: banff-highlights-tour]");
    expect(text).toMatch(/Banff & Yoho Discovery – Private[^#]*CAD \$1,750 per vehicle June 1–Oct 10/);
    expect(text).toContain("8:00 AM");
    expect(text).not.toContain("Our Best Selling Banff Shared Tour");
    expect(text).not.toContain("Standard Banff Private Best Selling Tour");
    expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).not.toMatch(/up to 24/);
  });

  it("recommends only tours that run on the date with room for the party", async () => {
    const summer = await recommendTours({ date: "2027-07-14", guests: 2, style: "shared" });
    expect(summer.cards.map((c) => c.slug)).toContain("banff-highlights-tour");
    expect(summer.cards.map((c) => c.slug)).not.toContain("winter-special");
    expect(summer.cards.every((c) => c.type === "SHARED")).toBe(true);
    const card = summer.cards.find((c) => c.slug === "banff-highlights-tour")!;
    expect(card.departures[0]).toMatchObject({ date: "2027-07-14", time: "08:00", price: 220 });
    expect(card.image).toMatch(/^\/media\//);

    const winter = await recommendTours({ date: "2027-01-20", guests: 2, style: "shared", days: 1 });
    expect(winter.cards.map((c) => c.slug)).toContain("winter-special");
    expect(winter.cards.map((c) => c.slug)).not.toContain("full-day-at-lake-louise-and-moraine-lake");

    const big = await recommendTours({ date: "2027-07-14", guests: 13, style: "private", days: 1 });
    expect(big.cards.map((c) => c.slug)).toEqual(["banff-private-tour"]);
    expect(big.reasonsLeftOut.join(" ")).toMatch(/up to 6 guests/);
  });

  it("opens one tour with its stops, inclusions, pickup and next dates", async () => {
    const d = await tourDetail("banff-highlights-tour", { date: "2027-07-14", guests: 2 });
    expect(d?.stops[0]).toMatch(/Lake Louise/);
    expect(d?.included).toContain("Bottled water");
    expect(d?.pickup).toMatch(/Canmore/);
    expect(d?.departures.length).toBeGreaterThan(0);
    const out = await runConciergeTool("get_tour_details", { slug: "banff-highlights-tour", date: "2027-07-14" }, ctx);
    expect((out.card?.data as { type: string }).type).toBe("tour");
  });
});

describe("the concierge asks before it recommends", () => {
  it("reads what the guest says about the trip", () => {
    expect(preferencesIn("We're a family of 4 going private in July 2028", undefined, "2026-11-12")).toMatchObject({ guests: 4, style: "private", date: "2028-07-01", windowDays: 31 });
    expect(preferencesIn("3", "guests").guests).toBe(3);
    expect(preferencesIn("Show me all", "style").style).toBe("any");
    expect(preferencesIn("I may come back", undefined).date).toBeUndefined();
  });

  it("asks date, then guests, then style, one at a time, then shows matching cards", async () => {
    const chat: ChatMessage[] = [];
    let state: SessionState | undefined;
    const say = async (text: string) => {
      chat.push({ role: "user", content: text });
      const r = await answerWithoutModel(chat, state, ctx);
      chat.push({ role: "assistant", content: r.message });
      state = r.sessionState;
      return r;
    };
    const first = await say("Can you recommend a tour?");
    expect(first.message).toMatch(/When are you travelling/);
    expect(first.data).toBeUndefined();
    const second = await say("July 14 2027");
    expect(second.message).toMatch(/How many people/);
    expect((second.data as { type: string }).type).toBe("choices");
    const third = await say("2 guests");
    expect(third.message).toMatch(/shared small-group tour, a private tour/);
    const fourth = await say("Shared small-group tour");
    expect(fourth.message).toMatch(/single day tour, or a multi-day trip/);
    expect((fourth.data as { options: string[] }).options).toEqual(["One day", "2 days", "Not sure"]);
    const fifth = await say("One day");
    const data = fifth.data as { type: string; tours: { slug: string }[] };
    expect(data.type).toBe("tours");
    expect(data.tours.map((t) => t.slug)).toContain("banff-highlights-tour");
    expect(data.tours.map((t) => t.slug)).not.toContain("winter-special");

    const opened = await say("Show me the tour: Banff & Yoho Discovery");
    expect((opened.data as { type: string }).type).toBe("tour");
    expect(opened.message).toMatch(/Banff & Yoho Discovery/);
    expect(opened.message).toMatch(/Book/);
  });

  it("offers the multi-day lengths that run then, and books a package in the chat", async () => {
    expect(preferencesIn("Not sure", "days").days).toBe(0);
    const chat: ChatMessage[] = [];
    let state: SessionState | undefined;
    const say = async (text: string) => {
      chat.push({ role: "user", content: text });
      const r = await answerWithoutModel(chat, state, ctx);
      chat.push({ role: "assistant", content: r.message });
      state = r.sessionState;
      return r;
    };
    await say("Can you recommend a tour?");
    await say("July 2027");
    await say("4 guests");
    const days = await say("Private tour");
    expect((days.data as { options: string[] }).options).toEqual(["One day", "2 days", "3 days", "4 days", "Not sure"]);
    const opened = await say("Show me the tour: Three-Day Rockies Discovery – Private");
    expect((opened.data as { type: string; tourDetail: { bookIn: string } }).tourDetail.bookIn).toBe("page");
    expect(opened.message).toMatch(/Choose dates and book/);
    expect(opened.message).not.toMatch(/own page/);
  });

  it("answers everything in one message at once", async () => {
    const r = await answerWithoutModel([{ role: "user", content: "Please suggest a private tour for 13 people on 2027-07-14" }], undefined, ctx);
    const data = r.data as { type: string; tours: { slug: string }[] };
    expect(data.type).toBe("tours");
    expect(data.tours.map((t) => t.slug)).toContain("banff-private-tour");
  });
});
