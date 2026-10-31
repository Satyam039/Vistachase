// Bókun connection settings (server .env). The website stays the booking system guests use; with
// the keys set, every confirmed booking is also created in Bókun and cancellations follow
// (bokun-sync.ts), and Bókun's seat counts are read into the calendar (availability-sync.ts).
// Without the keys nothing calls Bókun. Docs: docs/BOKUN.md.

import { BokunApiClient } from "@/modules/bokun/bokun.client";

/** Live API by default; BOKUN_API_URL=https://api.bokuntest.com for a Bókun test account. */
export function bokunConfig() {
  return {
    apiUrl: process.env.BOKUN_API_URL || "https://api.bokun.io",
    accessKey: process.env.BOKUN_ACCESS_KEY || "",
    secretKey: process.env.BOKUN_SECRET_KEY || "",
  };
}

/** True once both API keys are set. */
export function bokunConfigured() {
  const { accessKey, secretKey } = bokunConfig();
  return Boolean(accessKey && secretKey);
}

/** Seats from Bókun into the calendar; on with the keys unless BOKUN_AVAILABILITY_SYNC=false. */
export function bokunAvailabilitySyncEnabled() {
  return bokunConnected() && process.env.BOKUN_AVAILABILITY_SYNC !== "false";
}

/** How many days ahead the seat sync reads (BOKUN_SYNC_DAYS, default 90). */
export function bokunSyncDays() {
  const days = Number(process.env.BOKUN_SYNC_DAYS);
  return Number.isInteger(days) && days > 0 && days <= 365 ? days : 90;
}

/** The subset of the API client the sync uses, so tests can stand in for Bókun. */
export type BokunApi = Pick<BokunApiClient, "fetch" | "getAvailabilities">;

let testClient: BokunApi | null = null;

/** True when bookings go to Bókun: keys set (or a test stand-in installed). */
export function bokunConnected() {
  return testClient !== null || bokunConfigured();
}

/** The live API client (null without keys), or the stand-in a test installed. */
export function bokunClient(): BokunApi | null {
  if (testClient) return testClient;
  if (!bokunConfigured()) return null;
  const config = bokunConfig();
  return new BokunApiClient(config.accessKey, config.secretKey, config.apiUrl);
}

/** Tests: answer as Bókun with `client` (null restores the real one). */
export function setBokunClientForTests(client: BokunApi | null) {
  testClient = client;
}
