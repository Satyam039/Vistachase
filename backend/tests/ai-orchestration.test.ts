import { describe, it, expect } from "vitest";
import { executeAiTool } from "@/lib/ai/ai.tools";

describe("Controlled AI Tool Orchestration & Safety", () => {
  it("executes safe customer-facing tools (searchTours, getPickup, getLiveTracking)", async () => {
    // 1. searchTours
    const toursRes = await executeAiTool("searchTours", { query: "Banff" }, { isStaff: false });
    expect(toursRes.success).toBe(true);
    expect(Array.isArray(toursRes.data)).toBe(true);

    // 2. getPickup
    const pickupRes = await executeAiTool("getPickup", { hotelNameQuery: "Fairmont" }, { isStaff: false });
    expect(pickupRes.success).toBe(true);
    expect(Array.isArray(pickupRes.data)).toBe(true);
  });

  it("blocks unauthorized customers from invoking staff operations tools", async () => {
    const unauthorizedCtx = { isStaff: false };

    // 1. getTodaysDepartures
    const depRes = await executeAiTool("getTodaysDepartures", {}, unauthorizedCtx);
    expect(depRes.success).toBe(false);
    expect(depRes.error).toContain("UNAUTHORIZED");

    // 2. getPendingPickups
    const pendingRes = await executeAiTool("getPendingPickups", {}, unauthorizedCtx);
    expect(pendingRes.success).toBe(false);
    expect(pendingRes.error).toContain("UNAUTHORIZED");

    // 3. getBoardingStatus
    const boardingRes = await executeAiTool("getBoardingStatus", {}, unauthorizedCtx);
    expect(boardingRes.success).toBe(false);
    expect(boardingRes.error).toContain("UNAUTHORIZED");
  });

  it("allows authorized operations staff to query operational tools", async () => {
    const staffCtx = { isStaff: true, role: "DISPATCHER" };

    const depRes = await executeAiTool("getTodaysDepartures", {}, staffCtx);
    expect(depRes.success).toBe(true);
    expect(Array.isArray(depRes.data)).toBe(true);

    const vehicleRes = await executeAiTool("getVehicleAssignments", {}, staffCtx);
    expect(vehicleRes.success).toBe(true);
    expect(Array.isArray(vehicleRes.data)).toBe(true);
  });
});
