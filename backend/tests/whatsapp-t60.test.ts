import { describe, it, expect } from "vitest";
import prisma from "@/lib/db/prisma";
import {
  getWhatsAppProvider,
  ConsoleWhatsAppProvider,
  dispatchShuttleTrackingAlert,
  dispatchT60ScheduledBatch,
} from "@/lib/whatsapp/whatsapp.provider";

describe("WhatsApp T-60 Dispatch & Idempotency", () => {
  it("formats and delivers WhatsApp alert via Console provider simulator", async () => {
    const provider = new ConsoleWhatsAppProvider();
    const result = await provider.sendShuttleTrackingAlert({
      toPhoneNumber: "+1-825-734-9456",
      customerName: "Audrey Hepburn",
      tourName: "Moraine Lake & Lake Louise Alpine Sunrise",
      pickupLocation: "Fairmont Banff Springs Hotel",
      pickupTime: "05:00 AM",
      vehicleName: "Mercedes-Benz Sprinter Executive #4",
      licensePlate: "ALBERTA • 7VC-894",
      driverName: "Marc Tremblay",
      trackingUrl: "https://vistachase.com/track/4c75291326d8a68f983439c4291bcdfe92c5deaaecaf03d1be8d721b248f3d2a",
      bookingReference: "VC-TEST-WHATSAPP",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toContain("wa_msg_");
  });

  it("enforces strict database idempotency preventing duplicate T-60 guest alerts", async () => {
    const booking = await prisma.booking.findFirst();
    expect(booking).toBeDefined();

    // 1. First dispatch
    const firstDispatch = await dispatchShuttleTrackingAlert(booking!.id);
    expect(firstDispatch.success).toBe(true);
    expect(firstDispatch.trackingToken).toBeDefined();

    // 2. Second dispatch attempt must be recognized as alreadySent
    const secondDispatch = await dispatchShuttleTrackingAlert(booking!.id);
    expect(secondDispatch.success).toBe(true);
    expect(secondDispatch.alreadySent).toBe(true);
  });
});
