import { describe, it, expect } from "vitest";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import { getPaymentProvider } from "@/lib/payment/payment.provider";
import { getAIProvider } from "@/lib/ai/ai.provider";
import { getMapsProvider } from "@/lib/maps/maps.provider";
import { signToken, verifyToken, hashPassword, verifyPassword } from "@/lib/auth/auth";

describe("Foundation & Provider Abstractions", () => {
  it("cache provider handles get, set with TTL, and deletion", async () => {
    const cache = getCacheProvider();
    await cache.set("test_key", { message: "rockies" }, 10);
    const value = await cache.get<{ message: string }>("test_key");
    expect(value).toEqual({ message: "rockies" });

    const exists = await cache.exists("test_key");
    expect(exists).toBe(true);

    const ttl = await cache.ttl("test_key");
    expect(ttl).toBeGreaterThan(0);

    await cache.del("test_key");
    const afterDel = await cache.get("test_key");
    expect(afterDel).toBeNull();
  });

  it("payment provider simulates payment intents and refunds", async () => {
    const payment = getPaymentProvider();
    const intent = await payment.createPaymentIntent({
      amount: 15000,
      currency: "CAD",
      bookingReference: "VC-TEST-001",
      customerEmail: "traveler@example.com",
    });
    expect(intent.intentId).toBeDefined();
    expect(intent.currency).toBe("CAD");

    expect(intent.paid).toBe(true); // the mock pays instantly
    expect(intent.amount).toBe(15000);

    const refund = await payment.refundPayment(intent.intentId, 15000);
    expect(refund.success).toBe(true);
  });

  it("AI provider refuses credit card numbers and answers Rockies queries", async () => {
    const ai = getAIProvider();

    // 1. Credit card refusal test
    const refusal = await ai.chat([
      { role: "user", content: "My card number is 4111 2222 3333 4444 and cvv is 123" },
    ]);
    expect(refusal.hasSafetyRefusal).toBe(true);
    expect(refusal.message).toContain("cannot collect or process payment card details");

    // 2. Pickup inquiry test
    const pickupResp = await ai.chat([
      { role: "user", content: "Where do you pick up in Banff?" },
    ]);
    expect(pickupResp.message).toContain("Fairmont Banff Springs");
    expect(pickupResp.toolCalls).toBeDefined();
  });

  it("maps provider returns accurate Banff and Canmore hotels", async () => {
    const maps = getMapsProvider();
    const hotels = await maps.searchPickups("Fairmont", "Banff");
    expect(hotels.length).toBeGreaterThan(0);
    expect(hotels[0].name).toContain("Fairmont");
    expect(hotels[0].town).toBe("Banff");
  });

  it("auth utilities handle password hashing, JWT signing and verification", async () => {
    const raw = "BanffRockies2026!";
    const hashed = await hashPassword(raw);
    const valid = await verifyPassword(raw, hashed);
    expect(valid).toBe(true);

    const token = signToken({
      userId: "u123",
      email: "guest@example.com",
      role: "CUSTOMER",
      name: "John Banff",
    });
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("guest@example.com");
    expect(verified?.role).toBe("CUSTOMER");
  });
});
