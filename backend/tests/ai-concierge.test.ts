import { describe, it, expect } from "vitest";
import { MockAIProvider } from "@/lib/ai/ai.provider";
import { getMapsProvider } from "@/lib/maps/maps.provider";

describe("Phase 7: AI Rockies Travel Concierge & Voice Reservation Engine", () => {
  const aiProvider = new MockAIProvider();
  const mapsProvider = getMapsProvider();

  it("STRICT SAFETY GUARDRAIL: immediately rejects payment card details over voice/chat", async () => {
    // Test 16-digit card
    const cardRes = await aiProvider.chat([
      { role: "user", content: "My card number is 4532 1234 5678 9012 and CVV is 123" },
    ]);
    expect(cardRes.hasSafetyRefusal).toBe(true);
    expect(cardRes.message).toContain("cannot collect or process payment card details");

    // Test card keywords
    const cvvRes = await aiProvider.chat([
      { role: "user", content: "Can I pay by Visa with expiration date 12/28?" },
    ]);
    expect(cvvRes.hasSafetyRefusal).toBe(true);
    expect(cvvRes.message).toContain("secure checkout link to review and finalize your payment");
  });

  it("answers Canadian Rockies access inquiries and triggers availability tool", async () => {
    const res = await aiProvider.chat([
      { role: "user", content: "Can I drive my own car to Moraine Lake or do I need a shuttle?" },
    ]);

    expect(res.message).toContain("Private vehicles are prohibited on Moraine Lake Road");
    expect(res.toolCalls).toBeDefined();
    expect(res.toolCalls?.some((t) => t.name === "checkAvailability")).toBe(true);
  });

  it("identifies Banff hotel pickup stops via maps tool integration", async () => {
    const res = await aiProvider.chat([
      { role: "user", content: "Do you offer hotel pickup at Fairmont Banff Springs?" },
    ]);

    expect(res.message).toContain("over 25 premier hotels");
    expect(res.toolCalls?.some((t) => t.name === "findPickup")).toBe(true);

    // Verify maps provider finds Fairmont
    const stops = await mapsProvider.searchPickups("Fairmont Banff Springs");
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0].name).toContain("Fairmont Banff Springs");
  });

  it("initiates safe voice reservation hold without collecting payment", async () => {
    const res = await aiProvider.chat([
      { role: "user", content: "Please hold 2 seats for me on the morning tour" },
    ]);

    expect(res.message).toContain("10-minute reservation hold");
    expect(res.message).toContain("will not take your payment over voice");
    expect(res.toolCalls?.some((t) => t.name === "createVoiceReservationHold")).toBe(true);
  });
});
