// Activity add-ons (owner's doc, Pricing, 2026-11-04): Lake Minnewanka Cruise, Columbia Icefield
// Skywalk, Ice Explorer Experience and Maligne Lake Cruise, offered only with the tours whose
// itinerary has that activity, in summer (June 1 to October 10; "N/A" in winter). Their price
// "varies", so nothing is charged online: the guest asks for them at checkout, and the team
// confirms the price and time using the party's numbers and ages (adults 16–99, youth 6–15,
// infants 0–5). The request is kept in the booking's price snapshot and as a line of its special
// requests, so staff see it in the booking, the manifest, the voucher and the Bókun booking note.
// Frontend mirror: frontend/src/lib/activityAddOns.ts.

import { z } from "@/lib/security/validate";

export const ACTIVITY_ADD_ONS = {
  "lake-minnewanka-cruise": "Lake Minnewanka Cruise",
  "columbia-icefield-skywalk": "Columbia Icefield Skywalk",
  "ice-explorer": "Ice Explorer Experience",
  "maligne-lake-cruise": "Maligne Lake Cruise",
} as const;

export type ActivityAddOnId = keyof typeof ACTIVITY_ADD_ONS;

/** The add-ons each tour's itinerary allows. Shared Icefield already includes its glacier tickets in summer. */
export const ADD_ONS_BY_TOUR: Record<string, ActivityAddOnId[]> = {
  "banff-highlights-tour": ["lake-minnewanka-cruise"],
  "banff-private-tour": ["lake-minnewanka-cruise"],
  "icefields-jasper-private-tour": ["columbia-icefield-skywalk", "ice-explorer"],
};

const IDS = Object.keys(ACTIVITY_ADD_ONS) as [ActivityAddOnId, ...ActivityAddOnId[]];
export const activityAddOnsSchema = z.array(z.enum(IDS)).max(IDS.length);

/** June 1 to October 10, for a YYYY-MM-DD date. */
function inSeason(date: string) {
  const md = date.slice(5, 10);
  return md >= "06-01" && md <= "10-10";
}

/** Add-ons this tour offers on this date (YYYY-MM-DD). */
export function activityAddOnsFor(tourSlug: string | null | undefined, date: string): ActivityAddOnId[] {
  if (!tourSlug || !inSeason(date)) return [];
  return ADD_ONS_BY_TOUR[tourSlug] ?? [];
}

/** Why these add-ons can't be requested on this departure, if they can't. */
export function activityAddOnsError(ids: ActivityAddOnId[], tourSlug: string | null | undefined, date: string): string | null {
  const offered = activityAddOnsFor(tourSlug, date);
  const refused = ids.filter((id) => !offered.includes(id));
  if (refused.length === 0) return null;
  return `${refused.map((id) => ACTIVITY_ADD_ONS[id]).join(", ")} can't be added to this departure.`;
}

/** The line staff read in the booking's special requests. */
export function activityAddOnsNote(ids: ActivityAddOnId[], party: { adults: number; children: number; infants: number }): string {
  const guests = [
    `${party.adults} adult${party.adults === 1 ? "" : "s"} (16–99)`,
    party.children ? `${party.children} youth (6–15)` : null,
    party.infants ? `${party.infants} infant${party.infants === 1 ? "" : "s"} (0–5)` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `Activity add-ons requested: ${ids.map((id) => ACTIVITY_ADD_ONS[id]).join(", ")} for ${guests} (price varies, to be confirmed by Vista Chase).`;
}
