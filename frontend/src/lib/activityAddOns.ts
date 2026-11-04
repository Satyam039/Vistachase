// Optional activities at checkout (owner's doc pricing table, 2026-11-04), offered only on tours whose
// itinerary visits them. Prices vary by date and age, so nothing is charged online: the team confirms
// the price for the party (adults, youth, infants) and books the tickets. Same list as backend
// modules/bookings/activity-addons.ts, which checks the choice again.

export type ActivityId = "minnewankaCruise" | "iceExplorer" | "skywalk";

export const ACTIVITY_ADD_ONS: { id: ActivityId; name: string; detail: string; tours: string[] }[] = [
  {
    id: "minnewankaCruise",
    name: "Lake Minnewanka Cruise",
    detail: "A sightseeing cruise on Banff's largest lake, in season.",
    tours: ["banff-highlights-tour", "banff-private-tour"],
  },
  {
    id: "iceExplorer",
    name: "Columbia Icefield Ice Explorer",
    detail: "Ride onto the Athabasca Glacier, in season.",
    tours: ["icefields-jasper-private-tour"],
  },
  {
    id: "skywalk",
    name: "Columbia Icefield Skywalk",
    detail: "The glass-floored walkway above the Sunwapta Valley, in season.",
    tours: ["icefields-jasper-private-tour"],
  },
];

export const activitiesFor = (slug: string | undefined) => ACTIVITY_ADD_ONS.filter((a) => slug && a.tours.includes(slug));
