// A Bókun test account has its own product IDs: the products check shows the account's IDs next
// to the website's links, and seat sync stays off with a test account unless switched on.

import { afterEach, describe, expect, it } from "vitest";
import { checkBokunProducts } from "@/modules/bokun/bokun-products";
import { bokunAvailabilitySyncEnabled, bokunIsTestAccount, type BokunApi } from "@/modules/bokun/config";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

function fakeAccount(items: { id: number; title: string }[]) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const api: BokunApi = {
    getAvailabilities: async () => [],
    fetch: async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      return { totalHits: items.length, items };
    },
  };
  return { api, calls };
}

describe("Bókun products check", () => {
  it("lists the account's products and marks website links it doesn't have", async () => {
    const { api, calls } = fakeAccount([
      { id: 796650, title: "Banff Highlights" },
      { id: 55501, title: "Test Icefields" },
    ]);
    const check = await checkBokunProducts(api);
    expect(calls[0]).toMatchObject({ method: "POST", path: expect.stringContaining("/activity.json/search") });
    expect(check!.activities.map((a) => a.id)).toEqual(["796650", "55501"]);
    const highlights = check!.products.find((p) => p.slug === "banff-highlights-tour");
    expect(highlights).toMatchObject({ bokunId: "796650", found: true, title: "Banff Highlights" });
    expect(check!.products.filter((p) => p.bokunId && !p.found).length).toBeGreaterThan(0);
  });

  it("checks only the products the owner's list offers (2026-11-05; winter tours back 2026-11-11)", async () => {
    const check = await checkBokunProducts(fakeAccount([]).api);
    const slugs = check!.products.map((p) => p.slug);
    expect(slugs).toContain("shared-tours-icefields-jasper");
    expect(slugs).toContain("winter-special");
    expect(slugs).toContain("winter-signature-private-tour");
    expect(slugs).not.toContain("shared-tours-heart-of-banff");
  });

  it("returns null without a connection", async () => {
    expect(await checkBokunProducts(null)).toBeNull();
  });
});

describe("seat sync with a Bókun test account", () => {
  it("is off by default on bokuntest.com and on with BOKUN_AVAILABILITY_SYNC=true", () => {
    process.env.BOKUN_ACCESS_KEY = "a";
    process.env.BOKUN_SECRET_KEY = "b";
    process.env.BOKUN_API_URL = "https://api.bokuntest.com";
    delete process.env.BOKUN_AVAILABILITY_SYNC;
    expect(bokunIsTestAccount()).toBe(true);
    expect(bokunAvailabilitySyncEnabled()).toBe(false);
    process.env.BOKUN_AVAILABILITY_SYNC = "true";
    expect(bokunAvailabilitySyncEnabled()).toBe(true);
  });

  it("stays on by default with the live account", () => {
    process.env.BOKUN_ACCESS_KEY = "a";
    process.env.BOKUN_SECRET_KEY = "b";
    process.env.BOKUN_API_URL = "https://api.bokun.io";
    delete process.env.BOKUN_AVAILABILITY_SYNC;
    expect(bokunAvailabilitySyncEnabled()).toBe(true);
    process.env.BOKUN_AVAILABILITY_SYNC = "false";
    expect(bokunAvailabilitySyncEnabled()).toBe(false);
  });
});

describe("matching Bókun start times", () => {
  it("reads the vendor's day whatever its time zone, and loose time formats", async () => {
    const { findSlot } = await import("@/modules/bokun/bokun-booking");
    const ist = Date.parse("2026-11-25T18:30:00Z"); // midnight 26 Nov in India
    const banff = Date.parse("2026-11-26T07:00:00Z"); // midnight 26 Nov in Banff
    expect(findSlot([{ date: ist, startTime: "7:00" }], "2026-11-26", "07:00")).toBeTruthy();
    expect(findSlot([{ date: banff, startTime: "07:00:00" }], "2026-11-26", "07:00")).toBeTruthy();
    expect(findSlot([{ date: banff, startTime: "08:00" }], "2026-11-26", "07:00")).toBeUndefined();
  });

  it("says which start times Bókun has when the departure isn't offered", async () => {
    const { reserveInBokun } = await import("@/modules/bokun/bokun-booking");
    const api: BokunApi = {
      getAvailabilities: async () => [{ date: Date.parse("2026-11-26T00:00:00Z"), startTime: "08:30", availabilityCount: 10 }],
      fetch: async () => ({ pricingCategories: [{ id: 1, title: "Adult" }] }),
    };
    const input = {
      bookingReference: "VC-TEST",
      productBokunId: "30159",
      category: "PRIVATE",
      date: "2026-11-26",
      time: "07:00",
      adults: 2,
      children: 0,
      infants: 0,
      customerName: "Test Guest",
      customerEmail: "t@example.com",
      customerPhone: "+10000000000",
    };
    await expect(reserveInBokun(api, input as never, undefined as never)).rejects.toThrow(/only 08:30 on that day/);
  });

  it("asks Bókun for a day either side, so a same-day range that comes back empty still finds the slot", async () => {
    const { reserveInBokun } = await import("@/modules/bokun/bokun-booking");
    const asked: string[] = [];
    const api: BokunApi = {
      getAvailabilities: async (_id: string, start: string, end: string) => {
        asked.push(`${start}..${end}`);
        if (start === end) return [];
        return [{ date: Date.parse("2026-11-15T07:00:00Z"), startTime: "8:30", availabilityCount: 0, soldOut: true }];
      },
      fetch: async () => ({ pricingCategories: [{ id: 1, title: "Adult" }] }),
    };
    const input = {
      bookingReference: "VC-TEST",
      productBokunId: "30190",
      category: "SHARED",
      date: "2026-11-15",
      time: "08:30",
      adults: 2,
      children: 0,
      infants: 0,
      customerName: "Test Guest",
      customerEmail: "t@example.com",
      customerPhone: "+10000000000",
    };
    // The slot is found (so the failure is about seats, not a missing start time).
    await expect(reserveInBokun(api, input as never, undefined as never)).rejects.toThrow(/0 seat\(s\) left/);
    expect(asked).toEqual(["2026-11-14..2026-11-16"]);
  });
});

describe("confirming on a test account in another currency", () => {
  async function run(testAccount: boolean) {
    const { confirmInBokun } = await import("@/modules/bokun/bokun-booking");
    const { BokunApiError } = await import("@/modules/bokun/bokun.client");
    const confirms: { amount: number; currency: string }[] = [];
    const api: BokunApi = {
      getAvailabilities: async () => [],
      fetch: async (method: string, path: string, body?: any) => {
        if (method === "GET" && path.startsWith("/booking.json/booking/")) return { totalPrice: 200000, currency: "INR" };
        confirms.push({ amount: body.amount, currency: body.currency });
        if (body.currency !== "INR") {
          throw new BokunApiError(400, 'Bókun API Error: 400 Bad Request - {"message":"Error occurred: logic.InvalidDataException - Payment currency must match the booking currency INR"}');
        }
        return null;
      },
    };
    const result = confirmInBokun(api, "WEB-1", "VC-TEST", { amount: 458, currency: "CAD" }, { testAccount });
    return { result, confirms };
  }

  it("confirms again in Bókun's currency for Bókun's total on a test account", async () => {
    const { result, confirms } = await run(true);
    await result;
    expect(confirms).toEqual([
      { amount: 458, currency: "CAD" },
      { amount: 200000, currency: "INR" },
    ]);
  });

  it("stops on a live account", async () => {
    const { result, confirms } = await run(false);
    await expect(result).rejects.toThrow(/booking currency INR/);
    expect(confirms).toHaveLength(1);
  });
});
