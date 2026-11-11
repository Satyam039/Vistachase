// Activity add-ons (owner's doc, Pricing, 2026-11-04): offered only with the tours whose itinerary
// has the activity, June 1 to October 10. Their price varies, so checkout only records the request;
// the team confirms the price and time using the party's numbers and ages. Mirrors
// backend/src/modules/bookings/activity-add-ons.ts, which checks every request.

export const ACTIVITY_ADD_ONS = {
  "lake-minnewanka-cruise": "Lake Minnewanka Cruise",
  "columbia-icefield-skywalk": "Columbia Icefield Skywalk",
  "ice-explorer": "Ice Explorer Experience",
  "maligne-lake-cruise": "Maligne Lake Cruise",
} as const;

export type ActivityAddOnId = keyof typeof ACTIVITY_ADD_ONS;

const ADD_ONS_BY_TOUR: Record<string, ActivityAddOnId[]> = {
  "banff-highlights-tour": ["lake-minnewanka-cruise"],
  "banff-private-tour": ["lake-minnewanka-cruise"],
  "icefields-jasper-private-tour": ["columbia-icefield-skywalk", "ice-explorer"],
};

/** Add-ons this tour offers on this date (YYYY-MM-DD…). */
export function activityAddOnsFor(tourSlug: string | null | undefined, date: string): ActivityAddOnId[] {
  const md = date.slice(5, 10);
  if (!tourSlug || md < "06-01" || md > "10-10") return [];
  return ADD_ONS_BY_TOUR[tourSlug] ?? [];
}

export const ACTIVITY_ADD_ON_PRICE_NOTE = "Price varies; our team confirms it with you before your tour";

/** Owner's wording (2026-11-09) under the "Add-on activities" tick box on private tours. */
export const ACTIVITY_ADD_ONS_NOTE =
  "Add-on activities are not included in your tour price. We\u2019ll arrange tickets on your behalf and collect payment separately once confirmed. Prices are subject to change, and activity timings will be coordinated with your tour itinerary.";

/** Who joins the add-on activities (owner, 2026-11-11): adults, children and infants with their ages. */
export interface ActivityGuests {
  adults: number;
  children: number;
  infants: number;
}

/** The age ranges, the same as the tour's (backend activity-add-ons.ts). */
export const ACTIVITY_AGE_BANDS: { key: keyof ActivityGuests; label: string; ages: string; short: [string, string] }[] = [
  { key: "adults", label: "Adults", ages: "Ages 16–99", short: ["adult", "adults"] },
  { key: "children", label: "Children", ages: "Ages 6–15", short: ["child", "children"] },
  { key: "infants", label: "Infants", ages: "Ages 0–5", short: ["infant", "infants"] },
];

/** Everyone in the party as adults, the starting point when the box is ticked. */
export const activityGuestsFor = (partySize: number): ActivityGuests => ({ adults: Math.max(1, partySize), children: 0, infants: 0 });

/** "2 adults (16–99), 1 child (6–15)". */
export function activityGuestsLabel(g: ActivityGuests): string {
  return ACTIVITY_AGE_BANDS.filter((b) => g[b.key] > 0)
    .map((b) => `${g[b.key]} ${b.short[g[b.key] === 1 ? 0 : 1]} (${b.ages.replace("Ages ", "")})`)
    .join(", ");
}

/** The line added to a booking's special requests when the guest ticks "Add-on activities". */
export function activityAddOnsRequestLine(names: string[], guests?: ActivityGuests): string {
  const who = guests && guests.adults + guests.children + guests.infants > 0 ? ` for ${activityGuestsLabel(guests)}` : "";
  return names.length > 0
    ? `Add-on activities requested: ${names.join(", ")}${who} (tickets arranged by our team, paid separately).`
    : `Add-on activities requested${who} (tickets arranged by our team, paid separately).`;
}

/** The activity guests from the tour page's link (?actAdults=&actChildren=&actInfants=). */
export function activityGuestsFromQuery(q: { actAdults?: string; actChildren?: string; actInfants?: string }): ActivityGuests | null {
  if (q.actAdults == null && q.actChildren == null && q.actInfants == null) return null;
  const n = (v?: string) => Math.max(0, Math.min(30, Number.parseInt(v ?? "0", 10) || 0));
  return { adults: n(q.actAdults), children: n(q.actChildren), infants: n(q.actInfants) };
}
