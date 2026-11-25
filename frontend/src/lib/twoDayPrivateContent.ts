// Private Two-Day Rockies Explorer page copy (owner's Trello card, 2026-11-25): introduction,
// seasonal pricing, itinerary notes, cancellation and the 16 product FAQs, verbatim. The page is
// app/two-day-rockies-explorer/private; the card is lib/privateTours.ts (PRIVATE_OPTIONS).

import { TOUR_ITINERARIES } from "@/lib/itineraries";

const cad = (n: number) => `CAD $${n.toLocaleString("en-CA")}`;

/**
 * Per private van, taxes and mandatory fees included: each tour day priced by its own date. Same as
 * privateTours.ts PACKAGE_DAY_PRICE (not imported: privateTours imports this file).
 */
const SUMMER_DAY = 1575;
const WINTER_DAY = 1240;
export const TWO_DAY_PRICE = {
  summerDay: SUMMER_DAY,
  winterDay: WINTER_DAY,
  bothSummer: SUMMER_DAY * 2,
  mixed: SUMMER_DAY + WINTER_DAY,
  bothWinter: WINTER_DAY * 2,
};

export const TWO_DAY_DURATION = "Each tour lasts approximately 10–12 hours.";

export const TWO_DAY_GROUP = "Private group of up to 14 guests. We recommend 12–13 for extra comfort.";

export const TWO_DAY_INTRO = {
  headline: "Two remarkable days. One private Rockies escape.",
  paragraphs: [
    "Discover Banff and Yoho’s iconic lakes, then explore the Icefields Parkway with a private van and driver-guide each day. Choose available dates in either order, together or with a break between them.",
    "Save 10% on summer tour days, and add private Calgary airport transfers to simplify your arrival and departure.",
    "Up to 14 guests; 12–13 recommended for comfort. Tour pickup and drop-off in Banff and Canmore.",
  ],
};

export const TWO_DAY_SAVINGS =
  "Save 10% on summer tour days. Winter days are charged at the regular private-tour rate. Savings are already included in the prices shown.";

export const TWO_DAY_PRICE_TABLE: { dates: string; total: string }[] = [
  { dates: "Both summer", total: cad(TWO_DAY_PRICE.bothSummer) },
  { dates: "One summer, one winter", total: cad(TWO_DAY_PRICE.mixed) },
  { dates: "Both winter", total: cad(TWO_DAY_PRICE.bothWinter) },
];

export const TWO_DAY_PRICE_NOTES = [
  `June 1–October 10: ${cad(TWO_DAY_PRICE.summerDay)} per tour day.`,
  `October 11–May 31: ${cad(TWO_DAY_PRICE.winterDay)} per tour day.`,
  "Each day is priced using its own date. Prices are per private van and include taxes and mandatory fees. Transfers and attraction tickets do not receive the tour-day discount.",
];

/** One-way airport transfer prices, taxes and mandatory fees included (owner, 2026-11-25). */
export const TWO_DAY_TRANSFER_TABLE = [
  { route: "Calgary ↔ Banff or Canmore", small: "CAD $364", large: "CAD $850" },
  { route: "Calgary ↔ Lake Louise*", small: "CAD $445", large: "CAD $895" },
];

export const TWO_DAY_TRANSFER_NOTES = [
  "A round trip consists of two one-way transfers. Transfers cost extra and are added to your package.",
  "*For Lake Louise transfer requests, use Special Requests or contact our team. These arrangements require confirmation. Standard tour pickups remain in Banff and Canmore.",
  "When booking, we collect each transfer’s date, direction, passenger count, flight details and pickup or drop-off address so we can confirm the service.",
];

export const TWO_DAY_ACTIVITIES = {
  intro: "Request activities when booking. Our team arranges tickets and sends a separate invoice for payment. Availability and activity times require confirmation.",
  items: [
    { day: "Banff & Yoho day", name: "Lake Minnewanka cruise", note: "Optional, tickets extra." },
    {
      day: "Summer Icefields day",
      name: "Ice Explorer + Skywalk",
      note: "One combined optional experience, tickets extra. Individual attraction selection is unavailable. Not available on winter Icefields dates.",
    },
  ],
};

export const TWO_DAY_PICKUP =
  "Your exact pickup time is confirmed before each tour. Pickup and drop-off are at your accommodation in Banff or Canmore. You can use a different address for each tour, provided both are in Banff or Canmore and confirmed with our team.";

/** The package's cancellation policy (owner, 2026-11-25), the same on the page and at checkout. */
export const TWO_DAY_CANCELLATION = {
  short:
    "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
  paragraphs: [
    "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
    "If you book an arrival transfer before your tours, the deadline is calculated from that transfer’s scheduled pickup time. Otherwise, it is calculated from your first tour. All deadlines use local Alberta time.",
    "Later guest cancellations and voluntarily unused services are non-refundable. Cancelling the entire package also cancels its booked transfers.",
    "Change requests are welcome at any time, subject to availability and Vista Chase’s confirmation. A request does not extend the cancellation deadline or make a non-refundable amount refundable.",
    "If Vista Chase cancels one tour day, we refund the amount paid for that day without retaining the guest-cancellation penalty. If we cancel the entire package, we refund the package amount paid. Separately invoiced attractions follow their disclosed operator terms.",
  ],
};

const FLEXIBILITY =
  "Your guide manages stops and pacing with you: longer visits may mean shortening or skipping other stops within the scheduled day.";

const banff = TOUR_ITINERARIES["banff-private-tour"];
const icefields = TOUR_ITINERARIES["icefields-jasper-private-tour"];
const abraham = icefields?.winter?.stops.find((s) => s.name === "Abraham Lake");

/** The two tours' itineraries as tabs, named by tour (no fixed Day 1 / Day 2), with summer and winter stops. */
export const TWO_DAY_ITINERARY = [
  {
    dayNumber: 1,
    title: "Banff & Yoho Discovery",
    tabLabel: "Banff & Yoho",
    eyebrow: "Private tour · Banff, Lake Louise & Yoho · approximately 10–12 hours",
    stops: [
      ...(banff?.stops ?? []).map((s) => ({
        name: s.summerOnly ? `${s.name} — Summer` : s.name,
        desc: s.summerOnly ? `${s.text} June 1–October 10.` : s.text,
      })),
      {
        name: "Bow Lake and Peyto Lake — Winter",
        desc: "From October 11 to May 31, Bow Lake and Peyto Lake replace Moraine Lake and Lower Spiral Tunnels Viewpoint.",
      },
      {
        name: "Lake Minnewanka Cruise — Optional Add-On",
        desc: "Request it when booking with the number of participating guests. Tickets cost extra; our team arranges them and sends a separate invoice. Availability and cruise times require confirmation.",
        isOptional: true,
      },
    ],
    closing: `Lunch stop in Lake Louise Village (food not included). ${TWO_DAY_DURATION} ${FLEXIBILITY} Drop-off at your accommodation in Banff or Canmore.`,
  },
  {
    dayNumber: 2,
    title: "Columbia Icefield Adventure",
    tabLabel: "Icefields Parkway",
    eyebrow: "Private tour · Icefields Parkway · approximately 10–12 hours",
    stops: [
      ...(icefields?.stops ?? [])
        .filter((s) => !/ice explorer/i.test(s.name))
        .map((s) => ({ name: s.summerOnly ? `${s.name} — Summer` : s.name, desc: s.summerOnly ? `${s.text} June 1–October 10.` : s.text })),
      {
        name: "Ice Explorer + Skywalk — Optional Combined Experience",
        desc: "Summer only, June 1–October 10. Ride the Ice Explorer onto the Athabasca Glacier and walk the glass-floored Skywalk, offered together only. Tickets cost extra and are invoiced separately. If the glacier attractions cannot operate but the tour still runs, the replacement itinerary visits Athabasca Falls and Sunwapta Falls, subject to road and operating conditions.",
        isOptional: true,
      },
      {
        name: "Abraham Lake — Winter",
        desc: `From October 11 to May 31, Abraham Lake replaces the Columbia Icefield experience. ${abraham?.text ?? "Bring a packed lunch, or request a morning food stop in Lake Louise Village; lunch is planned at Abraham Lake."}`,
      },
    ],
    closing: `Lunch: at the Icefield Centre in summer; in winter, bring lunch or request a morning food stop in Lake Louise Village, then eat at Abraham Lake. ${TWO_DAY_DURATION} ${FLEXIBILITY} Booked attraction times take priority on this day. Drop-off at your accommodation in Banff or Canmore.`,
  },
];

export const TWO_DAY_FAQS: { q: string; a: string[] }[] = [
  {
    q: "Why book this package instead of two separate private day tours?",
    a: [
      "Bring two of the Rockies’ great sightseeing days into one private booking. Explore Banff and Yoho’s lakes and landmarks, then discover the Icefields Parkway, with a van and driver-guide exclusively for your group each day.",
      "Choose dates that fit your stay, take the tours in either order, and save 10% on summer tour days. You can also add private airport transfers to simplify arrival and departure. Winter days use the regular private-tour rate.",
      "The package has its own cancellation terms, including a 20% non-refundable portion.",
    ],
  },
  {
    q: "Do the tours have to be on consecutive days or in a fixed order?",
    a: ["No. Choose an available date for each tour in either order. You can leave days between them for rest or other plans. The tours must take place on different dates."],
  },
  {
    q: "How much does the package cost?",
    a: [
      "Prices are per private van, including taxes and mandatory fees:",
      `• Both tour dates in summer: ${cad(TWO_DAY_PRICE.bothSummer)}.\n• One summer date and one winter date: ${cad(TWO_DAY_PRICE.mixed)}.\n• Both dates in winter: ${cad(TWO_DAY_PRICE.bothWinter)}.`,
      "Summer is June 1–October 10; winter is October 11–May 31. Each day is priced using its own travel date. Transfers, meals and optional attraction tickets are extra.",
    ],
  },
  {
    q: "Does the package always include 10% savings?",
    a: [
      "The saving applies only to summer tour days and is already included in the displayed package rates. Winter tour days are charged at their regular private-tour price. No coupon is needed.",
    ],
  },
  {
    q: "Is our group private on both days?",
    a: [
      "Yes. Your group has its own passenger van and driver-guide each day. Up to 14 guests can travel, with 12–13 recommended for extra comfort. Optional attractions may be shared with other visitors.",
    ],
  },
  {
    q: "Where can we be picked up, and can we change hotels between tours?",
    a: [
      "Both days offer pickup and drop-off in Banff and Canmore only. You can choose different pickup addresses for the two tours, provided both are within those towns and confirmed with our team.",
    ],
  },
  {
    q: "Can we add airport transfers?",
    a: [
      "Yes. Private one-way transfers between Calgary and Banff or Canmore cost CAD $364 for 1–6 passengers or CAD $850 for 7–14 passengers, including taxes and mandatory fees. A round trip is two transfers.",
      "For Lake Louise transfer requests, use Special Requests or contact us. Those arrangements require confirmation and do not change the package’s standard tour pickup areas.",
    ],
  },
  {
    q: "Which optional activities can we add?",
    a: [
      "Request a Lake Minnewanka cruise on the Banff & Yoho day, or the combined Ice Explorer and Skywalk experience on a summer Icefields day.",
      "Specify how many guests will participate. Our staff arrange tickets and invoice separately. Ice Explorer and Skywalk are offered together, with no individual selection.",
    ],
  },
  {
    q: "What if some guests do not want Ice Explorer and Skywalk?",
    a: [
      "Only participating guests need tickets. Others can explore the Icefield Centre, have lunch or discuss a suitable independent walk and trailhead transport in advance.",
      "No replacement sightseeing tour is provided simply because guests decline the attractions. Everyone must follow the agreed meeting times.",
    ],
  },
  {
    q: "How much flexibility do we have during the tours?",
    a: [
      "Discuss stops and pacing with your guide. Longer visits may mean shortening or skipping other stops within the scheduled day. On the Icefields day, reserved attraction times take priority.",
      "Each day normally lasts approximately 10–12 hours.",
    ],
  },
  {
    q: "What changes in winter?",
    a: [
      "On Banff & Yoho Discovery, Bow Lake and Peyto Lake replace Moraine Lake and Lower Spiral Tunnels Viewpoint.",
      "On Columbia Icefield Adventure, Abraham Lake replaces the Columbia Icefield experience. Frozen bubbles and access onto the lake depend on conditions and the guide’s assessment.",
    ],
  },
  {
    q: "Are meals and accommodation included?",
    a: [
      "No. Arrange your accommodation separately, with tour pickup in Banff or Canmore.",
      "The Banff & Yoho day stops for lunch in Lake Louise Village. The summer Icefields day stops at the Icefield Centre. For the winter Icefields day, bring lunch or request a morning food stop in Lake Louise Village, then eat at Abraham Lake.",
    ],
  },
  {
    q: "What is the package cancellation policy?",
    a: [
      "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
      "If an airport transfer comes before the tours, its scheduled pickup starts the deadline. Otherwise, the deadline runs from the first tour. Later cancellations and voluntarily unused services are non-refundable. Deadlines use local Alberta time.",
    ],
  },
  {
    q: "Can we change the second tour after completing the first?",
    a: [
      "You can request changes at any time, including after your first tour. Changes depend on availability and confirmation by Vista Chase. A change request does not create a new cancellation window or make an unused day refundable.",
    ],
  },
  {
    q: "What if Vista Chase cancels one or both tour days?",
    a: [
      `If we cancel one tour day, we refund the amount paid for that day—normally ${cad(TWO_DAY_PRICE.summerDay)} for a summer day or ${cad(TWO_DAY_PRICE.winterDay)} for a winter day. We do not retain the 20% guest-cancellation penalty on a day we cancel.`,
      "If we cancel the entire package, we refund the full package amount paid. Separately invoiced attraction tickets follow their disclosed operator terms.",
    ],
  },
  {
    q: "What if the glacier attractions cannot operate but the tour still runs?",
    a: [
      "The replacement itinerary visits Athabasca Falls and Sunwapta Falls, subject to road and operating conditions. Attraction-ticket refunds follow the operator’s policy and any refund received. An attraction disruption does not automatically mean cancellation or a full refund of the package.",
    ],
  },
];
