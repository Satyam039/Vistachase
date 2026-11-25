// Activity add-ons (owner's doc, Pricing, 2026-11-04): offered only with the tours whose itinerary
// has the activity, June 1 to October 10. Their price varies, so checkout only records the request;
// the team confirms the price and time using the party's numbers and ages. Mirrors
// backend/src/modules/bookings/activity-add-ons.ts, which checks every request.

export const ACTIVITY_ADD_ONS = {
  "lake-minnewanka-cruise": "Lake Minnewanka Cruise",
  "columbia-icefield-skywalk": "Columbia Icefield Skywalk",
  "ice-explorer": "Ice Explorer Experience",
  "maligne-lake-cruise": "Maligne Lake Cruise",
  "ice-explorer-skywalk": "Ice Explorer + Skywalk (combined experience)",
} as const;

export type ActivityAddOnId = keyof typeof ACTIVITY_ADD_ONS;

const ADD_ONS_BY_TOUR: Record<string, ActivityAddOnId[]> = {
  "banff-highlights-tour": ["lake-minnewanka-cruise"],
  "banff-private-tour": ["lake-minnewanka-cruise"],
  // Owner, 2026-11-24: one combined experience on the private tour (CombinedAddOnControl).
  "icefields-jasper-private-tour": ["ice-explorer-skywalk"],
};

/**
 * Private Columbia Icefield Adventure (owner, 2026-11-24): Ice Explorer + Skywalk as one combined
 * optional experience, requested for a number of participants (up to the group size), summer dates
 * only. A ticket request, not a confirmed reservation: staff arrange tickets and invoice separately.
 */
export const COMBINED_ADD_ON = {
  id: "ice-explorer-skywalk" as const,
  title: "Ice Explorer + Skywalk \u2014 combined optional experience",
  body:
    "Select how many guests in your group would like to participate. Both attractions are offered together; separate selection is unavailable. Our team arranges tickets and sends a separate invoice for payment. Attraction tickets are not included in your private tour payment.",
  request:
    "This is a ticket request, not a confirmed reservation. We confirm availability and activity times with you, then send the invoice.",
  winter: "Unavailable for winter dates (October 11 \u2013 May 31). Choose a date from June 1 to October 10 to request it.",
};

/** The tour's combined add-on, when it has one (the participant-count control replaces the generic one). */
export function combinedAddOnFor(tourSlug: string | null | undefined): typeof COMBINED_ADD_ON | null {
  return tourSlug && (ADD_ONS_BY_TOUR[tourSlug] ?? []).includes(COMBINED_ADD_ON.id) ? COMBINED_ADD_ON : null;
}

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

/**
 * Optional activities on the private multi-day journeys (owner's Trello card, 2026-11-18): the guest
 * picks each activity and how many people join it (adults, children, infants). Tickets are arranged
 * by the team and paid separately once confirmed (ACTIVITY_ADD_ONS_NOTE); nothing is charged online.
 */
export interface PackageActivity {
  id: string;
  name: string;
  detail: string;
  /** The (i) pop-up: what it is, what's included and useful details. */
  info: { about: string; includes: string[]; good: string[] };
}

const SEASON = "Summer only: June 1 to October 10.";
const ARRANGED = "Tickets booked by our team and timed with your itinerary.";

const ICEFIELD_ADVENTURE: PackageActivity = {
  id: "columbia-icefield-adventure",
  name: "Columbia Icefield Adventure",
  detail: "Ice Explorer onto the Athabasca Glacier and the Columbia Icefield Skywalk (tickets)",
  info: {
    about: "Ride an Ice Explorer onto the Athabasca Glacier and step out onto the ice, then walk the glass-floored Columbia Icefield Skywalk above the Sunwapta Valley.",
    includes: ["Ice Explorer ride with time on the glacier", "Columbia Icefield Skywalk entry", ARRANGED],
    good: ["On your Icefields Parkway day", "Bring a warm layer and good shoes: it is cold on the ice", SEASON],
  },
};
const BANFF_GONDOLA: PackageActivity = {
  id: "banff-gondola",
  name: "Banff Gondola",
  detail: "Ride up Sulphur Mountain for views over Banff",
  info: {
    about: "A gondola ride to the top of Sulphur Mountain, with boardwalks and lookouts over Banff town and six mountain ranges.",
    includes: ["Return gondola ride", "Time at the summit boardwalk and viewing decks", ARRANGED],
    good: ["On your Banff day", "Food at the summit is not included", SEASON],
  },
};
const MINNEWANKA_CRUISE: PackageActivity = {
  id: "lake-minnewanka-cruise",
  name: "Lake Minnewanka Cruise",
  detail: "Sightseeing cruise on Banff's largest lake",
  info: {
    about: "A narrated sightseeing cruise on Lake Minnewanka, the largest lake in Banff National Park, with mountain views and stories of the area.",
    includes: ["Sightseeing cruise ticket", ARRANGED],
    good: ["On your Banff day", "Bring a jacket: it is cooler on the water", SEASON],
  },
};
const MALIGNE_CRUISE: PackageActivity = {
  id: "maligne-lake-cruise",
  name: "Maligne Lake Cruise to Spirit Island",
  detail: "Boat cruise to the Spirit Island viewpoint in Jasper",
  info: {
    about: "A boat cruise across Maligne Lake in Jasper National Park to the Spirit Island viewpoint, one of the most photographed places in the Rockies.",
    includes: ["Cruise ticket with a stop at the Spirit Island viewpoint", ARRANGED],
    good: ["On your Jasper day", "Bring a jacket: it is cooler on the water", SEASON],
  },
};

export const PACKAGE_ACTIVITIES: Record<string, PackageActivity[]> = {
  // Owner, 2026-11-25: the Minnewanka cruise on the Banff & Yoho day, the combined glacier experience on a summer Icefields day.
  "two-day-rockies-explorer-private": [
    {
      ...MINNEWANKA_CRUISE,
      detail: "Banff & Yoho day · optional, tickets extra",
      info: { ...MINNEWANKA_CRUISE.info, good: ["On your Banff & Yoho Discovery tour", "Bring a jacket: it is cooler on the water", SEASON] },
    },
    {
      ...ICEFIELD_ADVENTURE,
      name: "Ice Explorer + Skywalk (combined glacier experience)",
      detail: "Summer Icefields day · one combined optional experience, tickets extra. Individual attraction selection is unavailable.",
      info: { ...ICEFIELD_ADVENTURE.info, good: ["On a summer Columbia Icefield Adventure date (June 1–October 10)", "Ice Explorer and Skywalk can't be chosen separately", "Bring a warm layer and good shoes: it is cold on the ice", SEASON] },
    },
  ],
  // Owner, 2026-11-24: the Banff tour's gondola and Minnewanka cruise, then one combined glacier experience.
  "three-day-rockies-discovery": [
    { ...BANFF_GONDOLA, info: { ...BANFF_GONDOLA.info, good: ["On your Banff Lakes & Viewpoints tour", "Food at the summit is not included", SEASON] } },
    { ...MINNEWANKA_CRUISE, info: { ...MINNEWANKA_CRUISE.info, good: ["On your Banff Lakes & Viewpoints tour", "Bring a jacket: it is cooler on the water", SEASON] } },
    {
      ...ICEFIELD_ADVENTURE,
      name: "Ice Explorer + Skywalk (combined glacier experience)",
      detail: "One combined ticket on your Icefields Parkway tour: Ice Explorer onto the Athabasca Glacier and the Skywalk",
      info: { ...ICEFIELD_ADVENTURE.info, good: ["On your Icefields Parkway & Columbia Icefield tour", "Ice Explorer and Skywalk can't be chosen separately", "Bring a warm layer and good shoes: it is cold on the ice", SEASON] },
    },
  ],
  "four-day-rockies-and-jasper": [
    BANFF_GONDOLA,
    MINNEWANKA_CRUISE,
    // Owner, 2026-11-24: one combined experience, never Ice Explorer or Skywalk on their own.
    {
      ...ICEFIELD_ADVENTURE,
      name: "Ice Explorer + Skywalk (combined glacier experience)",
      detail: "One combined ticket on your Icefields-to-Jasper tour: Ice Explorer onto the Athabasca Glacier and the Skywalk",
      info: { ...ICEFIELD_ADVENTURE.info, good: ["On your Icefields Parkway to Jasper tour", "Ice Explorer and Skywalk can't be chosen separately", "Bring a warm layer and good shoes: it is cold on the ice", SEASON] },
    },
    { ...MALIGNE_CRUISE, info: { ...MALIGNE_CRUISE.info, good: ["On your Jasper Highlights & Return tour", "Spirit Island is seen only on the cruise, not from the lakeshore stop", SEASON] } },
  ],
};

/** Per-person prices in cents from the server (GET /api/bookings/package-activities); null = confirmed by our team. */
export interface PackageActivityPrice {
  adultCents: number | null;
  childCents: number | null;
  infantCents: number | null;
}
export type PackageActivityPrices = Record<string, PackageActivityPrice>;

let pricesRequest: Promise<PackageActivityPrices | null> | null = null;
/** The server's activity prices (fetched once per page). */
export function loadPackageActivityPrices(): Promise<PackageActivityPrices | null> {
  pricesRequest ??= fetch("/api/bookings/package-activities")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { prices?: PackageActivityPrices } | null) => j?.prices ?? null)
    .catch(() => {
      pricesRequest = null;
      return null;
    });
  return pricesRequest;
}

/** What an activity costs for these guests (dollars), or null when one of their ages has no price yet. */
export function packageActivityPrice(prices: PackageActivityPrices | null, id: string, g: ActivityGuests): number | null {
  const p = prices?.[id];
  if (!p) return null;
  let cents = 0;
  for (const [n, unit] of [
    [g.adults, p.adultCents],
    [g.children, p.childCents],
    [g.infants, p.infantCents],
  ] as const) {
    if (n === 0) continue;
    if (unit == null) return null;
    cents += n * unit;
  }
  return cents / 100;
}

/** Who joins each chosen activity, by activity id. */
export type PackageActivityChoice = Record<string, ActivityGuests>;

export const activityGuestCount = (g: ActivityGuests) => g.adults + g.children + g.infants;

/** "Add-on activities requested: Banff Gondola for 2 adults (16–99); Lake Minnewanka Cruise for … (tickets arranged …)." */
export function packageActivitiesRequestLine(activities: PackageActivity[], chosen: PackageActivityChoice): string {
  const parts = activities.filter((a) => chosen[a.id]).map((a) => `${a.name} for ${activityGuestsLabel(chosen[a.id]!)}`);
  return parts.length > 0 ? `Add-on activities requested: ${parts.join("; ")} (tickets arranged by our team, paid separately).` : "";
}
