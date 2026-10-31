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
      { id: 1142134, title: "Banff Highlights" },
      { id: 55501, title: "Test Icefields" },
    ]);
    const check = await checkBokunProducts(api);
    expect(calls[0]).toMatchObject({ method: "POST", path: expect.stringContaining("/activity.json/search") });
    expect(check!.activities.map((a) => a.id)).toEqual(["1142134", "55501"]);
    const highlights = check!.products.find((p) => p.slug === "banff-highlights-tour");
    expect(highlights).toMatchObject({ bokunId: "1142134", found: true, title: "Banff Highlights" });
    expect(check!.products.filter((p) => p.bokunId && !p.found).length).toBeGreaterThan(0);
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
});
