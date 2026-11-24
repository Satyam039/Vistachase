// What each day of a package includes, shown in place under the day's calendar at checkout (owner,
// 2026-11-18: "What this day includes" opens a dropdown instead of sending the guest to another page).
// The Three- and Four-Day journeys have their own day itineraries (lib/itineraries.ts
// PACKAGE_ITINERARIES); the Two-Day packages are the day tours themselves (TOUR_ITINERARIES).

import { PACKAGE_ITINERARIES, TOUR_ITINERARIES } from "@/lib/itineraries";
import type { PackageDayStop } from "@/components/booking/PackageCheckout";

/** The places and activities of day `index` of the package, or undefined when none are written down. */
export function packageDayIncludes(packageSlug: string, index: number, tourSlug: string): PackageDayStop[] | undefined {
  const journey = PACKAGE_ITINERARIES[packageSlug as keyof typeof PACKAGE_ITINERARIES];
  if (journey) {
    const day = journey[index];
    return day?.stops.map((s) => ({ name: s.name.replace(/\s+—\s+Optional( Add-On| Combined Experience)$/i, ""), desc: s.desc, optional: s.isOptional }));
  }
  const tour = TOUR_ITINERARIES[tourSlug];
  return tour?.stops.map((s) => ({
    name: s.name.replace(/\s+—\s+Optional Add-On$/i, ""),
    desc: s.text,
    optional: /optional add-on/i.test(s.name),
    summerOnly: s.summerOnly,
  }));
}
