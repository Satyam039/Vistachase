// Optional activities on the private multi-day journeys (owner's spec, 2026-11-18): the guest ticks
// each activity and says how many adults, children and infants join it. Nothing is ticked for them.
//   2-day: Columbia Icefield Adventure
//   3-day: Banff Gondola, Lake Minnewanka Cruise, Ice Explorer + Skywalk (one combined experience)
//   4-day: Banff Gondola, Lake Minnewanka Cruise, Ice Explorer + Skywalk (one combined experience),
//          Maligne Lake Cruise to Spirit Island
// Each activity is priced here per adult, child and infant. While a price is null (the owner hasn't
// given it yet) the activity is recorded as "price confirmed by our team" and not charged; once all
// the ages that join it have a price, it is charged with Day 1 and added to the booking total.
// Frontend mirror: frontend/src/lib/activityAddOns.ts (PACKAGE_ACTIVITIES, PACKAGE_ACTIVITY_PRICES).

import { z } from "@/lib/security/validate";

export interface PackageActivityPrice {
  adultCents: number | null;
  childCents: number | null;
  infantCents: number | null;
}

const UNPRICED: PackageActivityPrice = { adultCents: null, childCents: null, infantCents: null };

/** Per-person prices in cents. null = not given by the owner yet (the team confirms it). */
export const PACKAGE_ACTIVITY_PRICES: Record<string, PackageActivityPrice> = {
  "columbia-icefield-adventure": UNPRICED,
  "banff-gondola": UNPRICED,
  "lake-minnewanka-cruise": UNPRICED,
  "maligne-lake-cruise": UNPRICED,
};

const NAMES: Record<string, string> = {
  "columbia-icefield-adventure": "Columbia Icefield Adventure",
  "banff-gondola": "Banff Gondola",
  "lake-minnewanka-cruise": "Lake Minnewanka Cruise",
  "maligne-lake-cruise": "Maligne Lake Cruise to Spirit Island",
};

/** The activities each private journey offers, in the order the page lists them. */
export const PACKAGE_ACTIVITY_IDS: Record<string, string[]> = {
  "two-day-rockies-explorer-private": ["columbia-icefield-adventure"],
  // Owner, 2026-11-24: Banff tour (gondola, Minnewanka cruise), then the combined glacier experience.
  "three-day-rockies-discovery": ["banff-gondola", "lake-minnewanka-cruise", "columbia-icefield-adventure"],
  "four-day-rockies-and-jasper": ["banff-gondola", "lake-minnewanka-cruise", "columbia-icefield-adventure", "maligne-lake-cruise"],
};

export const packageActivityName = (packageSlug: string, id: string) =>
  (packageSlug === "four-day-rockies-and-jasper" || packageSlug === "three-day-rockies-discovery") && id === "columbia-icefield-adventure" ? "Ice Explorer + Skywalk (combined glacier experience)" : (NAMES[id] ?? id);

export const packageActivitiesSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      adults: z.number().int().min(0).max(30),
      children: z.number().int().min(0).max(30),
      infants: z.number().int().min(0).max(30),
    }),
  )
  .max(8);
export type PackageActivityInput = z.infer<typeof packageActivitiesSchema>[number];

export type StoredPackageActivity = PackageActivityInput & {
  name: string;
  /** What the guest pays for it, or null when the team confirms the price. */
  priceCents: number | null;
};

/** The activity's price for these guests, or null when one of their ages has no price yet. */
export function packageActivityPriceCents(a: PackageActivityInput): number | null {
  const p = PACKAGE_ACTIVITY_PRICES[a.id] ?? UNPRICED;
  let total = 0;
  for (const [n, unit] of [
    [a.adults, p.adultCents],
    [a.children, p.childCents],
    [a.infants, p.infantCents],
  ] as const) {
    if (n === 0) continue;
    if (unit == null) return null;
    total += n * unit;
  }
  return total;
}

/**
 * Checks the guest's choice and prices it. Throws a message the guest can read when an activity isn't
 * offered with this journey, is chosen twice, or has no one (or more people than the party) joining.
 */
export function pricePackageActivities(
  packageSlug: string,
  chosen: PackageActivityInput[],
  party: { adults: number; children: number; infants: number },
): StoredPackageActivity[] {
  const offered = PACKAGE_ACTIVITY_IDS[packageSlug] ?? [];
  const seen = new Set<string>();
  const partySize = party.adults + party.children + party.infants;
  return chosen.map((a) => {
    if (!offered.includes(a.id)) throw new Error(`${NAMES[a.id] ?? "This activity"} can't be added to this journey.`);
    if (seen.has(a.id)) throw new Error(`${NAMES[a.id]} was chosen twice.`);
    seen.add(a.id);
    const who = a.adults + a.children + a.infants;
    if (who < 1 || who > partySize) throw new Error(`Choose 1 to ${partySize} guests for ${packageActivityName(packageSlug, a.id)}.`);
    return { ...a, name: packageActivityName(packageSlug, a.id), priceCents: packageActivityPriceCents(a) };
  });
}

function guestsText(a: PackageActivityInput) {
  return [
    a.adults ? `${a.adults} adult${a.adults === 1 ? "" : "s"}` : null,
    a.children ? `${a.children} ${a.children === 1 ? "child" : "children"}` : null,
    a.infants ? `${a.infants} infant${a.infants === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

const money = (cents: number) => `CAD $${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

/** "Banff Gondola for 2 adults, 1 child (CAD $240); Lake Minnewanka Cruise for 2 adults (price confirmed by our team)". */
export function packageActivitiesText(list: StoredPackageActivity[]): string {
  return list.map((a) => `${a.name} for ${guestsText(a)} (${a.priceCents != null ? money(a.priceCents) : "price confirmed by our team"})`).join("; ");
}

/** The line staff read in Day 1's special requests. */
export function packageActivitiesNote(list: StoredPackageActivity[]): string {
  return `Add-on activities: ${packageActivitiesText(list)}.`;
}

/**
 * The booking's add-on activities in one line, for the admin booking detail, the voucher and the
 * emails: a private journey's chosen activities, or a day tour's requested add-ons.
 */
export function activitiesSummary(priceSnapshot: unknown): string | null {
  const snap = priceSnapshot as {
    packageActivities?: StoredPackageActivity[];
    activityAddOns?: { name: string; status?: string; participants?: number }[];
  } | null;
  if (Array.isArray(snap?.packageActivities) && snap.packageActivities.length > 0) return packageActivitiesText(snap.packageActivities);
  if (Array.isArray(snap?.activityAddOns) && snap.activityAddOns.length > 0) {
    // A combined ticket request (Private Columbia Icefield: Ice Explorer + Skywalk) says it is a
    // request for N guests, not a confirmed reservation, invoiced separately.
    const requests = snap.activityAddOns.filter((a) => a.status === "REQUESTED");
    const others = snap.activityAddOns.filter((a) => a.status !== "REQUESTED");
    return [
      ...requests.map(
        (a) => `${a.name}: ticket request for ${a.participants ?? "?"} ${a.participants === 1 ? "guest" : "guests"} (not yet a confirmed reservation; tickets invoiced separately)`,
      ),
      ...(others.length > 0 ? [`${others.map((a) => a.name).join(", ")} (price confirmed by our team)`] : []),
    ].join("; ");
  }
  return null;
}
