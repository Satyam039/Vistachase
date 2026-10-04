import prisma from "@/lib/db/prisma";

export interface BokunProduct {
  id: string; // e.g. "1142134"
  slug: string;
  title: string;
  category: "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY";
  durationHours: number;
  capacity: number;
  basePrice: number;
  currency: string;
}

export interface BokunBookingPayload {
  bokunBookingId: string;
  bookingReference: string; // e.g. "VC-2026-98412"
  productBokunId: string;
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalSeats: number;
  pickupLocation: string;
  pickupTime?: string;
  status: "CONFIRMED" | "CANCELLED";
  totalAmount: number;
  currency: string;
  sourceChannel: "WEBSITE" | "VIATOR" | "GETYOURGUIDE" | "DIRECT";
  specialRequests?: string;
}

export interface BokunSyncResult {
  syncedCount: number;
  updatedCount: number;
  errors: string[];
}

export interface IBookingOperationsProvider {
  fetchProducts(): Promise<BokunProduct[]>;
  syncTodaysBookings(date: string): Promise<BokunSyncResult>;
  handleBookingWebhook(payload: unknown): Promise<{ success: boolean; bookingReference?: string; error?: string }>;
}

// ---------------------------------------------------------------------------
// Authoritative 13 Live Bókun Products (from Vista Chase Revamp Roadmap, p. 4)
// ---------------------------------------------------------------------------
export const BOKUN_CATALOG_PRODUCTS: BokunProduct[] = [
  // Shared Tours (max 12 guests)
  {
    id: "1142134",
    slug: "banff-highlights-tour",
    title: "Lake Louise, Moraine Lake & Banff Highlights Tour",
    category: "SHARED",
    durationHours: 10,
    capacity: 12,
    basePrice: 189.0,
    currency: "CAD",
  },
  {
    id: "1114197",
    slug: "shared-tours-heart-of-banff",
    title: "Heart of Banff Alpine Explorer",
    category: "SHARED",
    durationHours: 9,
    capacity: 12,
    basePrice: 175.0,
    currency: "CAD",
  },
  {
    id: "1113741",
    slug: "shared-tours-banff-yoho",
    title: "Banff + Yoho National Park & Emerald Lake",
    category: "SHARED",
    durationHours: 10,
    capacity: 12,
    basePrice: 199.0,
    currency: "CAD",
  },
  {
    id: "1114201",
    slug: "shared-tours-icefields-jasper",
    title: "Icefields Parkway & Athabasca Glacier Expedition",
    category: "SHARED",
    durationHours: 11,
    capacity: 12,
    basePrice: 229.0,
    currency: "CAD",
  },
  {
    id: "1114208",
    slug: "winter-special",
    title: "Abraham Lake Ice Bubbles & Winter Wonders",
    category: "SHARED",
    durationHours: 9,
    capacity: 12,
    basePrice: 185.0,
    currency: "CAD",
  },

  // Private Tours (per vehicle)
  {
    id: "1167962",
    slug: "banff-private-tour",
    title: "Luxury Private SUV Tour: Banff & Lake Louise",
    category: "PRIVATE",
    durationHours: 11,
    capacity: 6,
    basePrice: 1250.0,
    currency: "CAD",
  },
  {
    id: "856008",
    slug: "icefields-jasper-private-tour",
    title: "Private Columbia Icefield & Jasper Experience",
    category: "PRIVATE",
    durationHours: 11,
    capacity: 6,
    basePrice: 1450.0,
    currency: "CAD",
  },
  {
    id: "1136438",
    slug: "winter-signature-private-tour",
    title: "Winter Signature Private Rockies Safari",
    category: "PRIVATE",
    durationHours: 9,
    capacity: 6,
    basePrice: 1350.0,
    currency: "CAD",
  },
  {
    id: "BOKUN-CUSTOM-1",
    slug: "banff-yoho-custom-private-tour",
    title: "Custom Private Rockies Charter: Banff & Yoho",
    category: "PRIVATE",
    durationHours: 11,
    capacity: 6,
    basePrice: 1400.0,
    currency: "CAD",
  },

  // Shuttles & Packages
  {
    id: "928996",
    slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
    title: "Sunrise Commercial Shuttle: Moraine Lake & Lake Louise",
    category: "SHUTTLE",
    durationHours: 5,
    capacity: 14,
    basePrice: 89.0,
    currency: "CAD",
  },
  {
    id: "933218",
    slug: "full-day-at-lake-louise-and-moraine-lake",
    title: "Full Day Express Shuttle: Lake Louise & Moraine Lake",
    category: "SHUTTLE",
    durationHours: 8,
    capacity: 14,
    basePrice: 95.0,
    currency: "CAD",
  },
  {
    id: "BOKUN-MULTIDAY-1",
    slug: "multi-day-tour-package-for-banff",
    title: "Complete Canadian Rockies 3-Day Luxury Adventure",
    category: "MULTIDAY",
    durationHours: 24,
    capacity: 8,
    basePrice: 2890.0,
    currency: "CAD",
  },
  {
    id: "BOKUN-CUSTOM-2",
    slug: "jasper-custom-private-tour",
    title: "Customized Jasper Wildlife & Alpine Charter",
    category: "PRIVATE",
    durationHours: 12,
    capacity: 6,
    basePrice: 1550.0,
    currency: "CAD",
  },
];

// ---------------------------------------------------------------------------
// Mock Bókun Operations Provider (Zero-Cost Dev & Testing)
// ---------------------------------------------------------------------------
export class MockBokunOperationsProvider implements IBookingOperationsProvider {
  async fetchProducts(): Promise<BokunProduct[]> {
    return BOKUN_CATALOG_PRODUCTS;
  }

  async syncTodaysBookings(date: string): Promise<BokunSyncResult> {
    const errors: string[] = [];
    let syncedCount = 0;
    let updatedCount = 0;

    try {
      // 1. Realistic mock booking stream from Bókun (direct website + OTA channels)
      const mockBokunBookings: BokunBookingPayload[] = [
        {
          bokunBookingId: `BK-OTA-VIATOR-${date}-001`,
          bookingReference: `VC-${date.replace(/-/g, "")}-V1`,
          productBokunId: "1142134",
          departureDate: date,
          departureTime: "08:30",
          customerName: "Liam Hemsworth",
          customerEmail: "liam.h@example.com",
          customerPhone: "+1-604-555-0182",
          totalSeats: 3,
          pickupLocation: "Fairmont Banff Springs Hotel",
          pickupTime: "08:15",
          status: "CONFIRMED",
          totalAmount: 567.0,
          currency: "CAD",
          sourceChannel: "VIATOR",
          specialRequests: "Family travelling with child, booster seat requested.",
        },
        {
          bokunBookingId: `BK-OTA-GYG-${date}-002`,
          bookingReference: `VC-${date.replace(/-/g, "")}-G2`,
          productBokunId: "1142134",
          departureDate: date,
          departureTime: "08:30",
          customerName: "Elena Rostova",
          customerEmail: "elena.r@example.com",
          customerPhone: "+44-7700-900077",
          totalSeats: 2,
          pickupLocation: "Moose Hotel & Suites",
          pickupTime: "08:20",
          status: "CONFIRMED",
          totalAmount: 378.0,
          currency: "CAD",
          sourceChannel: "GETYOURGUIDE",
        },
        {
          bokunBookingId: `BK-DIRECT-${date}-003`,
          bookingReference: `VC-${date.replace(/-/g, "")}-D3`,
          productBokunId: "928996",
          departureDate: date,
          departureTime: "05:00",
          customerName: "Arthur Pendelton",
          customerEmail: "arthur.p@example.com",
          customerPhone: "+1-403-555-0144",
          totalSeats: 2,
          pickupLocation: "Banff Caribou Lodge",
          pickupTime: "04:45",
          status: "CONFIRMED",
          totalAmount: 178.0,
          currency: "CAD",
          sourceChannel: "WEBSITE",
          specialRequests: "Landscape photographers bringing tripod cases.",
        },
      ];

      for (const item of mockBokunBookings) {
        // Find or map tour departure
        let departure = await prisma.tourDeparture.findFirst({
          where: {
            date: item.departureDate,
            departureTime: item.departureTime,
          },
        });

        if (!departure) {
          // Find matching tour
          const tour = await prisma.tour.findFirst({
            where: {
              OR: [
                { bokunId: item.productBokunId },
                { slug: "banff-highlights-tour" },
              ],
            },
          });

          departure = await prisma.tourDeparture.create({
            data: {
              tourId: tour?.id,
              date: item.departureDate,
              departureTime: item.departureTime,
              capacityTotal: 14,
              capacityBooked: 0,
              capacityHeld: 0,
              price: item.totalAmount / item.totalSeats,
              status: "ACTIVE",
            },
          });
        }

        // Match hotel pickup stop
        const pickupStop = await prisma.shuttleStop.findFirst({
          where: {
            name: {
              contains: item.pickupLocation.split(" ")[0],
            },
          },
        });

        // Upsert booking idempotently by bokunBookingId
        const existing = await prisma.booking.findFirst({
          where: {
            OR: [
              { bokunBookingId: item.bokunBookingId },
              { bookingReference: item.bookingReference },
            ],
          },
        });

        if (existing) {
          await prisma.booking.update({
            where: { id: existing.id },
            data: {
              customerName: item.customerName,
              customerEmail: item.customerEmail,
              customerPhone: item.customerPhone,
              totalSeats: item.totalSeats,
              status: item.status,
              specialRequests: item.specialRequests || existing.specialRequests,
            },
          });
          updatedCount++;
        } else {
          await prisma.booking.create({
            data: {
              bookingReference: item.bookingReference,
              bokunBookingId: item.bokunBookingId,
              customerName: item.customerName,
              customerEmail: item.customerEmail,
              customerPhone: item.customerPhone,
              tourDepartureId: departure.id,
              pickupStopId: pickupStop?.id,
              pickupCustomText: pickupStop ? null : item.pickupLocation,
              pickupTime: item.pickupTime || item.departureTime,
              adultsCount: item.totalSeats,
              totalSeats: item.totalSeats,
              subtotal: item.totalAmount,
              totalAmount: item.totalAmount,
              status: item.status,
              specialRequests: item.specialRequests,
              voucherCode: `VC-BK-${item.bookingReference.replace(/[^A-Za-z0-9]/g, "").slice(-6)}`,
            },
          });
          syncedCount++;
        }
      }

      // Record sync log
      await prisma.bokunSyncLog.create({
        data: {
          syncType: "POLL",
          recordsSynced: syncedCount + updatedCount,
          status: "SUCCESS",
          details: JSON.stringify({ syncedCount, updatedCount, date }),
        },
      });

      return {
        syncedCount,
        updatedCount,
        errors,
      };
    } catch (err: any) {
      console.error("[BokunProvider] Sync error:", err);
      errors.push(err.message || "Failed to sync Bókun bookings");

      await prisma.bokunSyncLog.create({
        data: {
          syncType: "POLL",
          recordsSynced: 0,
          status: "FAILED",
          details: err.message,
        },
      });

      return { syncedCount, updatedCount, errors };
    }
  }

  async handleBookingWebhook(payload: any): Promise<{ success: boolean; bookingReference?: string; error?: string }> {
    try {
      if (!payload || !payload.bookingReference) {
        return { success: false, error: "Missing required bookingReference in webhook payload" };
      }

      // Process real-time booking update
      return {
        success: true,
        bookingReference: payload.bookingReference,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Factory
// ---------------------------------------------------------------------------
let bokunProviderInstance: IBookingOperationsProvider | null = null;

export function getBokunOperationsProvider(): IBookingOperationsProvider {
  if (!bokunProviderInstance) {
    bokunProviderInstance = new MockBokunOperationsProvider();
  }
  return bokunProviderInstance;
}
