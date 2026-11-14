// Page copy for the two shared day tours, from the owner's "Update Vista Chase web" doc
// (2026-10-23: "match everything from these [Viator] links other than the headings"). The doc's
// own names replace the old product titles, and the stops, timings, inclusions and guest notes
// follow Vista Chase's Viator listings. The rest of each product (prices, departures, photos,
// reviews, booking settings) still comes from the API.
//
// The two private day tours follow the same itineraries (doc, 2026-10-28: "Private day tours first
// two itinerary need to be matched with Viator Itinerary or first two shared tours"), with the
// private tour terms from the doc's Private Tour page: doorstep pickup, a private vehicle and
// third-party activities (Ice Explorer, Skywalk, gondola) at extra cost.
//
// These fields override what Admin → Content holds for these four tours, so edit them here (or
// delete an entry to hand a tour back to Admin → Content). The itineraries themselves (stops,
// timeline, pickup text, Important Information) live in lib/itineraries.ts, which the booking
// confirmation email and PDF read too: edit them there.

import type { TourFaq, TourTab, TourWithAvailability } from "@/lib/api/types";
import { BANFF_YOHO, ICEFIELD } from "@/lib/sharedTours";
import { PRIVATE_FAQS, PRIVATE_OPTIONS } from "@/lib/privateTours";
import { cancellationSentence } from "@/lib/policy";
import { activityTicket } from "@/lib/activityTickets";
import { SHUTTLE_CAPACITY } from "@/lib/shuttleSchedule";
import { TOUR_ITINERARIES } from "@/lib/itineraries";

interface DocContent {
  title: string;
  summary: string;
  description: string;
  /** Replaces facts with the same label; other facts stay. */
  facts: { label: string; value: string }[];
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  goodToKnow: string[];
  stops: { name: string; text: string }[];
  steps: { time: string; text: string }[];
  seasonal: string[];
  /** Answers replaced by question (regex on the question); `add` are appended. */
  faqs: { match: RegExp; answer: string }[];
  addFaqs: TourFaq[];
  /** The page's quick facts, when the doc lists them (replaces the default four). */
  quickFacts?: { label: string; value: string }[];
  /** Pickup & Meeting Points paragraphs, when the doc gives them. */
  pickup?: string[];
}


const [PRIVATE_BANFF_YOHO, PRIVATE_ICEFIELD] = PRIVATE_OPTIONS;
const PRIVATE_INCLUDED = (PRIVATE_FAQS.find((f) => /what is included/i.test(f.q))?.a ?? "").split(" Third-party")[0];
const PRIVATE_MORAINE =
  "Yes, on itineraries that include Moraine Lake during its operating season. Transportation arrangements depend on your vehicle option and will be explained before booking, including whether a shuttle transfer is required.";
const PRIVATE_INCLUSIONS = [
  "Private vehicle for your group",
  "A dedicated driver-guide",
  "Doorstep pickup and drop-off in Banff, Canmore or Lake Louise",
  "Required national park admission fees",
  "Bottled water",
  "Taxes and other mandatory fees charged by authorities",
];
const PRIVATE_GOOD_TO_KNOW = [
  "The day is yours: your guide can linger, skip or reorder stops around your group's interests",
  "Short easy-to-moderate walks; tell us before booking if anyone in your group has mobility concerns",
  "Summer traffic, long weekends and events can extend the day",
];

const CONTENT: Record<string, DocContent> = {
  [BANFF_YOHO.slug]: {
    title: BANFF_YOHO.title,
    summary:
      "Explore Lake Louise, Moraine Lake and the highlights of Banff and Yoho with a passionate guide in a small group, with pickup in Banff & Canmore.",
    // Overview text from the owner's doc (2026-11-04, "C. Rewrite the Overview").
    description:
      "Discover the extraordinary landscapes of the Canadian Rockies on a thoughtfully planned small-group journey through Banff and Yoho National Parks. From turquoise glacial lakes and dramatic mountain scenery to hidden natural wonders, enjoy an unforgettable day with an experienced local guide.\nTravel comfortably in a small group, with time to appreciate the scenery, capture photographs and discover what makes each destination remarkable.",
    facts: [
      { label: "Duration", value: "10–11 hours" },
      { label: "Entry fees", value: "Park admission included" },
      { label: "Small group", value: "Small-group tour" },
      { label: "Operation", value: "Year round · route varies by season" },
    ],
    highlights: BANFF_YOHO.stops,
    inclusions: [
      "Professional local guide",
      "Air-conditioned vehicle",
      "Bottled water",
      "Admission fees for itinerary stops",
      "Moraine Lake access (June 1 to October 10)",
      "Pickup and drop-off in Banff and Canmore",
      // "Gratuities" removed (owner, 2026-11-10): gratuity inclusion awaits the owner's confirmation.
      "Taxes and required fees",
    ],
    exclusions: ["Lunch (stop in Lake Louise Village)", "Personal expenses"],
    goodToKnow: [
      "Short easy-to-moderate walks that may be challenging for guests with mobility issues",
      "Not wheelchair accessible; strollers are fine",
      "Service animals allowed",
      "Not recommended for guests with heart problems or other serious medical conditions",
      "Summer traffic, long weekends and events can extend the day: book dinner for 7:00 PM or later in Banff, 7:30 PM or later in Canmore",
    ],
    stops: TOUR_ITINERARIES[BANFF_YOHO.slug].stops,
    steps: TOUR_ITINERARIES[BANFF_YOHO.slug].steps,
    // "Important Information" from the owner's doc (2026-11-04, section E).
    seasonal: TOUR_ITINERARIES[BANFF_YOHO.slug].seasonal,
    faqs: [
      { match: /how long/i, answer: "About 10 to 11 hours, including travel time. Pickups start at 7:30 AM in Canmore and 8:00 AM in Banff, and you're back around 5:30 PM in Banff and 6:00 PM in Canmore." },
      { match: /what sights/i, answer: "Lake Louise, Moraine Lake (June 1 to October 10), Johnston Canyon, Emerald Lake, the Natural Bridge, Lake Minnewanka, Two Jack Lake, the Lower Spiral Tunnels Viewpoint and Morant's Curve. Stops and their order can change with the season, weather and road conditions." },
      { match: /moraine lake/i, answer: "Moraine Lake is included from June 1 to October 10, with transportation to the lake arranged by Vista Chase. No separate shuttle reservation is needed." },
    ],
    addFaqs: [],
  },
  [ICEFIELD.slug]: {
    title: ICEFIELD.title,
    summary:
      "Journey along the Icefields Parkway, with scenic lake stops, the Ice Explorer and Columbia Icefield Skywalk, in a small group with pickup in Banff & Canmore.",
    // Overview from the owner's doc (2026-11-04, Columbia Icefield Adventure page).
    description:
      "Discover one of Canada's most spectacular mountain highways on a small-group journey through the heart of the Canadian Rockies. Travel along the legendary Icefields Parkway, surrounded by towering peaks, turquoise lakes, ancient glaciers and breathtaking alpine scenery.\nWith a knowledgeable local guide, comfortable transportation and thoughtfully planned stops, experience the remarkable landscapes of Banff and Jasper National Parks at a relaxed, enjoyable pace.",
    facts: [
      { label: "Duration", value: "9–11 hours" },
      { label: "Entry fees", value: "Park admission included" },
      { label: "Small group", value: "Small-group tour" },
    ],
    highlights: ICEFIELD.stops,
    inclusions: [
      "Professional local guide",
      "Air-conditioned vehicle",
      "Bottled water",
      "Park admission",
      "Ice Explorer tickets (June 1 to October 10)",
      "Columbia Icefield Skywalk tickets (June 1 to October 10)",
      "Pickup and drop-off in Banff and Canmore",
      "Taxes and required fees",
    ],
    exclusions: ["Lunch (stop at the Columbia Icefield Centre)", "Gratuities", "Personal expenses"],
    goodToKnow: [
      "A moderate level of fitness is needed",
      "Not wheelchair accessible; strollers are fine",
      "Not recommended for travellers with back problems, who are pregnant, or with heart problems or other serious medical conditions",
      "Bring an extra warm layer for the glacier",
    ],
    // Stop descriptions from the owner's doc (2026-11-04).
    stops: TOUR_ITINERARIES[ICEFIELD.slug].stops,
    steps: TOUR_ITINERARIES[ICEFIELD.slug].steps,
    // "Important Information" from the owner's doc (2026-11-04).
    seasonal: TOUR_ITINERARIES[ICEFIELD.slug].seasonal,
    // Quick facts and pickup text from the owner's doc (2026-11-04).
    quickFacts: [
      { label: "Duration", value: "9–11 hours" },
      { label: "Group size", value: "Small group" },
      { label: "Park admission", value: "Included" },
      { label: "Operating season", value: "Year round · route varies by season" },
      // Banff & Canmore only, like the pickup section (owner's AI training doc, 2026-11-11, flagged the
      // Lake Louise mismatch). Shared tours never pick up in Lake Louise (owner PDF, 2026-11-14).
      { label: "Hotel pickups", value: "Canmore & Banff" },
      { label: "Tickets included", value: "Columbia Icefield Adventure (June 1 – October 10)" },
    ],
    pickup: TOUR_ITINERARIES[ICEFIELD.slug].pickup,
    faqs: [
      { match: /how long/i, answer: "About 9 to 11 hours. Pickups start at 7:30 AM in Canmore and 8:00 AM in Banff; your exact pickup time is confirmed before your tour." },
      { match: /what.s included/i, answer: "Park admission, a professional local guide, an air-conditioned vehicle, bottled water, pickup in Banff and Canmore, and the Ice Explorer and Skywalk tickets from June 1 to October 10." },
      { match: /ice explorer and skywalk/i, answer: "Yes, from June 1 to October 10. Both are included in the tour price during that season." },
      { match: /bring food/i, answer: "Lunch is not included. We stop at the Columbia Icefield Centre, where you can buy lunch, or bring your own." },
    ],
    addFaqs: [
      {
        question: "Does this tour visit Jasper town?",
        answer: "No. This tour travels along the Icefields Parkway as far as the Columbia Icefield for the glacier adventure and Skywalk. It does not continue to Jasper town.",
      },
    ],
  },
};

CONTENT[PRIVATE_BANFF_YOHO.slug!] = {
  title: PRIVATE_BANFF_YOHO.title,
  summary:
    "Explore Lake Louise, Moraine Lake and the highlights of Banff and Yoho with your own guide and vehicle. Doorstep pickup in Banff, Canmore & Lake Louise.",
  description:
    "The same full day as our award-winning Banff & Yoho tour, just for your group: Lake Louise, Moraine Lake, Johnston Canyon, Emerald Lake and the Natural Bridge, with Lake Minnewanka, Two Jack Lake, the Spiral Tunnels and Morant's Curve.\nYour driver-guide picks you up at your door and shapes the pace around you. Park admission is included, and Moraine Lake access is arranged during its operating season.",
  facts: [
    { label: "Entry fees", value: "Park admission included" },
    { label: "Pickup", value: "Doorstep pickup included" },
    { label: "Operation", value: "Year round · route varies by season" },
    { label: "Group", value: "Private, up to 13 guests" },
  ],
  highlights: BANFF_YOHO.stops,
  inclusions: [...PRIVATE_INCLUSIONS, "Moraine Lake access arrangements during its operating season"],
  exclusions: ["Lunch (stop in Lake Louise Village)", "Third-party activities such as the Banff Gondola, lake cruises and canoe rentals", "Gratuities", "Personal expenses"],
  goodToKnow: PRIVATE_GOOD_TO_KNOW,
  stops: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].stops,
  steps: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].steps,
  seasonal: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].seasonal,
  faqs: [
    { match: /how long/i, answer: "About 10 to 12 hours, door to door. Your pickup time is agreed with you before the tour, and the pace is set around your group." },
    { match: /what is included/i, answer: PRIVATE_INCLUDED },
    { match: /moraine lake on a private/i, answer: PRIVATE_MORAINE },
  ],
  addFaqs: [],
};

CONTENT[PRIVATE_ICEFIELD.slug!] = {
  title: PRIVATE_ICEFIELD.title,
  summary:
    "Journey along the Icefields Parkway to the Columbia Icefield with your own guide and vehicle, stopping at Bow Lake, Peyto Lake and Waterfowl Lakes. Doorstep pickup included.",
  description:
    "The same full day as our Columbia Icefield Adventure, just for your group: Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway, as far as the Columbia Icefield.\nAdd the Ice Explorer onto the Athabasca Glacier and the Columbia Icefield Skywalk if you'd like (admission extra, summer season). This day tour returns to Banff, Canmore or Lake Louise and does not continue to Jasper town.",
  facts: [
    { label: "Entry fees", value: "Park admission included" },
    { label: "Pickup", value: "Doorstep pickup included" },
    { label: "Group", value: "Private, up to 13 guests" },
  ],
  highlights: [...ICEFIELD.stops.filter((s) => !/ice explorer|skywalk/i.test(s)), "Columbia Icefield (Ice Explorer and Skywalk optional)"],
  inclusions: PRIVATE_INCLUSIONS,
  exclusions: ["Ice Explorer and Columbia Icefield Skywalk admission (optional)", "Lunch (stop at the Columbia Icefield Centre)", "Gratuities", "Personal expenses"],
  goodToKnow: [...PRIVATE_GOOD_TO_KNOW, "Bring an extra warm layer for the glacier"],
  stops: TOUR_ITINERARIES[PRIVATE_ICEFIELD.slug!].stops,
  steps: TOUR_ITINERARIES[PRIVATE_ICEFIELD.slug!].steps,
  seasonal: TOUR_ITINERARIES[PRIVATE_ICEFIELD.slug!].seasonal,
  faqs: [
    { match: /how long/i, answer: "About 10 to 12 hours, door to door. Your pickup time is agreed with you before the tour." },
    { match: /athabasca glacier and skywalk/i, answer: "Yes, in season, as optional add-ons at extra cost: the Ice Explorer onto the Athabasca Glacier and the glass-floored Columbia Icefield Skywalk. Ask us when you book and we'll time the day around them." },
    { match: /what stops/i, answer: "Bow Lake, Crowfoot Glacier, Peyto Lake, Waterfowl Lakes and the Columbia Icefield, with the Ice Explorer and Skywalk as options. Your guide can add or skip stops around your group's interests, weather and road conditions." },
    { match: /lunch/i, answer: "Lunch isn't included. We stop at the Columbia Icefield Centre, where you can buy lunch, or bring your own." },
    { match: /end the tour in jasper/i, answer: "This day tour returns to Banff, Canmore or Lake Louise. To continue to Jasper, see our Four-Day Rockies & Jasper journey or contact us for a custom plan." },
  ],
  addFaqs: [
    {
      question: "Does this tour visit Jasper town?",
      answer: "No. This tour travels along the Icefields Parkway as far as the Columbia Icefield. It does not continue to Jasper town.",
    },
  ],
};

/**
 * Any "cancellation policy" FAQ answers with the Booking & Cancellation Policy for the tour's
 * category (lib/policy.ts), whatever older wording Admin → Content still holds.
 */
const POLICY_QUESTION = /cancell?ation (policy|terms)|refund policy/i;

function withPolicyFaq(tour: TourWithAvailability): TourWithAvailability {
  if (!tour.faqs.some((f) => POLICY_QUESTION.test(f.question))) return tour;
  const answer = `${cancellationSentence(tour.category)} Refunds are normally sent within 5–10 business days.`;
  return { ...tour, faqs: tour.faqs.map((f) => (POLICY_QUESTION.test(f.question) ? { ...f, answer } : f)) };
}

/** The quick facts the owner's doc sets for a tour's page, if it sets any. */
/** The website's title and summary for a doc tour (the database still has old Webflow copy), else null. */
export function docTitleAndSummary(slug: string): { title: string; summary: string } | null {
  const c = CONTENT[slug];
  return c ? { title: c.title, summary: c.summary } : null;
}

export function docQuickFacts(slug: string): { label: string; value: string }[] | null {
  return CONTENT[slug]?.quickFacts ?? null;
}

/** The tour with the owner's doc copy applied, when there is any for it. */
/** Private group size, word for word everywhere (owner, 2026-11-06), over older catalog wording such as "Up to 6 or 13 guests". */
export const PRIVATE_GROUP_TEXT = "Private, up to 13 guests";
const OLD_PRIVATE_GROUP = /up to (6 or 13|13|14) guests/i;

/**
 * Photos for the four day tours, each one a stop the tour really visits (owner, 2026-11-09: "saare
 * tours ke andar joh bhi photos and videos ushi tours ke according honi chahiye"). They replace the
 * database gallery, which still had Peyto Lake on the Banff & Yoho tours and Jasper's Spirit Island
 * on the Icefield ones. Ice Explorer, Skywalk and glacier photos are from the owner's Drive folder.
 */
const BANFF_YOHO_PHOTOS = [
  "/media/photos/lake-louise-boathouse.webp",
  "/media/photos/johnston-canyon.webp",
  "/media/photos/emerald-lake-island.webp",
  "/media/photos/natural-bridge.webp",
  "/media/photos/morants-curve-summer.webp",
  "/media/photos/lake-louise-sunrise.webp",
  "/media/photos/emerald-lake-misty.webp",
  "/media/site/lake-minnewanka-icy.webp",
];
const ICEFIELD_PHOTOS = [
  "/media/photos/columbia-icefield-skywalk-guests-card.webp",
  "/media/photos/bow-lake-crowfoot-mountain.webp",
  "/media/photos/peyto-lake.webp",
  "/media/photos/columbia-icefield-athabasca-glacier-card.webp",
  "/media/photos/bow-lake-reflection.webp",
  "/media/site/peyto-lake-torqoise-blue-water.webp",
  "/media/site/icefields-parkway-winters.webp",
  // No Abraham Lake photo: it is outside the approved sightseeing area (owner's AI training doc, 2026-11-11).
];
const TOUR_PHOTOS: Record<string, string[]> = {
  [BANFF_YOHO.slug]: ["/media/photos/moraine-lake-red-canoes.webp", ...BANFF_YOHO_PHOTOS],
  [PRIVATE_BANFF_YOHO.slug!]: ["/media/photos/moraine-lake-perfect-reflection.webp", ...BANFF_YOHO_PHOTOS],
  [ICEFIELD.slug]: ["/media/photos/columbia-icefield-ice-explorer-card.webp", ...ICEFIELD_PHOTOS],
  // Private: the glacier activities are optional, so the parkway leads.
  [PRIVATE_ICEFIELD.slug!]: ["/media/photos/bow-lake-crowfoot-mountain.webp", "/media/photos/columbia-icefield-ice-explorer-card.webp", ...ICEFIELD_PHOTOS.filter((p) => !p.includes("bow-lake-crowfoot"))],
};

/**
 * Shared tours never quote a guest number (owner, 2026-11-11: "12 guests hta de"). Imported page
 * text that still does (the winter tour's highlights, FAQ answers) says "small group" instead.
 */
const SHARED_GROUP_WORDING: [RegExp, string][] = [
  [/\s*\((?:max(?:imum)?|no more than|up to)\s*12 (?:guests|people)\)/gi, ""],
  [/we limit each vehicle to a maximum of 12 guests\s*\./gi, "we keep every group small."],
  [/maximum (?:of )?12 guests per vehicle/gi, "Small groups"],
  [/with a maximum of 12 guests/gi, "in a small group"],
  [/(?:with )?no more than 12 guests/gi, "in a small group"],
  [/(?:a )?max(?:imum)?(?: of)? 12 (?:guests|people)/gi, "a small group"],
];

export function sharedGroupWording<T>(value: T): T {
  const text = JSON.stringify(value);
  const next = SHARED_GROUP_WORDING.reduce((t, [re, to]) => t.replace(re, to), text);
  return next === text ? value : (JSON.parse(next) as T);
}

// Site audit (2026-11-12): copy in the product records that contradicts the rest of the site.
// Applied to every field of the tour (text replacements) plus whole FAQ answers by question, so the
// fix holds whatever Admin → Content stores. Remove an entry once the record itself is corrected.
const PAYMENT_ANSWER =
  "You pay securely online when you book. For departures at least 15 days away you can choose to pay a 20% deposit now and the balance 14 days before your tour.";
const PRIVATE_GROUP_ANSWER =
  "Your group has the vehicle and guide to itself, up to 13 guests: a luxury SUV for smaller groups or an executive van for larger ones. The price is per vehicle, not per person.";

interface Correction {
  /** Literal text replaced in every string of the tour (titles, tabs, FAQs, facts...). */
  text?: [string, string][];
  /** Whole FAQ answers replaced by question. */
  faqs?: { match: RegExp; answer: string }[];
}

const CORRECTIONS: Record<string, Correction> = {
  // Old product name left in the FAQ.
  "banff-highlights-tour": {
    text: [
      ["Banff Standard Shared Tour", "Banff & Yoho Discovery"],
      ["Banff Standard Tour", "Banff & Yoho Discovery"],
    ],
  },
  // Old name; the tour stops at the Columbia Icefield and doesn't go to Jasper.
  "shared-tours-icefields-jasper": {
    text: [["Icefields Parkway & Jasper shared tour", "Columbia Icefield Adventure"]],
  },
  // "Up to 6 guests", "Book Now, Pay Later: no upfront payment" and "June through September" contradict
  // the per-vehicle price (up to 13), the checkout (payment at booking) and the Jun 1–Oct 10 season.
  "icefields-jasper-private-tour": {
    text: [["Do you offer Book Now, Pay Later?", "Do I pay in full when I book?"]],
    faqs: [
      { match: /how many people/i, answer: PRIVATE_GROUP_ANSWER },
      { match: /pay in full when i book/i, answer: PAYMENT_ANSWER },
      {
        match: /best time to visit the icefields/i,
        answer:
          "June 1 to October 10, when the Ice Explorer and Skywalk operate and the lakes are at their most turquoise. The rest of the year the route is adjusted for winter conditions and our team confirms it for your date.",
      },
    ],
  },
  "banff-private-tour": {
    faqs: [{ match: /how many people/i, answer: PRIVATE_GROUP_ANSWER }],
  },
  "winter-signature-private-tour": {
    text: [
      ["Winter Standard Private Tour", "Special Winter Private Tour"],
      ["Lowest Price Guarantee + Pay Later Option", "Lowest Price Guarantee"],
      ["With our Lowest Price Guarantee and Book Now, Pay Later option,", "With our Lowest Price Guarantee,"],
      ["Do you offer Book Now, Pay Later?", "Do I pay in full when I book?"],
    ],
    faqs: [{ match: /pay in full when i book/i, answer: PAYMENT_ANSWER }],
  },
  // The shuttle timetable (lib/shuttleSchedule.ts, owner's doc) runs June–September, with sunrise
  // pickups from 2:45 AM (Canmore) to 4:55 AM (Samson Mall).
  "sunrise-shuttle-to-moraine-lake-and-lake-louise": {
    text: [
      ["Operating from May to mid-October", "Operating from June to September"],
      ["operates from May to mid-October", "operates from June to September"],
      ["Operates June 1 – October 1 only.", "Operates June 1 – September 30 only."],
      ['"June–October"', '"June–September"'],
      ['"4:00 - 6:00 AM"', '"2:45 - 4:55 AM"'],
      ['"Stop 2 (1 hr)"', '"Stop 2 (1.5–2 hr)"'],
    ],
  },
};

function withCorrections(tour: TourWithAvailability): TourWithAvailability {
  const c = CORRECTIONS[tour.slug];
  if (!c) return tour;
  let next = tour;
  if (c.text?.length) {
    const json = JSON.stringify(next);
    const fixed = c.text.reduce((t, [from, to]) => t.split(from.startsWith('"') ? from : JSON.stringify(from).slice(1, -1)).join(from.startsWith('"') ? to : JSON.stringify(to).slice(1, -1)), json);
    if (fixed !== json) next = JSON.parse(fixed) as TourWithAvailability;
  }
  if (c.faqs?.length) {
    next = { ...next, faqs: next.faqs.map((f) => ({ ...f, answer: c.faqs!.find((r) => r.match.test(f.question))?.answer ?? f.answer })) };
  }
  return next;
}

/** Shuttles take 14 guests a departure (owner, 2026-11-12); older records say 12. */
function withShuttleCapacity(tour: TourWithAvailability): TourWithAvailability {
  if (tour.category !== "SHUTTLE") return tour;
  const text = JSON.stringify({ facts: tour.facts, tabs: tour.tabs, faqs: tour.faqs, highlights: tour.highlights, description: tour.description, summary: tour.summary });
  const fixed = text
    .replace(/\bmax(?:imum)?(?: of)? 12 (guests|people)/gi, (_m, w: string) => `Max ${SHUTTLE_CAPACITY} ${w}`)
    .replace(/\(max 12\)/gi, `(max ${SHUTTLE_CAPACITY})`)
    .replace(/up to 12 (guests|people)/gi, (_m, w: string) => `up to ${SHUTTLE_CAPACITY} ${w}`);
  return { ...tour, ...(fixed === text ? {} : JSON.parse(fixed)), maxGroupSize: SHUTTLE_CAPACITY };
}

export function withDocContent(tour: TourWithAvailability): TourWithAvailability {
  tour = withShuttleCapacity(withCorrections(tour));
  if (tour.category === "SHARED") {
    tour = {
      ...tour,
      facts: tour.facts?.map((f) => (/^max(?:imum)? 12 (?:guests|people)$/i.test(f.value.trim()) ? { ...f, value: "Small group" } : f)),
      tabs: sharedGroupWording(tour.tabs),
      faqs: sharedGroupWording(tour.faqs),
      ...(tour.highlights ? { highlights: sharedGroupWording(tour.highlights) } : {}),
    };
  }
  // Activity tickets show the operator's own photo (owner, 2026-10-30) over the catalog image.
  const ticketImage = activityTicket(tour.slug, tour.category)?.image;
  if (ticketImage) tour = { ...tour, featuredImage: ticketImage };
  const photos = TOUR_PHOTOS[tour.slug];
  if (photos) tour = { ...tour, featuredImage: photos[0], galleryImages: photos.slice(1) };
  if ((tour.category === "PRIVATE" || tour.category === "MULTIDAY") && tour.facts?.some((f) => OLD_PRIVATE_GROUP.test(f.value))) {
    tour = { ...tour, facts: tour.facts.map((f) => (OLD_PRIVATE_GROUP.test(f.value) ? { ...f, value: PRIVATE_GROUP_TEXT } : f)) };
  }
  const c = CONTENT[tour.slug];
  if (!c) return withPolicyFaq(tour);

  const factLabels = new Set(c.facts.map((f) => f.label.toLowerCase()));
  const facts = [
    ...c.facts,
    ...tour.facts.filter((f) => !factLabels.has(f.label.toLowerCase())),
  ];
  // Keep the facts in the product's own order where it has them.
  const order = tour.facts.map((f) => f.label.toLowerCase());
  facts.sort((a, b) => {
    const ia = order.indexOf(a.label.toLowerCase());
    const ib = order.indexOf(b.label.toLowerCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const section = (heading: string, part: Partial<TourTab["sections"][number]>) => ({
    heading,
    body: [],
    note: null,
    items: [],
    steps: [],
    stops: [],
    ...part,
  });
  const tabs: TourTab[] = [
    {
      label: "Overview",
      sections: [
        section("Price includes", { items: c.inclusions }),
        section("Price excludes", { items: c.exclusions }),
        section("Before You Go", { items: c.goodToKnow }),
      ],
    },
    { label: "Inclusions", sections: [section("Stop by Stop", { stops: c.stops, note: "Stops, their order and time at each may change with the season, weather and road conditions." })] },
    // The doc (2026-11-04) removed the "Your Day" timeline from the page; its pickup times still
    // feed the Pickup & Meeting Points section (TourSections reads a "Pickup" tab).
    { label: "Pickup", sections: [section("Pickup times", { steps: c.steps, body: c.pickup ?? [] })] },
    { label: "Seasonal", sections: [section("Important Information", { items: c.seasonal })] },
  ];

  const faqs = [
    ...tour.faqs.map((f) => {
      const hit = c.faqs.find((r) => r.match.test(f.question));
      return hit ? { ...f, answer: hit.answer } : f;
    }),
    ...c.addFaqs,
  ];

  return withPolicyFaq({
    ...tour,
    title: c.title,
    summary: c.summary,
    description: c.description,
    facts,
    highlights: c.highlights,
    inclusions: c.inclusions,
    exclusions: c.exclusions,
    tabs,
    faqs,
  });
}
