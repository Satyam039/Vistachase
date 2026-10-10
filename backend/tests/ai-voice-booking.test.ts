import { describe, it, expect } from "vitest";
import { MockAIProvider, ChatMessage } from "@/lib/ai/ai.provider";
import { executeAiTool } from "@/lib/ai/ai.tools";

describe("Vista Chase AI Voice Assistant & Multi-Turn Conversational Booking Flow", () => {
  const ai = new MockAIProvider();

  it("1. Voice Question -> Instant Answer on Moraine Lake access rules", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want information about Moraine Lake." },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toContain("Private vehicles are prohibited on Moraine Lake Road");
    expect(res.message).toContain("guaranteed commercial shuttle access");
    expect(res.toolCalls?.some((t) => t.name === "checkAvailability")).toBe(true);
    expect(res.hasSafetyRefusal).toBeFalsy();
  });

  it("2. Tour Search & Intent -> Asks for travel date with accumulated party size", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want information about Moraine Lake." },
      { role: "assistant", content: "Private vehicles are prohibited on Moraine Lake Road..." },
      { role: "user", content: "I want to book the sunrise tour for two adults." },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toMatch(/what date/i);
    expect(res.message).toContain("2 adults");
    expect(res.sessionState?.adults).toBe(2);
    expect(res.sessionState?.tourSlug).toBe("sunrise-shuttle-to-moraine-lake-and-lake-louise");
    expect(res.toolCalls?.some((t) => t.name === "getAvailableDates")).toBe(true);
  });

  it("3. Availability -> Verifies live seats, CAD pricing, and requests hotel pickup", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to book the sunrise tour for two adults." },
      { role: "assistant", content: "What date are you planning to travel?" },
      { role: "user", content: "Tomorrow" },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toContain("seats available");
    expect(res.message).toContain("$89 CAD per person");
    expect(res.message).toContain("$178 CAD total");
    expect(res.message).toContain("hotel are you staying at");
    expect(res.toolCalls?.some((t) => t.name === "checkAvailability")).toBe(true);
    expect(res.sessionState?.stage).toBe("PICKUP_REQUESTED");
  });

  it("4. Hotel Pickup Identification -> Identifies stop and asks for guest contact details", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to book the sunrise tour for two adults." },
      { role: "assistant", content: "What date are you planning to travel?" },
      { role: "user", content: "Tomorrow" },
      { role: "assistant", content: "Which hotel are you staying at?" },
      { role: "user", content: "We are staying at Fairmont Banff Springs" },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toContain("Fairmont Banff Springs");
    expect(res.message).toMatch(/name, email/i);
    expect(res.toolCalls?.some((t) => t.name === "findPickup")).toBe(true);
    expect(res.sessionState?.pickupHotel).toContain("Fairmont Banff Springs");
    expect(res.sessionState?.stage).toBe("DETAILS_COLLECTED");
  });

  it("5. Review Summary & 10-Minute Hold -> Atomically locks seats and provides secure payment link", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to book the sunrise tour for two adults." },
      { role: "user", content: "Tomorrow" },
      { role: "user", content: "Fairmont Banff Springs" },
      { role: "user", content: "David Miller, david@example.com, +1-403-555-0199" },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toContain("booking summary");
    expect(res.message).toContain("David Miller");
    expect(res.message).toContain("10-minute reservation hold");
    expect(res.message).toContain("will not take your payment over voice");
    expect(res.checkoutUrl).toContain("/book?");
    expect(res.checkoutUrl).toContain("holdToken=");
    expect(res.toolCalls?.some((t) => t.name === "createVoiceReservationHold")).toBe(true);
    expect(res.toolCalls?.some((t) => t.name === "createVoiceBookingPaymentIntent")).toBe(true);
  });

  it("6. Strict PCI-DSS Guardrail -> Immediately refuses credit card numbers over voice", async () => {
    const cardAttempts = [
      "Here is my credit card: 4532 1234 5678 9012 and CVV is 999",
      "Can you charge my visa card ending in 4521 expiry 10/28?",
      "Take my payment by card now",
    ];

    for (const attempt of cardAttempts) {
      const res = await ai.chat([{ role: "user", content: attempt }]);
      expect(res.hasSafetyRefusal).toBe(true);
      expect(res.message).toContain("cannot collect or process payment card details");
      expect(res.message).toContain("secure checkout link to review and finalize your payment safely");
    }
  });

  it("7. Never confirms a booking itself: payment at checkout does, and the voucher comes by email", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to book the sunrise tour for two adults." },
      { role: "user", content: "Tomorrow" },
      { role: "user", content: "Fairmont Banff Springs" },
      { role: "user", content: "David Miller, david@example.com, +1-403-555-0199" },
      { role: "user", content: "I have completed payment, please confirm my booking" },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toContain("confirmed as soon as payment goes through");
    expect(res.message).not.toMatch(/VC-\d{4}-/); // no invented booking reference
    expect(res.toolCalls ?? []).toHaveLength(0);
    expect(res.sessionState?.stage).not.toBe("CONFIRMED");
  });

  it("8. Live Shuttle Tracking & ETA Integration", async () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Where is my shuttle for booking VC-2026-98412?" },
    ];
    const res = await ai.chat(messages);

    expect(res.message).toContain("shuttle (VC-2026-98412) is en route");
    expect(res.message).toContain("Live GPS telemetry is active");
    expect(res.toolCalls?.some((t) => t.name === "getLiveTracking")).toBe(true);
    expect(res.toolCalls?.some((t) => t.name === "getETA")).toBe(true);
    expect(res.data?.type).toBe("tracking");
  });

  it("9. Direct Execution of Validated Customer Voice Tools", async () => {
    const ctx = { isStaff: false };

    // Tool: getAvailableDates
    const datesRes = await executeAiTool("getAvailableDates", {}, ctx);
    expect(datesRes.success).toBe(true);
    expect(Array.isArray(datesRes.data)).toBe(true);

    // Tool: createVoiceBookingPaymentIntent
    const payIntentRes = await executeAiTool(
      "createVoiceBookingPaymentIntent",
      {
        departureId: "cmutg855l000x12b4p2hcywbj",
        seatsCount: 2,
        customerName: "Audrey Hepburn",
        customerEmail: "audrey@example.com",
      },
      ctx
    );
    expect(payIntentRes.success).toBe(true);
    expect((payIntentRes.data as any).checkoutUrl).toContain("/book?");
    expect((payIntentRes.data as any).securityNotice).toContain("PCI-DSS");
  });
});
