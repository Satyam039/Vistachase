import prisma from "@/lib/db/prisma";
import { CATALOG, PRODUCT_MAP, bokunKey, slugForBokunId } from "@/modules/bokun/product-map";
import { abortInBokun, cancelInBokun, confirmInBokun, reserveInBokun, type BokunPayment, type BokunReservationInput } from "./bokun-booking";

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

export interface BokunSyncResult {
  syncedCount: number;
  updatedCount: number;
  errors: string[];
}

export interface IBookingOperationsProvider {
  fetchProducts(): Promise<BokunProduct[]>;
  syncTodaysBookings(date: string): Promise<BokunSyncResult>;
  /** Holds the seats in Bókun while the guest pays; returns Bókun's confirmation code. */
  reserve(input: BokunReservationInput): Promise<string>;
  /** Confirms a reservation once paid. */
  confirmReservation(code: string, bookingReference: string, payment: BokunPayment): Promise<void>;
  /** Releases a reservation that was never paid. */
  abortReservation(code: string): Promise<void>;
  cancelBooking(code: string): Promise<void>;
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


  async reserve(input: BokunReservationInput): Promise<string> {
    return `MOCK-${input.bookingReference}`;
  }

  async confirmReservation(): Promise<void> {}

  async abortReservation(): Promise<void> {}

  async cancelBooking(): Promise<void> {}

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

  reserve(input: BokunReservationInput): Promise<string> {
    return reserveInBokun(this.client, input);
  }

  confirmReservation(code: string, bookingReference: string, payment: BokunPayment): Promise<void> {
    return confirmInBokun(this.client, code, bookingReference, payment);
  }

  abortReservation(code: string): Promise<void> {
    return abortInBokun(this.client, code);
  }

  cancelBooking(code: string): Promise<void> {
    return cancelInBokun(this.client, code);
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

/** Tests: swap in a stand-in provider (null goes back to the default). */
export function setBokunOperationsProvider(provider: IBookingOperationsProvider | null) {
  bokunProviderInstance = provider;
}
