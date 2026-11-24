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
import { ICEFIELD_PAGE_TERMS, TOUR_ITINERARIES } from "@/lib/itineraries";

interface DocContent {
  title: string;
  summary: string;
  description: string;
  metaTitle?: string;
  metaDescription?: string;
  itineraryNote?: string;
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
  /** Labelled itinerary sections (e.g. Summer / Winter), replacing the single "Stop by Stop". */
  itinerary?: { heading: string; body?: string[]; stops?: { name: string; text: string }[] }[];
  /** The page's whole FAQ list, replacing the product's own FAQs. */
  onlyFaqs?: TourFaq[];
  /** Show the summer and winter prices in the booking panel. */
  priceSeasons?: boolean;
  /** Link the Two-Day Rockies Explorer (both shared tours, 10% off) from the booking panel. */
  comboOffer?: boolean;
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

// Columbia Icefield Adventure (shared): owner's page changes and FAQs, 2026-11-23.
const ICEFIELD_DURATION = "9–11 hours (up to 12 on the waterfall replacement route)";
const ICEFIELD_GROUP = "Small group, maximum 12 guests";
const ICEFIELD_WALKING =
  "Walking at the sightseeing stops includes an uphill walk to the Peyto Lake viewpoint, and winter surfaces may be snowy or icy";
const ICEFIELD_VEHICLE_ACCESS =
  "Our vehicles have no wheelchair ramp, so guests must be able to transfer into a vehicle seat; we can carry folding wheelchairs and walkers. In summer the Ice Explorer and Skywalk also involve boarding the attraction's own vehicles. Contact us before booking with any mobility needs so we can discuss the stops and check accessibility arrangements for the included attractions";
const ICEFIELD_CHILD_SEATS =
  "Guests of all ages are welcome and every child, including an infant, takes a seat. Contact us before booking with each child's age, height and weight so we can confirm child-seat arrangements; don't assume a child seat is supplied on a shared tour";
const ICEFIELD_FAQS: TourFaq[] = [
  {
    question: "What is included in the tour price?",
    answer:
      "Your tour includes a driver-guide, transportation, pickup and drop-off in Banff or Canmore, park admission, drinking water, taxes and mandatory fees. From June 1 to October 10, Ice Explorer and Skywalk tickets are included. From October 11 to May 31, the tour visits Abraham Lake instead, with ice cleats provided wherever required. Meals, optional gratuities and personal expenses are extra.",
  },
  {
    question: "Are Ice Explorer and Skywalk tickets included?",
    answer:
      "Yes, both are included on departures from June 1 to October 10. Our team arranges your tickets and activity times, so you do not need to book them separately. Allow approximately 2½ hours for both activities combined, plus a separate one-hour lunch break at Columbia Icefield Centre.",
  },
  {
    question: "How long is the Columbia Icefield Adventure?",
    answer:
      "Allow approximately 9–11 hours from pickup to drop-off. If the glacier activities cannot operate and we use the Athabasca Falls and Sunwapta Falls replacement itinerary, the tour can take up to 12 hours. Return times depend on traffic and road conditions.",
  },
  {
    question: "What happens in winter when the Icefields attractions are closed?",
    answer:
      "From October 11 to May 31, Abraham Lake replaces the Columbia Icefield Centre experience. Bow Lake, Crowfoot Glacier Lookout, Peyto Lake and Waterfowl Lakes remain on the itinerary. Ice Explorer and Skywalk are not part of the winter tour.",
  },
  {
    question: "Do I need to bring food?",
    answer:
      "Lunch is not included. In summer, we stop at Columbia Icefield Centre for one hour, where you can purchase lunch or eat a packed lunch.\n\nIn winter, bring a packed lunch or request a quick morning stop in Lake Louise Village to purchase food. There is no scheduled restaurant lunch stop. You can eat at Abraham Lake, and eating inside the vehicle is permitted on this winter tour.",
  },
  {
    question: "Does this tour visit Jasper town?",
    answer:
      "No. The standard summer itinerary visits the Columbia Icefield in Jasper National Park but does not continue to Jasper town. The waterfall replacement itinerary travels farther along the Parkway without adding a Jasper town visit. Winter departures follow the Abraham Lake itinerary.",
  },
  {
    question: "Are frozen bubbles and walking on Abraham Lake guaranteed?",
    answer:
      "No. Bubble visibility depends on ice, snow and weather conditions. When the lake is frozen and your guide determines conditions are suitable, you may walk onto the ice to look for bubbles. If the lake is not frozen, enjoy a shoreline walk and photographs. Ice access is not guaranteed.",
  },
  {
    question: "How long do we spend at Abraham Lake?",
    answer: "The stop normally lasts approximately 30–45 minutes. When we include a lunch break there, it may extend to up to 90 minutes.",
  },
  {
    question: "What happens if Columbia Icefield Adventure cannot operate?",
    answer:
      "Our replacement itinerary visits Athabasca Falls and Sunwapta Falls, with lunch remaining at Columbia Icefield Centre. This can extend the tour to up to 12 hours. The replacement route remains subject to weather, road access and operational conditions.",
  },
  {
    question: "Will I receive a refund if an included attraction is cancelled?",
    answer:
      "Refunds for disrupted Ice Explorer or Skywalk activities follow Pursuit's refund decision. Any ticket refund Vista Chase receives from Pursuit will be passed to you. If Pursuit does not refund the ticket, Vista Chase will not refund that ticket amount. An attraction cancellation does not automatically qualify for a full-tour refund.",
  },
  {
    question: "How much walking is involved on this tour?",
    answer:
      "The itinerary includes walking at sightseeing stops, including an uphill walk to the Peyto Lake viewpoint. Winter surfaces may be snowy or icy. Please contact us before booking if you have mobility concerns so we can discuss the stops and check accessibility arrangements for the included attractions.",
  },
  {
    question: "Can I combine this tour with Banff & Yoho Discovery?",
    answer:
      "Yes. Our two-day combined product includes both shared tours with 10% savings. Choose the combined product when booking to receive the offer.",
  },
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
      // Owner (2026-11-21): no age restriction; "2 and above" removed.
      { match: /families and seniors/i, answer: "Absolutely. There is no age restriction, and guests of all ages are welcome. The walking sections are light to moderate, and your guide will tailor stops to suit everyone's comfort level." },
    ],
    addFaqs: [],
  },
  // Owner's page changes and 12 FAQs of 2026-11-23 ("Improve tour page: Columbia Icefield Adventure").
  [ICEFIELD.slug]: {
    title: ICEFIELD.title,
    summary:
      "Journey along the Icefields Parkway, with scenic lake stops, the Ice Explorer and Columbia Icefield Skywalk in summer and Abraham Lake in winter, in a small group of up to 12 guests with pickup in Banff & Canmore.",
    // Overview from the owner's doc (2026-11-04, Columbia Icefield Adventure page).
    description:
      "Discover one of Canada's most spectacular mountain highways on a small-group journey through the heart of the Canadian Rockies. Travel along the legendary Icefields Parkway, surrounded by towering peaks, turquoise lakes, ancient glaciers and breathtaking alpine scenery.\nWith a knowledgeable local guide, comfortable transportation and thoughtfully planned stops, experience the remarkable landscapes of Banff and Jasper National Parks at a relaxed, enjoyable pace.",
    facts: [
      { label: "Duration", value: ICEFIELD_DURATION },
      { label: "Entry fees", value: "Park admission included" },
      { label: "Small group", value: ICEFIELD_GROUP },
    ],
    highlights: [...ICEFIELD.stops, "Abraham Lake (winter)"],
    inclusions: [
      "Professional local driver-guide",
      "Transportation in an air-conditioned vehicle",
      "Pickup and drop-off in Banff and Canmore",
      "Park admission",
      "Drinking water",
      "Ice Explorer and Skywalk tickets (June 1 to October 10): our team arranges your tickets and activity times",
      "Ice cleats wherever required (October 11 to May 31)",
      "Taxes and mandatory fees",
    ],
    exclusions: ["Meals (summer lunch break at the Columbia Icefield Centre; packed lunch in winter)", "Optional gratuities", "Personal expenses"],
    goodToKnow: [
      ICEFIELD_WALKING,
      ICEFIELD_VEHICLE_ACCESS,
      ICEFIELD_CHILD_SEATS,
      "Bring an extra warm layer: the Icefields Parkway is colder than Banff, and winter surfaces may be snowy or icy",
    ],
    stops: TOUR_ITINERARIES[ICEFIELD.slug].stops,
    steps: TOUR_ITINERARIES[ICEFIELD.slug].steps,
    // Summer and winter itineraries, labelled (page change 2).
    itinerary: [
      { heading: "Summer: June 1 – October 10", body: ["Includes the Ice Explorer and Skywalk at the Columbia Icefield, with a separate one-hour lunch break at the Columbia Icefield Centre. The tour turns back at the Columbia Icefield and does not visit Jasper town."], stops: TOUR_ITINERARIES[ICEFIELD.slug].stops },
      {
        heading: "Winter: October 11 – May 31",
        body: [
          "Abraham Lake replaces the Columbia Icefield Centre experience; the Ice Explorer and Skywalk are not part of the winter tour. Bring a packed lunch, or ask for a quick morning stop in Lake Louise Village to buy food. There is no scheduled restaurant lunch stop; you can eat at Abraham Lake, and eating inside the vehicle is permitted on this winter tour.",
        ],
        stops: TOUR_ITINERARIES[ICEFIELD.slug].winter!.stops,
      },
      {
        heading: "If the glacier activities can't operate",
        body: [
          "Our replacement itinerary continues along the Icefields Parkway to Athabasca Falls and Sunwapta Falls, with lunch remaining at the Columbia Icefield Centre. This can extend the tour to up to 12 hours and remains subject to weather, road access and operational conditions. The tour does not visit Jasper town, even when this contingency route continues to the waterfalls.",
          "Refunds for disrupted Ice Explorer or Skywalk activities follow Pursuit's refund decision. Any ticket refund Vista Chase receives from Pursuit is passed to you; if Pursuit does not refund the ticket, Vista Chase does not refund that ticket amount. An attraction cancellation does not automatically qualify for a full-tour refund.",
        ],
      },
    ],
    seasonal: [
      ...TOUR_ITINERARIES[ICEFIELD.slug].seasonal.slice(0, 2),
      ...ICEFIELD_PAGE_TERMS,
      ...TOUR_ITINERARIES[ICEFIELD.slug].seasonal.slice(2),
      `Walking: ${ICEFIELD_WALKING}.`,
      `Vehicle access: ${ICEFIELD_VEHICLE_ACCESS}.`,
      `Children: ${ICEFIELD_CHILD_SEATS}.`,
    ],
    // Quick facts and pickup text from the owner's doc (2026-11-04), updated 2026-11-23.
    quickFacts: [
      { label: "Duration", value: ICEFIELD_DURATION },
      { label: "Group size", value: ICEFIELD_GROUP },
      { label: "Park admission", value: "Included" },
      { label: "Operating season", value: "Year round · summer and winter itineraries" },
      // Banff & Canmore only, like the pickup section (owner's AI training doc, 2026-11-11, flagged the
      // Lake Louise mismatch). Shared tours never pick up in Lake Louise (owner PDF, 2026-11-14).
      { label: "Hotel pickups", value: "Canmore & Banff" },
      { label: "Tickets included", value: "Ice Explorer & Skywalk (June 1 – October 10)" },
    ],
    pickup: TOUR_ITINERARIES[ICEFIELD.slug].pickup,
    faqs: [],
    addFaqs: [],
    onlyFaqs: ICEFIELD_FAQS,
    // Seasonal prices in the booking panel (page change 1) and the two-day offer (page change 13).
    priceSeasons: true,
    comboOffer: true,
  },
};

export const BANFF_PRIVATE_FAQS: TourFaq[] = [
  {
    question: "Is a private tour in Banff worth it?",
    answer: "A private tour gives your group its own van and dedicated driver-guide, with doorstep pickup in Banff or Canmore. You follow a planned sightseeing route, with flexibility to adjust stops and pacing with your guide during the day.",
  },
  {
    question: "Can you visit Moraine Lake on a private tour?",
    answer: "Yes. Moraine Lake is included during its operating season, normally June 1–October 10, subject to road access and conditions. All required transportation is included, and you do not need a separate shuttle reservation.\n\nDepending on the day’s arrangements, you may travel in your tour van or transfer to another van. Your group’s transportation remains private.",
  },
  {
    question: "How long is our private tour of Banff?",
    answer: "Allow approximately 10–12 hours from pickup to drop-off. Time spent at individual stops can be adjusted with your guide within the scheduled tour day. Traffic, weather and road conditions may affect your return time.",
  },
  {
    question: "What is included in a Banff private tour?",
    answer: "Your tour includes a private passenger van, a dedicated driver-guide, doorstep pickup and drop-off in Banff or Canmore, required national park admission, bottled water, taxes and mandatory fees.\n\nSeasonal Moraine Lake transportation is also included. Lunch, the optional Lake Minnewanka cruise, gratuities and personal expenses cost extra.",
  },
  {
    question: "Can you customize stops on a private Banff tour?",
    answer: "You can discuss changes to stops and time spent at each location with your guide on the day. For example, you may spend longer at Lake Louise or skip a stop that does not interest your group.\n\nThe tour has a planned route and scheduled return time. Spending longer at one location may require shortening or skipping another. To experience the full itinerary, follow your guide’s recommended timing.\n\nFor a stay planned individually with a specialist before travel, including a tailored itinerary across several days, contact our sister company, Banff Elite.",
  },
  {
    question: "What is the best time to visit Moraine Lake?",
    answer: "Moraine Lake is normally visited from June 1–October 10, subject to seasonal road access and conditions. Your guide determines the visit time as part of the day’s route. This tour does not promise a sunrise visit or a particular crowd level.",
  },
  {
    question: "How many people can join a private tour?",
    answer: "The van has 15 seats: one for your driver-guide and space for up to 14 guests. We recommend 12–13 guests for extra comfort, but your private group can book all 14 passenger seats.\n\nThe van is exclusively for your group, and pricing is per vehicle, not per person.",
  },
  {
    question: "Are meals included in a private tour?",
    answer: "No. We stop for lunch in Lake Louise Village, where you can purchase food or enjoy your own packed lunch. Bottled water is included.",
  },
  {
    question: "What happens if the weather is bad?",
    answer: "Your guide may adjust the route, stop order or timing to suit weather and road conditions. Some locations may be inaccessible.\n\nIf Vista Chase must cancel the tour because of a wildfire, highway closure or another disruption, you receive a full refund.",
  },
  {
    question: "How do private tours avoid the crowds?",
    answer: "Your guide can adjust the order and timing of stops where practical. However, popular attractions are shared with other visitors, and a private tour does not guarantee quiet locations, priority entry or freedom from queues.",
  },
  {
    question: "How much does the private tour cost?",
    answer: "The price is in Canadian dollars per van:\n\nJune 1–October 10: CAD $1,750.\n\nOctober 11–May 31: CAD $1,240.\n\nThese prices cover your private group of up to 14 guests and include taxes and mandatory fees. Lunch and optional activities are extra.",
  },
  {
    question: "Which places will we visit?",
    answer: "The planned summer itinerary includes Lake Louise, Moraine Lake, Johnston Canyon, Emerald Lake, the Natural Bridge, Lake Minnewanka, Two Jack Lake, Lower Spiral Tunnels Viewpoint and Morant’s Curve, with a lunch stop in Lake Louise Village.\n\nStops, their order and time at each may change because of conditions or adjustments agreed with your guide.",
  },
  {
    question: "Does this tour operate in winter?",
    answer: "Yes. The tour follows a seasonal itinerary. Bow Lake and Peyto Lake replace Moraine Lake and Lower Spiral Tunnels Viewpoint when those seasonal stops are unavailable.\n\nYour guide may make further adjustments for weather, road access and conditions.",
  },
  {
    question: "Where can we be picked up and dropped off?",
    answer: "Doorstep pickup and drop-off are available in Banff and Canmore only.\n\nChoose a listed pickup location when booking, or enter your accommodation or requested address in the custom field. Custom pickup requests must be within Banff or Canmore and are subject to confirmation.\n\nLake Louise pickup is not offered for this tour.",
  },
  {
    question: "When will we receive our exact pickup time?",
    answer: "Your guide contacts you the evening before your tour, normally between 6 and 9 PM, to confirm the exact pickup time and arrangements. Please be ready at the confirmed location and time.",
  },
  {
    question: "Can we add a Lake Minnewanka cruise?",
    answer: "Yes, subject to the cruise’s seasonal operation and ticket availability. Select the optional cruise during checkout, or contact us well in advance so our team can arrange tickets.\n\nCruise admission costs extra. Its scheduled departure and duration must fit within your tour day, so your guide may need to adjust other sightseeing stops.",
  },
  {
    question: "Is the tour suitable for children, seniors and guests with mobility needs?",
    answer: "Guests of all ages are welcome. Walking requirements vary by stop, and some paths may include uneven ground, steps or slippery surfaces.\n\nThe private tour follows the same child-seat and accessibility arrangements as our shared Banff & Yoho tour. Tell us about children needing seats or anyone with mobility needs before booking so our team can confirm suitable arrangements. Your guide can discuss shorter walks or skipped stops with your group.",
  },
  {
    question: "What should we bring?",
    answer: "Bring comfortable walking shoes, layers, a weatherproof jacket, sun protection and personal essentials. Mountain weather can change quickly. Bring a packed lunch if you prefer not to purchase food during the Lake Louise Village stop.",
  },
  {
    question: "What is the cancellation policy?",
    answer: "Cancel at least 72 hours before your confirmed departure time for a full refund. Cancellations with less than 72 hours’ notice, missed pickups and no-shows are non-refundable.\n\nThe deadline uses local Alberta time. Approved refunds are normally returned to the original payment method within 5–10 business days.",
  },
  {
    question: "Can we reschedule our private tour?",
    answer: "You can request a date change at least 72 hours before your scheduled departure. Changes depend on availability and are confirmed only when accepted by Vista Chase.",
  },
  {
    question: "Can our tour be cancelled because there are too few guests?",
    answer: "No. This is a private booking for your group, so a minimum passenger requirement does not apply.\n\nDisruptions such as wildfires or highway closures may still require cancellation. If Vista Chase cancels your tour, you receive a full refund.",
  },
  {
    question: "Can we request a luxury SUV or a fully tailored holiday?",
    answer: "Vista Chase operates this tour in a private passenger van. For premium vehicle options or a holiday curated with a specialist around your dates, interests and pace, contact our sister company, Banff Elite.",
  },
];

CONTENT[PRIVATE_BANFF_YOHO.slug!] = {
  metaTitle: "Private Banff & Yoho Discovery Tour | Vista Chase",
  metaDescription:
    "Explore Banff and Yoho with your own driver-guide and private van. Doorstep pickup in Banff or Canmore. Up to 14 guests, with seasonal itineraries.",
  title: "Private Banff & Yoho Discovery",
  summary: "Your group. Your guide. A full day exploring Banff and Yoho.",
  description:
    "Explore the highlights of Banff and Yoho National Parks with a dedicated driver-guide and a passenger van exclusively for your group.\n\nThe summer itinerary includes Lake Louise, Moraine Lake, Johnston Canyon, Emerald Lake, the Natural Bridge, Lake Minnewanka, Two Jack Lake, Lower Spiral Tunnels Viewpoint and Morant’s Curve.\n\nIn winter, Bow Lake and Peyto Lake replace Moraine Lake and Lower Spiral Tunnels Viewpoint.\n\nEnjoy doorstep pickup and drop-off in Banff or Canmore, with required park admission and seasonal Moraine Lake transportation included. Discuss small changes to stops and pacing with your guide during the day, within the planned route and scheduled return time.",
  quickFacts: [
    { label: "Duration", value: "Approximately 10–12 hours" },
    { label: "Pickup & drop-off", value: "Doorstep service in Banff or Canmore" },
    { label: "Group size", value: "Private, up to 14 guests; 12–13 recommended for comfort" },
    { label: "Pricing", value: "Per private van" },
    { label: "Cancellation", value: "Full refund with at least 72 hours’ notice" },
  ],
  facts: [
    { label: "Duration", value: "Approximately 10–12 hours" },
    { label: "Pickup & drop-off", value: "Doorstep service in Banff or Canmore" },
    { label: "Group size", value: "Private, up to 14 guests; 12–13 recommended for comfort" },
    { label: "Pricing", value: "Per private van" },
    { label: "Cancellation", value: "Full refund with at least 72 hours’ notice" },
  ],
  highlights: [
    "Lake Louise",
    "Moraine Lake (summer)",
    "Bow Lake (winter)",
    "Peyto Lake (winter)",
    "Johnston Canyon",
    "Emerald Lake",
    "Natural Bridge",
    "Lake Minnewanka",
    "Two Jack Lake",
    "Lower Spiral Tunnels Viewpoint (summer)",
    "Morant’s Curve",
  ],
  inclusions: [
    "Private passenger van exclusively for your group.",
    "Dedicated driver-guide.",
    "Doorstep pickup and drop-off in Banff or Canmore.",
    "Required national park admission fees.",
    "Seasonal Moraine Lake transportation, including any required private van transfer.",
    "Bottled water.",
    "Taxes and mandatory fees.",
  ],
  exclusions: [
    "Lunch.",
    "Optional Lake Minnewanka cruise admission.",
    "Gratuities.",
    "Personal expenses.",
  ],
  goodToKnow: [
    "Discuss small changes to stops and pacing with your guide during the day, within the planned route and scheduled return time.",
    "Guests of all ages are welcome. Walking requirements vary by stop, and some paths may include uneven ground, steps or slippery surfaces.",
    "The private tour follows the same child-seat and accessibility arrangements as our shared Banff & Yoho tour. Tell us about children needing seats or anyone with mobility needs before booking so our team can confirm suitable arrangements.",
    "Bring comfortable walking shoes, layers, a weatherproof jacket, sun protection and personal essentials. Mountain weather can change quickly.",
  ],
  stops: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].stops,
  steps: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].steps,
  itinerary: [
    {
      heading: "Seasonal itinerary",
      body: [
        "Summer: June 1–October 10. Moraine Lake is included when its road is open.",
        "Winter: October 11–May 31. Bow Lake and Peyto Lake replace Moraine Lake and Lower Spiral Tunnels Viewpoint.",
        "All stops remain subject to weather, road access and operating conditions.",
      ],
      stops: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].stops,
    },
  ],
  itineraryNote:
    "This is a planned sightseeing itinerary. Stops, their order and approximate visit times may change with conditions. You may discuss longer visits or skipped stops with your guide, but extra time at one location may require shortening or missing another to stay within the scheduled tour day. Follow your guide’s recommended timing to experience the full route.",
  pickup: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].pickup,
  seasonal: TOUR_ITINERARIES[PRIVATE_BANFF_YOHO.slug!].seasonal,
  faqs: [],
  addFaqs: [],
  onlyFaqs: BANFF_PRIVATE_FAQS,
  priceSeasons: true,
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

/** Booking-panel extras the owner's doc sets for a tour page: seasonal prices, the two-day offer. */
export function docPanelExtras(slug: string): { priceSeasons: boolean; comboOffer: boolean } {
  const c = CONTENT[slug];
  return { priceSeasons: Boolean(c?.priceSeasons), comboOffer: Boolean(c?.comboOffer) };
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
  "You pay securely online when you book. For departures at least 15 days away you can choose to pay a 20% deposit now and the balance 7 days before your tour (for a multi-day journey, 7 days before the first tour day).";
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
    {
      label: "Inclusions",
      sections: c.itinerary
        ? c.itinerary.map((x, i, all) =>
            section(x.heading, {
              body: x.body ?? [],
              stops: x.stops ?? [],
              note: i === all.length - 1 ? (c.itineraryNote ?? "Stops, their order and time at each may change with the season, weather and road conditions.") : null,
            }),
          )
        : [section("Stop by Stop", { stops: c.stops, note: c.itineraryNote ?? "Stops, their order and time at each may change with the season, weather and road conditions." })],
    },
    // The doc (2026-11-04) removed the "Your Day" timeline from the page; its pickup times still
    // feed the Pickup & Meeting Points section (TourSections reads a "Pickup" tab).
    { label: "Pickup", sections: [section("Pickup times", { steps: c.steps, body: c.pickup ?? [] })] },
    { label: "Seasonal", sections: [section("Important Information", { items: c.seasonal })] },
  ];

  const faqs = c.onlyFaqs ?? [
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
    ...(c.metaTitle ? { metaTitle: c.metaTitle } : {}),
    ...(c.metaDescription ? { metaDescription: c.metaDescription } : {}),
    facts,
    highlights: c.highlights,
    inclusions: c.inclusions,
    exclusions: c.exclusions,
    tabs,
    faqs,
  });
}
