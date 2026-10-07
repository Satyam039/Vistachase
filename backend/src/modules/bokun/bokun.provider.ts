import prisma from "@/lib/db/prisma";
import { CATALOG, PRODUCT_MAP, bokunKey, slugForBokunId } from "@/modules/bokun/product-map";

export interface BokunProduct {
  /** Bokun experience ID, or `pending:<slug>` until Vista Chase provides it (see product-map.ts). */
  id: string;
  slug: string;
  title: string;
  category: "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY" | "TICKET";
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
// The 13 live vistachase.com products, from the product mapping table
// (prisma/catalog/product-map.json) and the content imported from the live site.
// ---------------------------------------------------------------------------
function durationHours(facts: { label: string; value: string }[]) {
  const text = facts.find((f) => /duration/i.test(f.label))?.value ?? "";
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (nums.length === 0) return 8;
  if (/day/i.test(text)) return nums[0] * 24;
  return nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
}

export const BOKUN_CATALOG_PRODUCTS: BokunProduct[] = PRODUCT_MAP.map((product) => {
  const content = CATALOG.find((c) => c.slug === product.slug);
  const perGroup = product.category === "PRIVATE" || product.category === "MULTIDAY";
  return {
    id: bokunKey(product),
    slug: product.slug,
    title: content?.title ?? product.slug,
    category: product.category,
    durationHours: durationHours(content?.facts ?? []),
    capacity: perGroup ? 13 : 12,
    basePrice: content?.priceFrom ?? 0,
    currency: "CAD",
  };
});

/** Bokun-shaped product ID for a website slug (real ID once provided). */
const keyFor = (slug: string) => BOKUN_CATALOG_PRODUCTS.find((p) => p.slug === slug)!.id;

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
          productBokunId: keyFor("banff-highlights-tour"),
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
          productBokunId: keyFor("banff-highlights-tour"),
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
          productBokunId: keyFor("sunrise-shuttle-to-moraine-lake-and-lake-louise"),
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
          // Bokun ID → website product via the mapping table (works for pending placeholders too)
          const tour = await prisma.tour.findFirst({
            where: { slug: slugForBokunId(item.productBokunId) ?? "banff-highlights-tour" },
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
