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
// delete an entry to hand a tour back to Admin → Content). Checkout, vouchers and emails still use
// the product title stored in the database.

import type { TourFaq, TourTab, TourWithAvailability } from "@/lib/api/types";
import { BANFF_YOHO, ICEFIELD } from "@/lib/sharedTours";
import { PRIVATE_FAQS, PRIVATE_OPTIONS } from "@/lib/privateTours";
import { cancellationSentence } from "@/lib/policy";
import { activityTicket } from "@/lib/activityTickets";

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

const GUIDE_CALL = "Your guide contacts you the evening before, between 6 and 9 PM, to confirm your exact pickup time.";

const [PRIVATE_BANFF_YOHO, PRIVATE_ICEFIELD] = PRIVATE_OPTIONS;
const PRIVATE_PICKUP = "Doorstep pickup at your accommodation in Banff, Canmore or Lake Louise, at a time agreed with you before the tour.";
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
    stops: [
      { name: "Lake Louise", text: "About 1 hour beside the famous lake below Victoria Glacier." },
      { name: "Moraine Lake", text: "About 1 hour in the Valley of the Ten Peaks. Transportation is arranged for you from June 1 to October 10." },
      { name: "Johnston Canyon", text: "About 1 hour on the canyon walkways toward the falls." },
      { name: "Emerald Lake", text: "About 30 minutes on the shore of Yoho's best-known lake." },
      { name: "Natural Bridge", text: "About 15 minutes where the Kicking Horse River cuts through the rock." },
      { name: "Lake Minnewanka", text: "About 20 minutes beside Banff's largest lake." },
      { name: "Two Jack Lake", text: "About 15 minutes for reflections of Mount Rundle." },
      { name: "Lower Spiral Tunnels Viewpoint", text: "About 15 minutes at the railway's famous loop tunnels." },
      { name: "Morant's Curve", text: "About 15 minutes at the classic Bow River railway view, with a drive along the Bow Valley Parkway." },
    ],
    steps: [
      { time: "7:30 – 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${GUIDE_CALL}` },
      { time: "Morning", text: "Lake Louise and Moraine Lake (Moraine Lake from June 1 to October 10)." },
      { time: "Midday", text: "Lunch stop in Lake Louise Village (lunch not included), then Emerald Lake and the Natural Bridge in Yoho, the Lower Spiral Tunnels and Morant's Curve." },
      { time: "Afternoon", text: "Johnston Canyon, Lake Minnewanka and Two Jack Lake." },
      { time: "5:30 – 6:00 PM", text: "Back in Banff around 5:30 PM and Canmore around 6:00 PM." },
    ],
    // "Important Information" from the owner's doc (2026-11-04, section E).
    seasonal: [
      "Seasonal itinerary: The route and accessible attractions vary by season. Moraine Lake is generally accessible during its operating season, subject to conditions.",
      "Mountain weather: Conditions can change quickly. Comfortable footwear and layered clothing are recommended.",
      "Itinerary adjustments: Stops may change because of road closures, weather, operational restrictions or other circumstances.",
      "Wildlife sightings are possible but can't be guaranteed.",
    ],
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
    stops: [
      { name: "Bow Lake", text: "A scenic lakeside stop surrounded by towering peaks and glacier-fed waters. Approximately 30 minutes." },
      { name: "Crowfoot Glacier", text: "A brief roadside viewpoint overlooking the historic glacier. Approximately 15 minutes." },
      { name: "Peyto Lake", text: "Enjoy the famous turquoise lake from its panoramic viewpoint. Approximately 30 minutes, including a short uphill walk." },
      { name: "Waterfowl Lakes", text: "A peaceful photography stop framed by the rugged peaks of the Icefields Parkway. Approximately 15 minutes." },
      { name: "Columbia Icefield Ice Explorer", text: "Ride a specially designed vehicle onto the Athabasca Glacier. Seasonal activity." },
      { name: "Columbia Icefield Skywalk", text: "Experience dramatic views over the Sunwapta Valley from a glass-floored walkway. Seasonal activity." },
    ],
    steps: [
      { time: "7:30 – 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${GUIDE_CALL}` },
      { time: "Morning", text: "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway." },
      { time: "Midday", text: "Columbia Icefield: the Ice Explorer onto the Athabasca Glacier and the Skywalk (June 1 to October 10). Lunch stop at the Columbia Icefield Centre (lunch not included)." },
      { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
      { time: "Evening", text: "Back in Banff and Canmore. Traffic, weather and road conditions can affect return times." },
    ],
    // "Important Information" from the owner's doc (2026-11-04).
    seasonal: [
      "Seasonal activities: The Columbia Icefield Ice Explorer and Skywalk are included on departures operating from June 1 to October 10. Outside these dates, these activities are unavailable and the sightseeing itinerary is adjusted. Our team confirms the winter route for your date.",
      "Weather and road conditions: Stops, routes and their order may change due to weather, road closures or operational requirements.",
      "What to bring: Dress in layers and bring a warm jacket, comfortable walking shoes and water. Temperatures at the Columbia Icefield can be significantly colder than in Banff.",
      "Wildlife: Wildlife sightings are possible but cannot be guaranteed.",
    ],
    // Quick facts and pickup text from the owner's doc (2026-11-04).
    quickFacts: [
      { label: "Duration", value: "9–11 hours" },
      { label: "Group size", value: "Small group" },
      { label: "Park admission", value: "Included" },
      { label: "Operating season", value: "Year round · route varies by season" },
      // Banff & Canmore only, like the pickup section (owner's AI training doc, 2026-11-11, flagged the
      // Lake Louise mismatch); a Lake Louise pickup needs team confirmation.
      { label: "Hotel pickups", value: "Canmore & Banff" },
      { label: "Tickets included", value: "Columbia Icefield Adventure (June 1 – October 10)" },
    ],
    pickup: [
      "Complimentary pickup and drop-off are available at designated locations in Canmore and Banff.",
      "Pickup generally begins around 7:30 AM in Canmore and 8:00 AM in Banff. Your guide will contact you the evening before departure to confirm your exact pickup time and meeting instructions.",
      "Please be ready at your confirmed pickup location a few minutes before the scheduled time.",
    ],
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
  stops: CONTENT[BANFF_YOHO.slug].stops.map((s) =>
    s.name === "Moraine Lake" ? { ...s, text: "About 1 hour in the Valley of the Ten Peaks, during its operating season (usually June to early October)." } : s,
  ),
  steps: [
    { time: "Morning", text: `${PRIVATE_PICKUP} ${GUIDE_CALL}` },
    { time: "Morning", text: "Lake Louise and Moraine Lake (Moraine Lake during its operating season)." },
    { time: "Midday", text: "Lunch stop in Lake Louise Village (lunch not included), then Emerald Lake and the Natural Bridge in Yoho, the Lower Spiral Tunnels and Morant's Curve." },
    { time: "Afternoon", text: "Johnston Canyon, Lake Minnewanka and Two Jack Lake." },
    { time: "Evening", text: "Drop-off at your accommodation. The day runs about 10 to 12 hours, depending on your pace." },
  ],
  seasonal: [
    "Price per vehicle, up to 13 guests: CAD $1,750 from June 1 to October 10, all-inclusive (tax, park entry and Moraine Lake entry fees); CAD $1,240 from October 11 to May 31.",
    "Moraine Lake: during its operating season (usually June to early October); access arrangements depend on your vehicle and are explained before booking.",
    "The route varies by season: your guide adjusts stops to road and weather conditions.",
    "Weather: mountain conditions change quickly, so dress in layers and wear comfortable shoes.",
    "Wildlife sightings are possible but can't be guaranteed.",
  ],
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
  stops: CONTENT[ICEFIELD.slug].stops.map((s) =>
    /ice explorer|skywalk/i.test(s.name) ? { ...s, name: `${s.name} — Optional Add-On`, text: s.text.replace("Included from June 1 to October 10.", "Seasonal; admission costs extra.") } : s,
  ),
  steps: [
    { time: "Morning", text: `${PRIVATE_PICKUP} ${GUIDE_CALL}` },
    { time: "Morning", text: "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway." },
    { time: "Midday", text: "Columbia Icefield, with the optional Ice Explorer and Skywalk in season. Lunch stop at the Columbia Icefield Centre (lunch not included)." },
    { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
    { time: "Evening", text: "Drop-off at your accommodation. Traffic, weather and road conditions can affect return times." },
  ],
  seasonal: [
    "Price per vehicle, up to 13 guests: CAD $1,750 from June 1 to October 10; CAD $1,240 from October 11 to May 31.",
    "Ice Explorer and Skywalk: June 1 to October 10, optional and at extra cost.",
    "From October 11 to May 31 the glacier activities don't run and the route is adjusted; our team confirms the route for your date.",
    "Pack an extra warm layer for the Columbia Icefield.",
    "Wildlife sightings are possible but can't be guaranteed.",
  ],
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

export function withDocContent(tour: TourWithAvailability): TourWithAvailability {
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
