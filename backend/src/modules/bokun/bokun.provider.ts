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
  /** Lowest price in dollars, as Bókun reports it (departures store cents). */
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
  promoCode?: string;
}

export interface BokunSyncResult {
  syncedCount: number;
  updatedCount: number;
  errors: string[];
}

export interface IBookingOperationsProvider {
  fetchProducts(): Promise<BokunProduct[]>;
  syncTodaysBookings(date: string): Promise<BokunSyncResult>;
  createReservation(payload: BokunBookingPayload): Promise<{ bokunBookingId: string; totalAmount: number }>;
  confirmReservation(bokunBookingId: string): Promise<void>;
  cancelBooking(bokunBookingId: string): Promise<void>;
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
    basePrice: content?.priceFrom ?? 0, // dollars, like Bókun; departures store cents
    currency: "CAD",
  };
});

/** Bokun-shaped product ID for a website slug (real ID once provided). */
const keyFor = (slug: string) => BOKUN_CATALOG_PRODUCTS.find((p) => p.slug === slug)!.id;

// ---------------------------------------------------------------------------
// Mock Bókun Operations Provider (Zero-Cost Dev & Testing)
// ---------------------------------------------------------------------------
import { DepartureStatus } from "@prisma/client";
export class MockBokunOperationsProvider implements IBookingOperationsProvider {
  async fetchProducts(): Promise<BokunProduct[]> {
    return BOKUN_CATALOG_PRODUCTS;
  }
  
  async syncTodaysBookings(date: string): Promise<BokunSyncResult> {
    return { syncedCount: 0, updatedCount: 0, errors: [] };
  }


  async createReservation(payload: BokunBookingPayload): Promise<{ bokunBookingId: string; totalAmount: number }> {
    // Bókun reservation endpoint logic
    // Usually POST /booking.json/create
    const bokunPayload = {
      productActivityId: payload.productBokunId,
      date: payload.departureDate,
      time: payload.departureTime,
      passengers: payload.totalSeats,
      channelId: process.env.BOKUN_ONLINE_SALES_CHANNEL_ID || "90615648-3c90-4d07-9dac-d39089e7728b",
      // Add more specifics like customer info, pricing categories, pickup...
    };
    
    // As a placeholder for real API call which requires specific IDs
    console.log("[BokunLive] Reserving in Bókun:", bokunPayload);
    // const result = await this.client.post("/booking.json/create", bokunPayload);
    // For now return dummy until we map exact Bókun payload
    return { bokunBookingId: `live_bokun_${Date.now()}`, totalAmount: payload.totalAmount };
  }

  async confirmReservation(bokunBookingId: string): Promise<void> {
    console.log(`[BokunLive] Confirming booking ${bokunBookingId} in Bókun.`);
    // await this.client.post(`/booking.json/${bokunBookingId}/confirm`, {});
  }

  async cancelBooking(bokunBookingId: string): Promise<void> {
    console.log(`[BokunLive] Cancelling booking ${bokunBookingId} in Bókun.`);
    // await this.client.post(`/booking.json/${bokunBookingId}/cancel`, { note: "Cancelled by Vista Chase" });
  }

  async handleBookingWebhook(payload: unknown): Promise<{ success: boolean; bookingReference?: string; error?: string }> {
    return { success: true };
  }
}

import { BokunApiClient } from "./bokun.client";
import { bokunConfig } from "./product-map";
import { bokunApiSource, syncBokunAvailability } from "./availability-sync";

export class LiveBokunOperationsProvider implements IBookingOperationsProvider {
  private client: BokunApiClient;

  constructor() {
    const config = bokunConfig();
    this.client = new BokunApiClient(config.accessKey, config.secretKey, config.apiUrl);
  }

  async fetchProducts(): Promise<BokunProduct[]> {
    const data: any = await this.client.getProducts();
    const items = data?.items || [];
    return items.map((p: any) => ({
      id: String(p.id),
      slug: p.slug || String(p.id),
      title: p.title,
      category: "SHARED",
      durationHours: 8,
      capacity: 14,
      basePrice: p.nextDefaultPrice || 0,
      currency: "CAD"
    }));
  }

  /** Departures, seats and prices for one day, read from Bókun (see availability-sync.ts). */
  async syncTodaysBookings(date: string): Promise<BokunSyncResult> {
    const result = await syncBokunAvailability({ source: bokunApiSource(this.client), days: 1, from: date });
    return { syncedCount: result.created, updatedCount: result.updated, errors: result.errors };
  }

  async createReservation(payload: BokunBookingPayload): Promise<{ bokunBookingId: string; totalAmount: number }> {
    // Bókun reservation endpoint logic
    // Usually POST /booking.json/create
    const bokunPayload = {
      productActivityId: payload.productBokunId,
      date: payload.departureDate,
      time: payload.departureTime,
      passengers: payload.totalSeats,
      channelId: process.env.BOKUN_ONLINE_SALES_CHANNEL_ID || "90615648-3c90-4d07-9dac-d39089e7728b",
      // Add more specifics like customer info, pricing categories, pickup...
    };
    
    // As a placeholder for real API call which requires specific IDs
    console.log("[BokunLive] Reserving in Bókun:", bokunPayload);
    // const result = await this.client.post("/booking.json/create", bokunPayload);
    // For now return dummy until we map exact Bókun payload
    return { bokunBookingId: `live_bokun_${Date.now()}`, totalAmount: payload.totalAmount };
  }

  async confirmReservation(bokunBookingId: string): Promise<void> {
    console.log(`[BokunLive] Confirming booking ${bokunBookingId} in Bókun.`);
    // await this.client.post(`/booking.json/${bokunBookingId}/confirm`, {});
  }

  async cancelBooking(bokunBookingId: string): Promise<void> {
    console.log(`[BokunLive] Cancelling booking ${bokunBookingId} in Bókun.`);
    // await this.client.post(`/booking.json/${bokunBookingId}/cancel`, { note: "Cancelled by Vista Chase" });
  }

  async handleBookingWebhook(payload: unknown): Promise<{ success: boolean; bookingReference?: string; error?: string }> {
    return { success: true };
  }
}

let bokunProviderInstance: IBookingOperationsProvider | null = null;

export function getBokunOperationsProvider(): IBookingOperationsProvider {
  if (process.env.NODE_ENV === "production" && process.env.FEATURE_MOCK_BOKUN !== "true") {
    if (!bokunProviderInstance) {
      bokunProviderInstance = new LiveBokunOperationsProvider();
    }
    return bokunProviderInstance;
  }
  if (!bokunProviderInstance) {
    bokunProviderInstance = new MockBokunOperationsProvider();
  }
  return bokunProviderInstance;
}
