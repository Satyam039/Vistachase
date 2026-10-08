// AI concierge agent: the safety rules that live in code (not the prompt) — booking access needs
// the booking email, cancelling needs explicit guest confirmation, staff tools need staff, and
// card numbers never reach the model. Runs the tool layer directly (no model calls).

import { describe, it, expect } from "vitest";
import { runConciergeAgent, runConciergeTool } from "@/lib/ai/concierge.agent";

const guest = { isStaff: false };
const REF = "VC-2026-98412";
const EMAIL = "sarah.traveler@example.com";

describe("concierge agent tools", () => {
  it("looks up a booking only with the matching email", async () => {
    const wrong = await runConciergeTool("lookup_booking", { bookingReference: REF, customerEmail: "someone@else.com" }, guest);
    expect(wrong.result).toEqual({ error: "No booking matches that reference and email." });
    expect(wrong.card).toBeUndefined();

    const right = await runConciergeTool("lookup_booking", { bookingReference: REF.toLowerCase(), customerEmail: EMAIL.toUpperCase() }, guest);
    expect(right.result).toMatchObject({ bookingReference: REF, voucherUrl: `/booking/${REF}/voucher` });
    expect(right.card?.data).toMatchObject({ type: "confirmed", bookingReference: REF });
    expect(right.memory).toContain(REF);
  });

  it("won't cancel without the guest's explicit confirmation", async () => {
    const res = await runConciergeTool("cancel_booking", { bookingReference: REF, customerEmail: EMAIL, guestConfirmed: false }, guest);
    expect(res.result).toEqual({ error: "Ask the guest to confirm the cancellation first." });
  });

  it("keeps staff tools for staff", async () => {
    const res = await runConciergeTool("staff_todays_departures", {}, guest);
    expect(res.result).toEqual({ error: "Staff sign-in required." });
  });

  it("returns availability as a card and remembers departure IDs", async () => {
    const res = await runConciergeTool("get_available_dates", {}, guest);
    if (Array.isArray(res.result) && res.result.length) {
      expect(res.card?.data).toMatchObject({ type: "availability" });
      expect(res.memory).toMatch(/departureId \S+/);
    } else {
      expect(res.card).toBeUndefined();
    }
  });

  it("refuses card numbers before calling the model", async () => {
    const events: string[] = [];
    const res = await runConciergeAgent([{ role: "user", content: "my card is 4532 1234 5678 9012" }], undefined, guest, (e) => events.push(e.type));
    expect(res.hasSafetyRefusal).toBe(true);
    expect(events).toEqual(["text", "done"]);
  });
});
