import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import { getLiveTrackingProvider } from "@/lib/tracking/tracking.provider";

// These tests exercise the tracking simulator, which is off unless FEATURE_TRACKING is "true".
process.env.FEATURE_TRACKING = "true";

describe("Live GPS Tracking & Telemetry System", () => {
  it("resolves active telemetry for a valid 64-character cryptographic token", async () => {
    const session = await prisma.trackingSession.findFirst();
    expect(session).toBeDefined();

    const provider = getLiveTrackingProvider();
    const telemetry = await provider.getTrackingTelemetry(session!.token);

    expect(telemetry).not.toBeNull();
    expect(telemetry?.sessionToken).toBe(session!.token);
    expect(telemetry?.vehicleName).toBeDefined();
    expect(telemetry?.licensePlate).toBeDefined();
    expect(telemetry?.driverName).toBeDefined();
    expect(telemetry?.vehicleCoordinates.latitude).toBeGreaterThan(50);
    expect(telemetry?.vehicleCoordinates.longitude).toBeLessThan(-100);
    expect(telemetry?.estimatedArrivalMinutes).toBeGreaterThanOrEqual(1);
    expect(telemetry?.routeWaypoints.length).toBeGreaterThan(0);
  });

  it("returns null gracefully for non-existent or expired tracking tokens", async () => {
    const provider = getLiveTrackingProvider();
    const invalidTelemetry = await provider.getTrackingTelemetry("unknown_token_abc_123");
    expect(invalidTelemetry).toBeNull();
  });
});
