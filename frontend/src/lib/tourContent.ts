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
      "Explore Lake Louise, Moraine Lake and the highlights of Banff and Yoho with a passionate guide. Maximum 12 guests, pickup in Banff & Canmore.",
    description:
      "Explore Lake Louise, Moraine Lake and the highlights of Banff and Yoho with a passionate guide. In one full day you'll see turquoise lakes, Johnston Canyon, Emerald Lake and the Natural Bridge, with no more than 12 guests.\nPark admission is included, Moraine Lake transportation is arranged for you from June 1 to October 10, and you can leave the driving and parking to us.",
    facts: [
      { label: "Duration", value: "10–11 hours" },
      { label: "Entry fees", value: "Park admission included" },
      { label: "Small group", value: "Max 12 guests" },
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
      "Gratuities",
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
    seasonal: [
      "Moraine Lake: June 1 to October 10, with transportation arranged by Vista Chase.",
      "The route varies by season: your guide adjusts stops to road and weather conditions.",
      "Weather: mountain conditions change quickly, so dress in layers and wear comfortable shoes.",
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
      "Journey along the Icefields Parkway, with scenic lake stops, the Ice Explorer and Columbia Icefield Skywalk. Maximum 12 guests, pickup in Banff & Canmore.",
    description:
      "Journey along the Icefields Parkway, with scenic stops at Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes. At the Columbia Icefield, ride the Ice Explorer onto the Athabasca Glacier and step out on the Columbia Icefield Skywalk, both included from June 1 to October 10.\nThis tour travels as far as the Columbia Icefield and does not continue to Jasper town.",
    facts: [
      { label: "Duration", value: "9–11 hours" },
      { label: "Entry fees", value: "Park admission included" },
      { label: "Small group", value: "Max 12 guests" },
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
    stops: [
      { name: "Bow Lake", text: "About 30 minutes beside a glacier-fed lake below Crowfoot Mountain." },
      { name: "Crowfoot Glacier", text: "About 15 minutes at the roadside lookout." },
      { name: "Peyto Lake", text: "About 30 minutes, with a short uphill walk to the viewpoint." },
      { name: "Waterfowl Lakes", text: "About 15 minutes at a mountain-framed photo stop." },
      { name: "Columbia Icefield Ice Explorer", text: "About 2 hours, riding onto the Athabasca Glacier. Included from June 1 to October 10." },
      { name: "Columbia Icefield Skywalk", text: "About 1 hour on the glass-floored walkway above the Sunwapta Valley. Included from June 1 to October 10." },
    ],
    steps: [
      { time: "7:30 – 8:00 AM", text: `Pickup in Canmore from about 7:30 AM and in Banff from about 8:00 AM. ${GUIDE_CALL}` },
      { time: "Morning", text: "Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes along the Icefields Parkway." },
      { time: "Midday", text: "Columbia Icefield: the Ice Explorer onto the Athabasca Glacier and the Skywalk (June 1 to October 10). Lunch stop at the Columbia Icefield Centre (lunch not included)." },
      { time: "Afternoon", text: "Scenic drive back along the Icefields Parkway." },
      { time: "Evening", text: "Back in Banff and Canmore. Traffic, weather and road conditions can affect return times." },
    ],
    seasonal: [
      "Ice Explorer and Skywalk: included from June 1 to October 10.",
      "Outside that season the glacier activities don't run, and your guide adjusts the day's stops.",
      "Pack an extra warm layer for the Columbia Icefield.",
      "Wildlife sightings are possible but can't be guaranteed.",
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
    { label: "Group", value: "Up to 14 guests" },
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
    "Price per vehicle, up to 14 guests: CAD $1,799 from June 1 to October 10, all-inclusive (tax, park entry and Moraine Lake entry fees); CAD $1,299 from October 11 to May 31.",
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
    { label: "Group", value: "Up to 14 guests" },
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
    "Price per vehicle, up to 14 guests: CAD $1,599 from June 1 to October 10; CAD $1,299 from October 11 to May 31.",
    "Ice Explorer and Skywalk: June 1 to October 10, optional and at extra cost.",
    "From October 11 to May 31 the glacier activities don't run, and the day visits Abraham Lake instead.",
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

/** The tour with the owner's doc copy applied, when there is any for it. */
export function withDocContent(tour: TourWithAvailability): TourWithAvailability {
  // Activity tickets show the operator's own photo (owner, 2026-10-30) over the catalog image.
  const ticketImage = activityTicket(tour.slug, tour.category)?.image;
  if (ticketImage) tour = { ...tour, featuredImage: ticketImage };
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
    { label: "Inclusions", sections: [section("What You'll See on This Tour", { stops: c.stops })] },
    {
      label: "Itinerary",
      sections: [section("Your Day", { steps: c.steps, note: "Stops and their order may change with the season, weather and road conditions." })],
    },
    { label: "Seasonal", sections: [section("Seasons & Conditions", { items: c.seasonal })] },
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
