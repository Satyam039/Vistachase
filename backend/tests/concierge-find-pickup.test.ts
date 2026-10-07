import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "@/app";
import { executeAiTool } from "@/lib/ai/ai.tools";

describe("Concierge findPickup tool", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns Banff stops for a free-text 'query' argument", async () => {
    const res = (await executeAiTool("findPickup", { query: "Where do you pick up in Banff?" }, { isStaff: false })) as { success: boolean; data: any[] };
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((s: any) => s.town === "Banff")).toBe(true);
  });

  it("narrows to a named hotel and still accepts the legacy hotelNameQuery argument", async () => {
    const byQuery = (await executeAiTool("findPickup", { query: "I'm staying at the Rimrock in Banff" }, { isStaff: false })) as { success: boolean; data: any[] };
    expect(byQuery.success).toBe(true);
    expect(byQuery.data.map((s: any) => s.id)).toEqual(["rimrock-resort"]);

    const legacy = (await executeAiTool("getPickup", { hotelNameQuery: "Fairmont Banff Springs" }, { isStaff: false })) as { success: boolean; data: any[] };
    expect(legacy.success).toBe(true);
    expect(legacy.data[0].id).toBe("fairmont-banff-springs");
  });

  it("POST /api/concierge returns a pickups card for 'Where do you pick up in Banff?'", async () => {
    const response = await fetch(`${baseUrl}/api/concierge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Where do you pick up in Banff?" }],
        sessionState: {},
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;

    const pickup = body.toolResults.find((r: any) => r.toolName === "findPickup");
    expect(pickup).toMatchObject({ success: true });
    expect(pickup.error).toBeUndefined();

    expect(body.data.type).toBe("pickups");
    expect(body.data.stops.length).toBeGreaterThan(0);
    for (const stop of body.data.stops) {
      expect(stop).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          town: "Banff",
          address: expect.any(String),
        }),
      );
    }
  });
});
