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
  "ice-explorer-skywalk": "Ice Explorer + Skywalk (combined experience)",
} as const;

export type ActivityAddOnId = keyof typeof ACTIVITY_ADD_ONS;

/** The add-ons each tour's itinerary allows. Shared Icefield already includes its glacier tickets in summer. */
export const ADD_ONS_BY_TOUR: Record<string, ActivityAddOnId[]> = {
  "banff-highlights-tour": ["lake-minnewanka-cruise"],
  "banff-private-tour": ["lake-minnewanka-cruise"],
  // Owner, 2026-11-24: one combined experience on the private tour, never Ice Explorer or Skywalk
  // on their own. Requested with a participant count; tickets are invoiced separately.
  "icefields-jasper-private-tour": ["ice-explorer-skywalk"],
};

/** Add-ons booked as one ticket request for a number of participants (not priced by age). */
export const COMBINED_ADD_ONS: ReadonlySet<ActivityAddOnId> = new Set(["ice-explorer-skywalk"]);

/** Participants for a combined add-on: at least one, never more than the party. */
export const activityParticipantsSchema = z.number().int().min(1).max(30);

/** Why the participant count can't be accepted, if it can't. */
export function activityParticipantsError(ids: ActivityAddOnId[], participants: number | undefined, partySize: number): string | null {
  if (!ids.some((id) => COMBINED_ADD_ONS.has(id))) return null;
  if (participants == null || participants < 1) return "Enter how many guests would like Ice Explorer + Skywalk.";
  if (participants > partySize) return `Ice Explorer + Skywalk can be requested for up to ${partySize} ${partySize === 1 ? "guest" : "guests"}, your group size.`;
  return null;
}

/**
 * The staff line for a combined ticket request: a request, not a confirmed reservation; tickets are
 * arranged by staff and invoiced separately, outside the tour payment.
 */
export function combinedAddOnNote(id: ActivityAddOnId, participants: number, partySize: number): string {
  return `TICKET REQUEST (not a confirmed reservation): ${ACTIVITY_ADD_ONS[id]} for ${participants} of ${partySize} ${partySize === 1 ? "guest" : "guests"}. Staff to arrange tickets and send a separate invoice; not included in the private tour payment.`;
}

const IDS = Object.keys(ACTIVITY_ADD_ONS) as [ActivityAddOnId, ...ActivityAddOnId[]];
export const activityAddOnsSchema = z.array(z.enum(IDS)).max(IDS.length);

/** Who joins the activities, with ages (owner, 2026-11-11): adults 16–99, children 6–15, infants 0–5. */
export const activityGuestsSchema = z.object({
  adults: z.number().int().min(0).max(30),
  children: z.number().int().min(0).max(30),
  infants: z.number().int().min(0).max(30),
});
export type ActivityGuests = z.infer<typeof activityGuestsSchema>;

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
    party.adults ? `${party.adults} adult${party.adults === 1 ? "" : "s"} (16–99)` : null,
    party.children ? `${party.children} ${party.children === 1 ? "child" : "children"} (6–15)` : null,
    party.infants ? `${party.infants} infant${party.infants === 1 ? "" : "s"} (0–5)` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `Activity add-ons requested: ${ids.map((id) => ACTIVITY_ADD_ONS[id]).join(", ")} for ${guests} (price varies, to be confirmed by Vista Chase).`;
}
