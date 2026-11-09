import { describe, it, expect } from "vitest";
import { CARD_NUMBER_REGEX, getMountainTimeContext } from "@/lib/ai/agent.gateway";
import { agentToolExecutor, AGENT_TOOL_DEFINITIONS } from "@/lib/ai/agent.tools.registry";
import { VISTACHASE_STATIC_KNOWLEDGE_BASE } from "@/lib/ai/knowledge.base";
import { syncMasterKnowledgeBase, getMasterKnowledgeBase } from "@/lib/ai/knowledge.sync";
import type { SessionContext } from "@/lib/ai/agent.types";

describe("Vistachase Agentic Platform Architecture & Tool Loop", () => {
  describe("Security Pre-filters & Card Redaction", () => {
    it("detects and blocks credit card numbers deterministically before the LLM", () => {
      expect(CARD_NUMBER_REGEX.test("My card is 4532 1122 3344 5566")).toBe(true);
      expect(CARD_NUMBER_REGEX.test("Can I pay with 5412-7512-3412-3456 exp 12/28")).toBe(true);
      expect(CARD_NUMBER_REGEX.test("I have 4 guests on July 14th")).toBe(false);
      expect(CARD_NUMBER_REGEX.test("Booking ref VC-2026-89412")).toBe(false);
    });
  });

  describe("Role-Scoped Tool Filtering (RBAC & Zero-Trust Gateway)", () => {
    it("restricts GUEST sessions to Suite A and Suite B tools only", () => {
      const guestSession: SessionContext = { role: "GUEST" };
      const filtered = agentToolExecutor.getFilteredToolsForSession(guestSession);
      const names = filtered.map((t) => t.name);

      // Must include Suite A & B
      expect(names).toContain("search_live_inventory");
      expect(names).toContain("compare_shared_vs_private");
      expect(names).toContain("create_atomic_seat_hold");
      expect(names).toContain("initiate_guest_pnr_verification");

      // Must NOT include Suite C or Suite D
      expect(names).not.toContain("get_my_bookings");
      expect(names).not.toContain("process_self_serve_cancellation");
      expect(names).not.toContain("admin_lookup_any_pnr");
      expect(names).not.toContain("admin_override_rectification");
    });

    it("unlocks Suite C tools when guest is OTP-verified with an authorized PNR", () => {
      const otpGuestSession: SessionContext = {
        role: "GUEST",
        authorizedPnr: "VC-2026-89412",
      };
      const filtered = agentToolExecutor.getFilteredToolsForSession(otpGuestSession);
      const names = filtered.map((t) => t.name);

      // Now Suite C is unlocked
      expect(names).toContain("get_my_bookings");
      expect(names).toContain("process_self_serve_cancellation");
      expect(names).toContain("preview_booking_modification");

      // Suite D must still be forbidden
      expect(names).not.toContain("admin_lookup_any_pnr");
      expect(names).not.toContain("admin_override_rectification");
    });

    it("injects Suite D elevated fleet tools ONLY when session.role === 'ADMIN'", () => {
      const adminSession: SessionContext = { role: "ADMIN", userId: "usr_admin_1" };
      const filtered = agentToolExecutor.getFilteredToolsForSession(adminSession);
      const names = filtered.map((t) => t.name);

      expect(filtered.length).toBe(AGENT_TOOL_DEFINITIONS.length);
      expect(names).toContain("admin_lookup_any_pnr");
      expect(names).toContain("admin_override_rectification");
      expect(names).toContain("admin_reassign_fleet_or_passengers");
      expect(names).toContain("admin_inspect_trip_manifest_and_margins");
    });
  });

  describe("Smart Comparison & Advisory Calculations", () => {
    it("autonomously compares shared vs private rates for a group of 5", async () => {
      const outcome = await agentToolExecutor.execute(
        "compare_shared_vs_private",
        { date: "2026-07-15", passenger_count: 5 },
        { role: "GUEST" }
      );

      const res = outcome.data as any;
      expect(res.shared_option.subtotal_cad).toBe(1245); // 5 * 249
      expect(res.shared_option.total_cad).toBe(1307.25); // 1245 + 5% GST
      expect(res.private_option.flat_rate_cad).toBe(1150);
      expect(res.private_option.total_cad).toBe(1207.5); // 1150 + 5% GST
      expect(res.price_verdict).toContain("Private tour costs $99.75 LESS");
    });

    it("validates doorstep hotel pickups in Banff and Canmore", async () => {
      const banffRes = await agentToolExecutor.execute(
        "validate_pickup_location",
        { hotel_or_address: "Fairmont Banff Springs Hotel" },
        { role: "GUEST" }
      );
      expect((banffRes.data as any).status).toBe("DOORSTEP_PICKUP_APPROVED");
      expect((banffRes.data as any).hub).toBe("Banff");

      const canmoreRes = await agentToolExecutor.execute(
        "validate_pickup_location",
        { hotel_or_address: "The Malcolm Hotel Canmore" },
        { role: "GUEST" }
      );
      expect((canmoreRes.data as any).status).toBe("DOORSTEP_PICKUP_APPROVED");
      expect((canmoreRes.data as any).hub).toBe("Canmore");

      const unknownRes = await agentToolExecutor.execute(
        "validate_pickup_location",
        { hotel_or_address: "123 Remote Forest Road Cabin" },
        { role: "GUEST" }
      );
      expect((unknownRes.data as any).status).toBe("MEETING_AT_CENTRAL_HUB");
    });
  });

  describe("Anthropic Prompt Caching & Knowledge Base Integrity", () => {
    it("verifies static knowledge base contains exact cancellation policies and seasonal windows", () => {
      expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).toContain("24 hours prior to departure time");
      expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).toContain("72 hours prior to departure time");
      expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).toContain("Moraine Lake Road and Takakkaw Falls Road are CLOSED");
      expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).toContain("max 12 guests");
      // Website prices, not invented ones (owner, 2026-11-09)
      expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).toContain("CAD $1,750 per vehicle");
      expect(VISTACHASE_STATIC_KNOWLEDGE_BASE).not.toMatch(/GST|Escalade|bookings@vistachase\.com|Heart of Banff/);
    });

    it("verifies dynamic mountain time context provides MST/MDT zone and seasonal flags", () => {
      const ctx = getMountainTimeContext();
      expect(ctx.timeString).toContain("MST/MDT");
      expect(typeof ctx.isWinterSeason).toBe("boolean");
    });

    it("dynamically compiles and synchronizes master knowledge base with version hash", async () => {
      const meta = await syncMasterKnowledgeBase();
      expect(meta.version).toMatch(/^kb_/);
      expect(meta.hash).toBeDefined();
      expect(meta.byteLength).toBeGreaterThan(1000);

      const kb = await getMasterKnowledgeBase();
      expect(kb).toContain("Vista Chase concierge");
      expect(kb).toContain("Parks Canada");
      expect(kb).toContain("full refund if cancelled at least 24 hours");
    });
  });
});
