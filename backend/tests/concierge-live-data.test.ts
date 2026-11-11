import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { executeAiTool } from "@/lib/ai/ai.tools";
import { limitAnswer, MAX_ANSWER_WORDS, runConciergeTool, wordLimitPrefix } from "@/lib/ai/concierge.agent";
import { VISTACHASE_STATIC_KNOWLEDGE_BASE } from "@/lib/ai/knowledge.base";

// Owner, 2026-11-11: concierge answers at most 50 words; only the live website's products,
// names, prices and pickups (no old Webflow names); guests can book through the concierge.

const OLD_WEBFLOW_NAMES = ["Our Best Selling Banff Shared Tour", "Standard Banff Private Best Selling Tour", "Heart of Banff", "Icefields Parkway & Jasper", "Multi-Day Canadian Rockies Experience", "Custom Luxury Private Charter"];
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

describe("concierge answer length", () => {
  it("cuts any answer to 50 words, preferring a full sentence", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const out = limitAnswer(long);
    expect(words(out)).toBeLessThanOrEqual(MAX_ANSWER_WORDS);
    expect(out.endsWith(".")).toBe(true);
    expect(limitAnswer("Short answer.")).toBe("Short answer.");
  });

  it("cuts a run-on answer with an ellipsis", () => {
    const out = limitAnswer(Array.from({ length: 80 }, () => "word").join(" "));
    expect(words(out)).toBe(MAX_ANSWER_WORDS);
    expect(out.endsWith("…")).toBe(true);
  });

  it("streams the same prefix the final answer is cut from", () => {
    const text = Array.from({ length: 70 }, (_, i) => `w${i}`).join(" ");
    let streamed = "";
    let raw = "";
    for (const chunk of text.match(/.{1,7}/gs)!) {
      const before = wordLimitPrefix(raw).text;
      raw += chunk;
      streamed += wordLimitPrefix(raw).text.slice(before.length);
    }
    expect(streamed).toBe(wordLimitPrefix(text).text);
    expect(words(streamed)).toBe(MAX_ANSWER_WORDS);
  });

  it("tells the model the 50-word rule", () => {
    expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).toContain("at most 50 words");
    expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).not.toContain("about 80 words");
  });
});

describe("concierge uses the live website's catalog only", () => {
  it("lists tours under their website names, never the old Webflow titles", async () => {
    const r = (await executeAiTool("searchTours", {}, {})) as { success: boolean; data: { title: string; slug: string }[] };
    expect(r.success).toBe(true);
    const titles = r.data.map((t) => t.title).join(" | ");
    for (const old of OLD_WEBFLOW_NAMES) expect(titles).not.toContain(old);
    expect(r.data.map((t) => t.slug)).not.toContain("multi-day-tour-package-for-banff");
  });

  it("finds a doc tour by its website name and leaves out the old Webflow description", async () => {
    const r = (await executeAiTool("searchTours", { query: "Banff & Yoho" }, {})) as { data: { slug: string }[] };
    expect(r.data.map((t) => t.slug)).toContain("banff-highlights-tour");
    const d = (await executeAiTool("getTourDetails", { tourSlugOrBokunId: "banff-private-tour" }, {})) as { data: any };
    expect(d.data.title).toBe("Banff & Yoho Discovery (Private Tour)");
    expect(d.data.inclusions).toBeUndefined();
    expect(d.data.page).toBe("/banff-private-tour");
  });

  it("shows departures under website names", async () => {
    const dep = await prisma.tourDeparture.findFirst({ where: { tour: { slug: "banff-private-tour" }, status: "ACTIVE", date: { gte: new Date() } } });
    if (!dep) return; // seed without departures for this tour
    const r = await runConciergeTool("check_availability", { date: dep.date.toISOString().slice(0, 10), tourSlug: "banff-private-tour" }, {});
    const rows = r.result as { title: string }[];
    for (const row of rows) expect(row.title).toBe("Banff & Yoho Discovery (Private Tour)");
  });

  it("offers the pickup points the checkout offers (database stops, with their ids)", async () => {
    const r = (await executeAiTool("findPickup", { query: "Fairmont Banff Springs" }, {})) as { data: { id: string }[] };
    const stop = await prisma.shuttleStop.findUnique({ where: { id: r.data[0].id } });
    expect(stop?.isActive).toBe(true);
  });

  it("fails instead of inventing tours when the catalog can't be read", async () => {
    const r = (await executeAiTool("searchTours", { category: "NOT_A_CATEGORY" }, {})) as { success: boolean };
    expect(r.success).toBe(false);
  });
});

describe("booking through the concierge", () => {
  it("holds seats and hands over a checkout link carrying the hold and the chosen pickup", async () => {
    const dep = await prisma.tourDeparture.findFirst({
      where: { status: "ACTIVE", date: { gte: new Date(Date.now() + 7 * 864e5) }, inventorySource: "LOCAL", tour: { category: "SHARED", bookingMode: { not: "ENQUIRY" } } },
      orderBy: { date: "asc" },
    });
    if (!dep) return;
    const stop = await prisma.shuttleStop.findFirstOrThrow({ where: { isActive: true } });
    const out = await runConciergeTool(
      "hold_seats",
      { departureId: dep.id, seats: 2, customerName: "Test Guest", customerEmail: "guest@example.com", pickupStopId: stop.id },
      {},
    );
    const result = out.result as { held?: boolean; checkoutUrl?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.held).toBe(true);
    const url = new URL(result.checkoutUrl!, "https://example.com");
    expect(url.pathname).toBe("/book");
    expect(url.searchParams.get("holdToken")).toMatch(/^hold_/);
    expect(url.searchParams.get("pickupStopId")).toBe(stop.id);
    const hold = await prisma.reservationHold.findUnique({ where: { holdToken: url.searchParams.get("holdToken")! } });
    expect(hold?.customerPhone ?? null).toBeNull(); // never the company's own number
    await prisma.reservationHold.delete({ where: { holdToken: hold!.holdToken } });
    await prisma.tourDeparture.update({ where: { id: dep.id }, data: { capacityHeld: { decrement: 2 } } });
  });
});
