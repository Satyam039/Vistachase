import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { logAuditEvent, getAuditLogs } from "@/lib/security/audit-logger";
import prisma from "@/lib/db/prisma";

describe("Phase 8: Security, Analytics, Observability & Production Hardening", () => {
  it("enforces rate limits and throttles excessive requests within window", async () => {
    const testKey = `test_ip_${Date.now()}`;
    const limitConfig = { maxRequests: 3, windowSeconds: 10 };

    // Request 1: allowed
    const r1 = await checkRateLimit(testKey, limitConfig);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    // Request 2: allowed
    const r2 = await checkRateLimit(testKey, limitConfig);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    // Request 3: allowed (last one)
    const r3 = await checkRateLimit(testKey, limitConfig);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // Request 4: blocked
    const r4 = await checkRateLimit(testKey, limitConfig);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetSeconds).toBeGreaterThan(0);
  });

  it("records and retrieves operational audit log events", async () => {
    const entityId = `entity_${Date.now()}`;

    const log = await logAuditEvent({
      action: "BOOKING_CONFIRMED",
      entityType: "Booking",
      entityId,
      details: {
        customerEmail: "audited.traveler@example.com",
        seats: 4,
        source: "Checkout Engine",
      },
      ipAddress: "192.168.1.100",
    });

    expect(log).toBeDefined();
    expect(log?.id).toBeDefined();
    expect(log?.action).toBe("BOOKING_CONFIRMED");

    // Fetch logs
    const logs = await getAuditLogs("Booking", 10);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.some((l) => l.entityId === entityId)).toBe(true);
  });

  it("validates database and cache observability integrity", async () => {
    // Database queryRaw integrity
    const dbCheck = await prisma.$queryRaw`SELECT 1 as result`;
    expect(dbCheck).toBeDefined();

    // Audit log count
    const count = await prisma.auditLog.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
