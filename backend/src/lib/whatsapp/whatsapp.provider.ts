import crypto from "crypto";
import prisma from "@/lib/db/prisma";
import { dateOnly, todayInMountainTime } from "@/lib/utils/time";

export interface WhatsAppMessagePayload {
  toPhoneNumber: string;
  customerName: string;
  tourName: string;
  pickupLocation: string;
  pickupTime: string;
  vehicleName: string;
  licensePlate: string;
  driverName: string;
  trackingUrl: string;
  bookingReference: string;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IWhatsAppProvider {
  sendShuttleTrackingAlert(payload: WhatsAppMessagePayload): Promise<WhatsAppDispatchResult>;
}

// ---------------------------------------------------------------------------
// 1. Console / Dev Simulator Provider
// ---------------------------------------------------------------------------
export class ConsoleWhatsAppProvider implements IWhatsAppProvider {
  async sendShuttleTrackingAlert(payload: WhatsAppMessagePayload): Promise<WhatsAppDispatchResult> {
    const mockId = `wa_msg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    console.log("\n" + "=".repeat(72));
    console.log("🏔️ [VISTA CHASE WHATSAPP BUSINESS DISPATCH - CONSOLE SIMULATOR]");
    console.log("=".repeat(72));
    console.log(`To:        ${payload.toPhoneNumber} (${payload.customerName})`);
    console.log(`Reference: #${payload.bookingReference}`);
    console.log(`Message ID: ${mockId}`);
    console.log("-".repeat(72));
    console.log(
      `Good morning, ${payload.customerName}!\n` +
      `Your private shuttle for ${payload.tourName} is preparing for departure.\n\n` +
      `📍 Pickup Location: ${payload.pickupLocation}\n` +
      `⏰ Estimated Pickup: ${payload.pickupTime}\n` +
      `🚐 Vehicle: ${payload.vehicleName} • Plate: ${payload.licensePlate}\n` +
      `👤 Guide: ${payload.driverName}\n\n` +
      `Tap below to track your driver's live GPS location:\n` +
      `${payload.trackingUrl}\n\n` +
      `Need assistance? Reply directly to this WhatsApp message or call dispatch.`
    );
    console.log("=".repeat(72) + "\n");

    return {
      success: true,
      messageId: mockId,
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Twilio WhatsApp Provider
// ---------------------------------------------------------------------------
export class TwilioWhatsAppProvider implements IWhatsAppProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || "+14155238886";
  }

  async sendShuttleTrackingAlert(payload: WhatsAppMessagePayload): Promise<WhatsAppDispatchResult> {
    if (!this.accountSid || !this.authToken) {
      console.warn("[TwilioWhatsAppProvider] Missing TWILIO_ACCOUNT_SID; using Console Provider.");
      return new ConsoleWhatsAppProvider().sendShuttleTrackingAlert(payload);
    }

    try {
      const formattedTo = payload.toPhoneNumber.startsWith("whatsapp:")
        ? payload.toPhoneNumber
        : `whatsapp:${payload.toPhoneNumber.replace(/[^\d+]/g, "")}`;
      const formattedFrom = this.fromNumber.startsWith("whatsapp:")
        ? this.fromNumber
        : `whatsapp:${this.fromNumber}`;

      const messageBody =
        `🏔️ Vista Chase Canadian Rockies\n\n` +
        `Good morning, ${payload.customerName}!\n` +
        `Your private shuttle for ${payload.tourName} is preparing for departure.\n\n` +
        `📍 Pickup Location: ${payload.pickupLocation}\n` +
        `⏰ Estimated Pickup: ${payload.pickupTime}\n` +
        `🚐 Vehicle: ${payload.vehicleName} • Plate: ${payload.licensePlate}\n` +
        `👤 Guide: ${payload.driverName}\n\n` +
        `Tap below to track your driver's live GPS location:\n` +
        `${payload.trackingUrl}\n\n` +
        `Need assistance? Reply directly to this WhatsApp message.`;

      const params = new URLSearchParams();
      params.append("To", formattedTo);
      params.append("From", formattedFrom);
      params.append("Body", messageBody);

      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Twilio API error HTTP ${response.status}: ${errorText}` };
      }

      const data: any = await response.json();
      return { success: true, messageId: data.sid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Meta Cloud API Provider (Official Meta WhatsApp Business)
// ---------------------------------------------------------------------------
export class MetaCloudWhatsAppProvider implements IWhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.accessToken = process.env.META_WHATSAPP_TOKEN || "";
    this.phoneNumberId = process.env.META_PHONE_NUMBER_ID || "";
  }

  async sendShuttleTrackingAlert(payload: WhatsAppMessagePayload): Promise<WhatsAppDispatchResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn("[MetaCloudWhatsAppProvider] Missing META_WHATSAPP_TOKEN; using Console Provider.");
      return new ConsoleWhatsAppProvider().sendShuttleTrackingAlert(payload);
    }

    try {
      const cleanPhone = payload.toPhoneNumber.replace(/[^\d]/g, "");
      const endpoint = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
type: "template",
          template: {
            name: "vista_chase_pickup",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: payload.customerName },
                  { type: "text", text: payload.tourName },
                  { type: "text", text: payload.pickupLocation },
                  { type: "text", text: payload.pickupTime },
                  { type: "text", text: payload.vehicleName },
                  { type: "text", text: payload.driverName },
                  { type: "text", text: payload.trackingUrl }
                ]
              }
            ]
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Meta Cloud API error HTTP ${response.status}: ${errorText}` };
      }

      const data: any = await response.json();
      return { success: true, messageId: data?.messages?.[0]?.id || "meta_sent" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Factory
// ---------------------------------------------------------------------------
let whatsAppProviderInstance: IWhatsAppProvider | null = null;

export function getWhatsAppProvider(): IWhatsAppProvider {
  if (whatsAppProviderInstance) return whatsAppProviderInstance;

  const type = (process.env.WHATSAPP_PROVIDER || "console").toLowerCase();
  switch (type) {
    case "twilio":
      whatsAppProviderInstance = new TwilioWhatsAppProvider();
      break;
    case "meta":
      whatsAppProviderInstance = new MetaCloudWhatsAppProvider();
      break;
    case "console":
    default:
      whatsAppProviderInstance = new ConsoleWhatsAppProvider();
      break;
  }
  return whatsAppProviderInstance;
}

// ---------------------------------------------------------------------------
// Dispatch Single Tracking Alert (with Idempotency Enforcement)
// ---------------------------------------------------------------------------
export async function dispatchShuttleTrackingAlert(
  bookingReferenceOrId: string,
  originUrl?: string
): Promise<{ success: boolean; trackingToken?: string; trackingUrl?: string; error?: string; alreadySent?: boolean }> {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { bookingReference: bookingReferenceOrId },
          { id: bookingReferenceOrId },
          { trackingToken: bookingReferenceOrId },
        ],
      },
      include: {
        tourDeparture: {
          include: {
            tour: true,
            shuttleRoute: true,
            operationRuns: {
              include: {
                vehicle: true,
                driver: true,
              },
            },
          },
        },
        pickupStop: true,
      },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    // Idempotency Check: verify if T-60 notification was already sent
    const existingNotification = await prisma.whatsAppNotification.findUnique({
      where: {
        bookingId_type: {
          bookingId: booking.id,
          type: "T_60_TRACKING",
        },
      },
    });

    // Generate or re-use secure 64-char crypto token
    let trackingToken = booking.trackingToken;
    if (!trackingToken) {
      trackingToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          trackingToken,
          trackingTokenExpiresAt: expiresAt,
        },
      });
    }

    const baseUrl = originUrl || process.env.FRONTEND_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl.replace(/\/$/, "")}/track/${trackingToken}`;

    if (existingNotification) {
      return {
        success: true,
        alreadySent: true,
        trackingToken,
        trackingUrl,
      };
    }

    const departure = booking.tourDeparture;
    const tourTitle = departure?.tour?.title || departure?.shuttleRoute?.name || "Canadian Rockies Tour";
    const stopName = booking.pickupStop?.name || booking.pickupCustomText || "Fairmont Banff Springs Hotel";
    const activeRun = departure?.operationRuns?.[0];

    const provider = getWhatsAppProvider();
    const result = await provider.sendShuttleTrackingAlert({
      toPhoneNumber: booking.customerPhone,
      customerName: booking.customerName,
      tourName: tourTitle,
      pickupLocation: stopName,
      pickupTime: booking.pickupTime || departure.departureTime.toISOString(),
      vehicleName: activeRun?.vehicle?.name || "Mercedes-Benz Sprinter Executive #4",
      licensePlate: activeRun?.vehicle?.licensePlate || "ALBERTA • 7VC-894",
      driverName: activeRun?.driver?.publicName || activeRun?.driver?.name || "Marc Tremblay",
      trackingUrl,
      bookingReference: booking.bookingReference,
    });

    if (result.success) {
      // Record notification for strict idempotency
      await prisma.whatsAppNotification.create({
        data: {
          bookingId: booking.id,
          type: "T_60_TRACKING",
          phone: booking.customerPhone,
          messageId: result.messageId,
          status: "SENT",
        },
      });
    }

    return {
      success: result.success,
      trackingToken,
      trackingUrl,
      error: result.error,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Automated T-60 Batch Scheduler
// ---------------------------------------------------------------------------
export async function dispatchT60ScheduledBatch(): Promise<{
  processed: number;
  dispatched: number;
  skipped: number;
}> {
  const today = todayInMountainTime();

  // Find all confirmed departures for today (Banff's operating day)
  const departures = await prisma.tourDeparture.findMany({
    where: {
      date: dateOnly(today),
      status: { not: "CANCELLED" },
    },
    include: {
      bookings: {
        where: { status: "CONFIRMED" },
      },
    },
  });

  let processed = 0;
  let dispatched = 0;
  let skipped = 0;

  for (const dep of departures) {
    for (const b of dep.bookings) {
      processed++;
      const res = await dispatchShuttleTrackingAlert(b.id);
      if (res.alreadySent) {
        skipped++;
      } else if (res.success) {
        dispatched++;
      }
    }
  }

  return { processed, dispatched, skipped };
}
