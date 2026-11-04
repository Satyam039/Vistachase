// Optional activities at checkout (owner's doc pricing table, 2026-11-04): Lake Minnewanka Cruise,
// Columbia Icefield Skywalk and Ice Explorer add-ons, offered only on the tours whose itinerary
// visits them. Their prices vary by date and age, so nothing is charged online: the booking records
// which activities the guest wants with the party (adults 16+, youth 6-15, infants 0-5), and the team
// confirms the price and books the tickets. Same list as frontend lib/activityAddOns.ts.

export const ACTIVITY_ADD_ONS = {
  minnewankaCruise: { name: "Lake Minnewanka Cruise", tours: ["banff-highlights-tour", "banff-private-tour"] },
  iceExplorer: { name: "Columbia Icefield Ice Explorer", tours: ["icefields-jasper-private-tour"] },
  skywalk: { name: "Columbia Icefield Skywalk", tours: ["icefields-jasper-private-tour"] },
} as const;

export type ActivityId = keyof typeof ACTIVITY_ADD_ONS;
export const ACTIVITY_IDS = Object.keys(ACTIVITY_ADD_ONS) as [ActivityId, ...ActivityId[]];

/** Activities this tour can't offer, if any were asked for. */
export function unavailableActivities(tourSlug: string | undefined, ids: ActivityId[]): ActivityId[] {
  return ids.filter((id) => !tourSlug || !(ACTIVITY_ADD_ONS[id].tours as readonly string[]).includes(tourSlug));
}

/** The line staff read in the booking's special requests. */
export function activitiesNote(ids: ActivityId[], party: { adults: number; youth: number; infants: number }): string {
  const who = [
    `${party.adults} adult${party.adults === 1 ? "" : "s"} (16+)`,
    party.youth ? `${party.youth} youth (6-15)` : "",
    party.infants ? `${party.infants} infant${party.infants === 1 ? "" : "s"} (0-5)` : "",
  ].filter(Boolean).join(", ");
  const names = [...new Set(ids)].map((id) => ACTIVITY_ADD_ONS[id].name).join(", ");
  return `Optional activities requested: ${names} for ${who} (price varies; Vista Chase confirms it and books the tickets).`;
}
