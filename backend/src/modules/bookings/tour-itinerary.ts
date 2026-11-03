// The tour's itinerary for the voucher PDF and the confirmation email (owner, 2026-11-01: "ticket
// me tours ki itinerary nhi hai, usko dal de").
//
// Most tours: the "Itinerary" tab of the tour's catalog content (Tour.tabs, Admin → Content).
// Four tours show a different itinerary on the website, set in code from the owner's Google Doc
// (frontend/src/lib/tourContent.ts "steps"), so their tabs in the database are out of date. Those
// four are mirrored here: when the steps change there, change them here too.

export interface ItineraryStep {
  time: string;
  text: string;
}

export interface TourItinerary {
  steps: ItineraryStep[];
  note: string | null;
}

const GUIDE_CALL = "Your guide contacts you the evening before, between 6 and 9 PM, to confirm your exact pickup time.";
const PRIVATE_PICKUP = "Doorstep pickup at your accommodation in Banff, Canmore or Lake Louise, at a time agreed with you before the tour.";
const ROUTE_NOTE = "Stops and their order can change with the season, weather and road conditions.";

const BANFF_YOHO_MIDDAY = "Lunch stop in Lake Louise Village (lunch not included), then Emerald Lake and the Natural Bridge in Yoho, the Lower Spiral Tunnels and Morant's Curve.";
const BANFF_YOHO_AFTERNOON = "Johnston Canyon, Lake Minnewanka and Two Jack Lake.";
const ICEFIELD_MORNING = "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway.";

/** Mirrors frontend/src/lib/tourContent.ts (the steps shown on these tours' pages). */
export const WEBSITE_ITINERARIES: Record<string, ItineraryStep[]> = {
  "banff-highlights-tour": [
    { time: "7:30 - 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${GUIDE_CALL}` },
    { time: "Morning", text: "Lake Louise and Moraine Lake (Moraine Lake from June 1 to October 10)." },
    { time: "Midday", text: BANFF_YOHO_MIDDAY },
    { time: "Afternoon", text: BANFF_YOHO_AFTERNOON },
    { time: "5:30 - 6:00 PM", text: "Back in Banff around 5:30 PM and Canmore around 6:00 PM." },
  ],
  "shared-tours-icefields-jasper": [
    { time: "7:30 - 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${GUIDE_CALL}` },
    { time: "Morning", text: ICEFIELD_MORNING },
    { time: "Midday", text: "Columbia Icefield: the Ice Explorer onto the Athabasca Glacier and the Skywalk (June 1 to October 10). Lunch stop at the Columbia Icefield Centre (lunch not included)." },
    { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
    { time: "Evening", text: "Back in Banff and Canmore. Traffic, weather and road conditions can affect return times." },
  ],
  "banff-private-tour": [
    { time: "Morning", text: `${PRIVATE_PICKUP} ${GUIDE_CALL}` },
    { time: "Morning", text: "Lake Louise and Moraine Lake (Moraine Lake during its operating season)." },
    { time: "Midday", text: BANFF_YOHO_MIDDAY },
    { time: "Afternoon", text: BANFF_YOHO_AFTERNOON },
    { time: "Evening", text: "Drop-off at your accommodation. The day runs about 10 to 12 hours, depending on your pace." },
  ],
  "icefields-jasper-private-tour": [
    { time: "Morning", text: `${PRIVATE_PICKUP} ${GUIDE_CALL}` },
    { time: "Morning", text: ICEFIELD_MORNING },
    { time: "Midday", text: "Columbia Icefield, with the optional Ice Explorer and Skywalk in season. Lunch stop at the Columbia Icefield Centre (lunch not included)." },
    { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
    { time: "Evening", text: "Drop-off at your accommodation. Traffic, weather and road conditions can affect return times." },
  ],
};

/**
 * The names these tours carry on the website (frontend/src/lib/sharedTours.ts, privateTours.ts),
 * where the database title is an older Webflow name ("Our Best Selling Banff Shared Tour").
 * Shared and private share a page name, so emails say which one was booked.
 */
export const WEBSITE_TITLES: Record<string, string> = {
  "banff-highlights-tour": "Banff & Yoho Discovery (Shared Tour)",
  "shared-tours-icefields-jasper": "Columbia Icefield Adventure (Shared Tour)",
  "banff-private-tour": "Banff & Yoho Discovery (Private Tour)",
  "icefields-jasper-private-tour": "Columbia Icefield Adventure (Private Tour)",
};

/** The experience's name for vouchers and emails: the website's name for the tour, else its title. */
export function experienceTitle(departure: { tour?: { slug: string; title: string } | null; shuttleRoute?: { name: string } | null }): string {
  const tour = departure.tour;
  return (tour && WEBSITE_TITLES[tour.slug]) || tour?.title || departure.shuttleRoute?.name || "Vista Chase experience";
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The itinerary for a tour, or null when it has none (shuttles without steps, enquiries). */
export function tourItinerary(tour: { slug: string; tabs?: unknown } | null | undefined): TourItinerary | null {
  if (!tour) return null;
  const fixed = WEBSITE_ITINERARIES[tour.slug];
  if (fixed) return { steps: fixed, note: ROUTE_NOTE };

  const tabs = Array.isArray(tour.tabs) ? (tour.tabs as { label?: unknown; sections?: unknown }[]) : [];
  const tab = tabs.find((t) => /itinerary/i.test(str(t?.label)));
  const sections = Array.isArray(tab?.sections) ? (tab!.sections as Record<string, unknown>[]) : [];
  const steps: ItineraryStep[] = [];
  let note: string | null = null;
  for (const s of sections) {
    for (const step of Array.isArray(s.steps) ? (s.steps as Record<string, unknown>[]) : []) {
      if (str(step?.text)) steps.push({ time: str(step.time), text: str(step.text) });
    }
    for (const item of Array.isArray(s.items) ? s.items : []) {
      if (str(item)) steps.push({ time: "", text: str(item) });
    }
    note ??= str(s.note) || null;
  }
  return steps.length ? { steps: steps.slice(0, 12), note } : null;
}
