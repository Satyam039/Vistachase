// Three-Day Rockies Discovery page copy (owner's Trello card, 2026-11-24): introduction, pricing,
// the one cancellation statement and the 17 product FAQs, verbatim. The page is
// app/three-day-rockies-discovery; the card is lib/privateTours.ts (PRIVATE_OPTIONS).

export const THREE_DAY_PRICE = { total: 4725, perDay: 1575, undiscounted: 5250, saving: 525 };

export const THREE_DAY_DURATION = "Usually around 10 hours per tour; allow up to 12 hours for traffic, conditions and delays.";

export const THREE_DAY_INTRO = {
  headline: "Three private adventures. One memorable Rockies stay.",
  paragraphs: [
    "Explore Banff’s lakes and viewpoints, discover Lake Louise, Moraine Lake and Yoho, then journey along the Icefields Parkway. Enjoy a private van and driver-guide each day, choose available dates in any order, and save 10% on the three-day tour price.",
    "Add private airport transfers and optional experiences to shape your visit. Summer only, June 1–October 10, with tour pickup and drop-off in Banff and Canmore.",
  ],
};

export const THREE_DAY_PRICING = [
  "CAD $4,725 per private van for all three tours, including taxes, mandatory fees and 10% savings.",
  "That is CAD $1,575 per tour day—a saving of CAD $525 against the undiscounted three-day total of CAD $5,250. Transfers and optional attraction tickets cost extra.",
];

/** The one cancellation statement (owner, 2026-11-24), used everywhere on the page and at checkout. */
export const THREE_DAY_CANCELLATION = {
  short:
    "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
  paragraphs: [
    "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
    "If an arrival transfer comes before your tours, the deadline runs from that transfer’s scheduled pickup. Otherwise, it runs from your first tour. Later guest cancellations and voluntarily unused services are non-refundable. Deadlines use local Alberta time.",
    "Change requests are welcome at any time, subject to availability and confirmation. They do not extend the cancellation deadline or make an unused service refundable.",
    "If Vista Chase cancels one tour day, we refund the amount paid for that day without retaining the guest-cancellation penalty. If Vista Chase cancels the entire package, the package amount paid is refunded. Separately invoiced attractions follow their disclosed operator terms.",
  ],
};

export const THREE_DAY_FAQS: { q: string; a: string[] }[] = [
  {
    q: "Why choose the Three-Day Rockies Discovery package?",
    a: [
      "Enjoy three distinct private experiences: Banff’s lakes and viewpoints, Lake Louise and Yoho’s highlights, and the Icefields Parkway’s glacier scenery.",
      "The package gives you a private van and driver-guide each day, flexible dates and 10% savings on the three-day tour price. Add airport transfers and optional activities to suit your plans. Accommodation, meals and attraction tickets are extra.",
    ],
  },
  {
    q: "How is this different from the two-day package?",
    a: [
      "The three-day package spreads the sightseeing across a dedicated Banff day, a Lake Louise and Yoho day, and an Icefields Parkway day. It adds Banff viewpoints and locations such as Bow Falls, Surprise Corner and Cascade Ponds, plus seasonal Takakkaw Falls on the Yoho itinerary.",
      "It offers broader sightseeing across three full days rather than combining Banff and Yoho into one day.",
    ],
  },
  {
    q: "Must we take the tours on consecutive dates or in a fixed order?",
    a: [
      "No. Choose a different available date for each experience, in any order. Dates can be consecutive or separated by other days in your stay. All three tours must fall within the operating season, June 1–October 10.",
    ],
  },
  {
    q: "How much does the package cost, and what do we save?",
    a: [
      "The package costs CAD $4,725 per private van, including taxes, mandatory fees and 10% savings. That is CAD $525 less than the undiscounted three-day total.",
      "The price covers your private group of up to 14 guests. Transfers, optional attraction tickets, meals and accommodation are extra.",
    ],
  },
  {
    q: "How long is each tour?",
    a: [
      "Each tour usually lasts around 10 hours, but traffic, road conditions and other delays can extend it to approximately 12 hours. Exact pickup arrangements are confirmed before each tour.",
    ],
  },
  {
    q: "Which optional experiences can we add?",
    a: [
      "On the Banff sightseeing tour, request the Banff Gondola, Lake Minnewanka cruise, or both, subject to available time and tickets.",
      "On the Icefields tour, request the combined Ice Explorer + Skywalk experience. These two attractions are offered together, not individually.",
      "Select participant numbers when booking. Staff arrange tickets and send a separate invoice. Reserved activities may require other stops to be shortened or skipped.",
    ],
  },
  {
    q: "Does everyone have to join the glacier activities?",
    a: [
      "No. Only participating guests need tickets. Others can explore the Icefield Centre, have lunch or discuss a suitable independent walk and trailhead transport in advance.",
      "No replacement sightseeing tour is provided simply because guests decline the attractions. Everyone must follow the agreed meeting times.",
    ],
  },
  {
    q: "Where can we be picked up, and can we change hotels?",
    a: [
      "Tour pickup and drop-off are available in Banff and Canmore only. You may use different addresses for the three tours, provided each is within those towns and confirmed with our team.",
    ],
  },
  {
    q: "Can we include airport transfers?",
    a: [
      "Yes. One-way private transfers between Calgary and Banff or Canmore cost:",
      "1–6 passengers: CAD $364.\n7–14 passengers: CAD $850.",
      "Prices include taxes and mandatory fees. A round trip consists of two transfers. For Lake Louise transfer requests, use Special Requests or contact the team for confirmation.",
    ],
  },
  {
    q: "Is Moraine Lake transportation included?",
    a: [
      "Yes, during its operating season and subject to access conditions. No separate shuttle reservation is needed. You may remain in your tour van or transfer to another van depending on arrangements; your group’s transportation remains private.",
    ],
  },
  {
    q: "How much can we adjust the itinerary?",
    a: [
      "Discuss preferences with your guide during each tour. Longer visits may mean shortening or skipping other stops within the scheduled day.",
      "Reserved gondola, cruise and glacier activity times must be respected. Extensive advance planning of a fully tailored stay is available through our sister company, Banff Elite.",
    ],
  },
  {
    q: "Where do we stop for lunch?",
    a: [
      "Lunch is planned in Banff town on the Banff sightseeing tour, Lake Louise Village on the Lake Louise and Yoho tour, and the Columbia Icefield Centre on the Icefields tour.",
      "Meals are not included. Guests may purchase food or bring a packed lunch.",
    ],
  },
  {
    q: "Does this package include Jasper town or an overnight stay?",
    a: [
      "No. The Icefields tour reaches the Columbia Icefield but does not visit Jasper town. Accommodation is not included; guests arrange their own stay in Banff or Canmore.",
    ],
  },
  {
    q: "What is the package cancellation policy?",
    a: [
      "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
      "An earlier booked arrival transfer starts that deadline; otherwise, it starts from your first tour. Later guest cancellations and voluntarily unused services are non-refundable. Deadlines use local Alberta time.",
    ],
  },
  {
    q: "Can we change a remaining tour after the package starts?",
    a: [
      "You can request changes at any time. They depend on availability and confirmation by Vista Chase. A request does not create a new cancellation window or make an unused day refundable.",
    ],
  },
  {
    q: "What if Vista Chase cancels a tour day?",
    a: [
      "We refund the amount paid for that cancelled day—normally CAD $1,575—without retaining the 20% guest-cancellation penalty on it.",
      "If Vista Chase cancels the entire package, we refund the package amount paid. Separately invoiced attractions follow their disclosed operator terms.",
    ],
  },
  {
    q: "What if Ice Explorer and Skywalk cannot operate?",
    a: [
      "If the Icefields tour operates but the glacier experience is cancelled, the replacement itinerary visits Athabasca Falls and Sunwapta Falls, subject to conditions.",
      "Attraction-ticket refunds follow the operator’s policy and any refund received. An attraction disruption does not automatically create a full-package refund.",
    ],
  },
];
