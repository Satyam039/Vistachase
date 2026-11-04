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
