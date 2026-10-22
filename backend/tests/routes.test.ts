import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { checkRateLimit } from "../src/lib/security/rate-limiter";
import { getAuthenticatedUser } from "../src/lib/auth/admin-guard";

vi.mock("../src/lib/security/rate-limiter");
vi.mock("../src/lib/auth/admin-guard");

describe("F15: Route-level tests (Auth, Ownership, Rate Limits)", () => {
  const app = createApp();

  beforeEach(() => {
    vi.resetAllMocks();
    (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 10, resetSeconds: 60 });
  });

  describe("Rate Limits", () => {
    it("should return 429 when rate limit is exceeded on /api/auth/login", async () => {
      (checkRateLimit as any).mockResolvedValue({ allowed: false, remaining: 0, resetSeconds: 60 });
      
      const res = await request(app).post("/api/auth/login").send({ email: "test@example.com", password: "password" });
      expect(res.status).toBe(429);
      expect(res.body.error).toContain("Too many requests");
    });
  });

  describe("Ownership on Booking Cancel", () => {
    it("should refuse an anonymous caller, even one who sends the booking email", async () => {
      (getAuthenticatedUser as any).mockReturnValue(null);

      // Ownership is the signed-in owner or the voucher link's token; an email proves nothing.
      for (const body of [{ bookingReference: "VC-2026-UNKNOWN" }, { bookingReference: "VC-2026-UNKNOWN", email: "guest@example.com" }]) {
        const res = await request(app).post("/api/bookings/cancel").send(body);
        expect(res.status).toBe(403);
        expect(res.body.error).toBeTruthy();
      }
    });
  });

  describe("Concierge locked down", () => {
    it("should reject /api/concierge/tool without staff auth", async () => {
      const res = await request(app).post("/api/concierge/tool").send({ toolName: "getTodaysDepartures" });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain("UNAUTHORIZED: Staff credentials required.");
    });
  });
});
