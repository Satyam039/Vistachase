/**
 * The concierge's product knowledgebase: every experience on the live website (www.vistachase.com),
 * one structured entry per product, written from the product pages as they read on 12 November 2026.
 *
 * Source of truth, by field:
 *   - Text here (overview, stops, inclusions, pickup, capacity, season): the live product page.
 *   - Prices, departure times and free seats: never written here. They are read from the live
 *     departures (the same rows the website's calendars sell) every time the concierge answers, see
 *     catalog-live.ts. Multi-day packages, which have no departures of their own, carry the page's
 *     published price in `packagePrice`.
 *
 * To update: edit the product's entry when its page changes (one place, typed). A new product needs
 * an entry here and its page; tests/concierge-knowledge.test.ts checks every entry against the catalog.
 * Never add facts from blog posts or the old Webflow site.
 */

export type ProductType = "SHARED" | "PRIVATE" | "SHUTTLE";
export type Place = "banff" | "lake-louise" | "moraine-lake" | "yoho" | "icefields-parkway" | "columbia-icefield" | "jasper" | "abraham-lake" | "johnston-canyon";
/** "summer" = June 1 to October 10, "winter" = October 11 to May 31 (the website's two price seasons). */
export type Season = "summer" | "winter";

export interface WebsiteProduct {
  slug: string;
  name: string;
  type: ProductType;
  /** Tour days (1 for day tours and shuttles). */
  days: number;
  /** Product page on the website. */
  page: string;
  /** The photo the website's card uses for it. */
  image: string;
  /** One or two sentences, from the page. */
  overview: string;
  duration: string;
  /** Planned stops (each day for multi-day), from the page's itinerary. */
  stops: string[];
  places: Place[];
  /** When it runs. `months` lists the calendar months it can be booked for (1–12); omitted = all year. */
  season: { text: string; months?: number[] };
  pickup: string;
  /** Capacity as the website states it. */
  capacity: string;
  /** The largest party one booking can take. */
  maxGuests: number;
  included: string[];
  notIncluded: string[];
  cancellation: string;
  /** Season notes that change what's included (e.g. Moraine Lake, Ice Explorer). */
  seasonNotes?: string[];
  /** "chat": a departure in the live calendar, booked with the in-chat checkout. "page": a multi-day
   *  package, booked with the in-chat package checkout (frontend ConciergePackageCheckout). */
  bookIn: "chat" | "page";
  /** Packages only: the page's published price (CAD, per guest or per vehicle). */
  packagePrice?: { text: string; fromAmount: number; unit: "per guest" | "per vehicle" };
  /** Short reasons to suggest it, matched against what the guest says they want. */
  goodFor: string[];
}

const SUMMER_MONTHS = [6, 7, 8, 9, 10];
const SHARED_CANCEL = "Free cancellation up to 24 hours before departure (full refund); no refund after that or for a no-show.";
const PRIVATE_CANCEL = "Free cancellation up to 72 hours before departure (full refund); no refund after that or for a no-show.";
const PACKAGE_CANCEL = "Private multi-day packages: 80% refund if cancelled 72+ hours before the earliest booked service (an arrival transfer before the tours, otherwise the first tour); 20% of the total package price is non-refundable; no refund after that.";

export const WEBSITE_CATALOG: WebsiteProduct[] = [
  {
    slug: "banff-highlights-tour",
    name: "Banff & Yoho Discovery",
    type: "SHARED",
    days: 1,
    page: "/banff-highlights-tour",
    image: "/media/photos/moraine-lake-ten-peaks.webp",
    overview:
      "Our award-winning small-group day through Banff and Yoho: Lake Louise, Moraine Lake (June 1 to October 10), Johnston Canyon, Emerald Lake and more with a local guide.",
    duration: "10–11 hours",
    stops: ["Lake Louise (about 1 h)", "Moraine Lake (about 1 h, June 1–Oct 10)", "Johnston Canyon (about 1 h)", "Emerald Lake (30 min)", "Natural Bridge (15 min)", "Lake Minnewanka (20 min)", "Two Jack Lake (15 min)", "Lower Spiral Tunnels Viewpoint (15 min)", "Morant's Curve (15 min)"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon"],
    season: { text: "Year round; Moraine Lake only June 1 to October 10" },
    pickup: "Hotel pickup in Canmore from about 7:30 AM and Banff from about 8:00 AM; back around 5:30 PM Banff / 6:00 PM Canmore. Exact time confirmed the evening before.",
    capacity: "Small group in a 15-passenger van",
    maxGuests: 12,
    included: ["Professional local guide", "Air-conditioned vehicle", "Bottled water", "Admission fees for itinerary stops", "Moraine Lake access (June 1 to October 10)", "Pickup and drop-off in Banff and Canmore", "Taxes and required fees"],
    notIncluded: ["Lunch (stop in Lake Louise Village)", "Personal expenses"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["Winter (October 11 to May 31): Moraine Lake road is closed, so the route skips it."],
    bookIn: "chat",
    goodFor: ["first visit", "best seller", "award-winning", "lakes", "Lake Louise", "Moraine Lake", "Yoho", "budget", "families"],
  },
  {
    slug: "shared-tours-icefields-jasper",
    name: "Columbia Icefield Adventure",
    type: "SHARED",
    days: 1,
    page: "/shared-tours-icefields-jasper",
    image: "/media/photos/columbia-icefield-ice-explorer-card.webp",
    overview:
      "Small-group day on the Icefields Parkway: Bow Lake, Crowfoot Glacier, Peyto Lake and Waterfowl Lakes to the Columbia Icefield, with Ice Explorer and Skywalk tickets included June 1 to October 10. It does not go to Jasper town.",
    duration: "9–11 hours",
    stops: ["Bow Lake (30 min)", "Crowfoot Glacier (15 min)", "Peyto Lake (30 min, short uphill walk)", "Waterfowl Lakes (15 min)", "Columbia Icefield Ice Explorer (June 1–Oct 10)", "Columbia Icefield Skywalk (June 1–Oct 10)"],
    places: ["icefields-parkway", "columbia-icefield"],
    season: { text: "Year round; Ice Explorer and Skywalk included June 1 to October 10; Abraham Lake itinerary October 11 to May 31" },
    pickup: "Hotel pickup in Canmore from about 7:30 AM and Banff from about 8:00 AM; exact time confirmed the evening before.",
    capacity: "Small group, maximum 12 guests; minimum four passengers per departure",
    maxGuests: 12,
    included: ["Professional local guide", "Air-conditioned vehicle", "Drinking water", "Park admission", "Ice Explorer and Skywalk tickets (June 1 to October 10)", "Ice cleats wherever required (October 11 to May 31)", "Pickup and drop-off in Banff and Canmore", "Taxes and mandatory fees"],
    notIncluded: ["Meals (summer lunch break at the Columbia Icefield Centre; packed lunch in winter)", "Optional gratuities", "Personal expenses"],
    cancellation: SHARED_CANCEL,
    seasonNotes: [
      "Winter (October 11 to May 31): Abraham Lake replaces the Columbia Icefield Centre experience; Bow Lake, Crowfoot Glacier Lookout, Peyto Lake and Waterfowl Lakes remain; no Ice Explorer or Skywalk; ice cleats provided wherever required; bring a packed lunch.",
      "If the glacier activities can't operate: Athabasca Falls and Sunwapta Falls instead, lunch still at the Columbia Icefield Centre, up to 12 hours.",
    ],
    bookIn: "chat",
    goodFor: ["glacier", "Icefields Parkway", "Ice Explorer", "Skywalk", "Peyto Lake", "Bow Lake"],
  },
  {
    slug: "banff-private-tour",
    name: "Private Banff & Yoho Discovery",
    type: "PRIVATE",
    days: 1,
    page: "/banff-private-tour",
    image: "/media/photos/lake-louise-chateau-view.webp",
    overview:
      "The award-winning Banff & Yoho day just for your group, with your own vehicle and driver-guide, doorstep pickup and a pace set around you.",
    duration: "10–12 hours",
    stops: ["Lake Louise", "Moraine Lake (June 1–Oct 10)", "Johnston Canyon", "Emerald Lake", "Natural Bridge", "Lake Minnewanka", "Two Jack Lake", "Lower Spiral Tunnels Viewpoint", "Morant's Curve"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon"],
    season: { text: "Year round; Moraine Lake only in its operating season" },
    pickup: "Doorstep pickup in Banff, Canmore or Lake Louise at a morning time agreed with you; confirmed the evening before.",
    capacity: "Private, up to 13 guests (Luxury SUV up to 6, Mercedes-Benz Sprinter up to 13); priced per vehicle",
    maxGuests: 13,
    included: ["Private vehicle for your group", "Dedicated driver-guide", "Hotel pickup in Banff, Canmore or Lake Louise", "National park admission", "Bottled water", "Taxes and mandatory fees", "Moraine Lake access in its operating season"],
    notIncluded: ["Lunch (stop in Lake Louise Village)", "Third-party activities (gondola, cruises, canoes)", "Gratuities", "Personal expenses"],
    cancellation: PRIVATE_CANCEL,
    bookIn: "chat",
    goodFor: ["private", "premium", "families", "flexible pace", "Lake Louise", "Moraine Lake", "Yoho", "groups"],
  },
  {
    slug: "icefields-jasper-private-tour",
    name: "Private Columbia Icefield Adventure",
    type: "PRIVATE",
    days: 1,
    page: "/icefields-jasper-private-tour",
    image: "/media/photos/columbia-icefield-athabasca-glacier-card.webp",
    // Owner's page changes, 2026-11-24.
    overview:
      "Your own private van and driver-guide on the Icefields Parkway: the Columbia Icefield in summer, Abraham Lake in winter. From June 1 to October 10, Ice Explorer + Skywalk is one optional combined experience (about 2½ hours), requested with the number of participating guests; staff arrange tickets and invoice them separately. It does not go to Jasper town. If the glacier experience is cancelled but the tour runs, it visits Athabasca Falls and Sunwapta Falls.",
    duration: "Approximately 10–12 hours",
    stops: ["Bow Lake", "Crowfoot Glacier", "Peyto Lake", "Waterfowl Lakes", "Columbia Icefield Centre (summer; Ice Explorer + Skywalk optional combined, invoiced separately)", "Abraham Lake (winter)"],
    places: ["icefields-parkway", "columbia-icefield"],
    season: { text: "Year round; Columbia Icefield June 1 to October 10, Abraham Lake October 11 to May 31" },
    pickup: "Doorstep pickup and drop-off in Banff, Canmore or Lake Louise at a morning time agreed with you.",
    capacity: "Private, up to 14 guests in a passenger van (12–13 recommended for comfort); priced per van",
    maxGuests: 14,
    included: ["Private van for your group", "Dedicated driver-guide", "Doorstep pickup and drop-off in Banff, Canmore or Lake Louise", "National park admission", "Bottled water", "Taxes and mandatory fees"],
    notIncluded: ["Ice Explorer + Skywalk tickets (optional combined experience, invoiced separately)", "Lunch", "Gratuities", "Personal expenses"],
    cancellation: PRIVATE_CANCEL,
    bookIn: "chat",
    goodFor: ["private", "premium", "glacier", "Icefields Parkway", "groups"],
  },
  {
    slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
    name: "Moraine Lake & Lake Louise Shuttle",
    type: "SHUTTLE",
    days: 1,
    page: "/shuttles#shuttle-departure-2",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    overview:
      "Moraine Lake & Lake Louise Shuttle early-morning departures 1 and 2 (CAD $135 per person; same fare for adults, children and infants; every passenger requires a seat), with independent exploration at both lakes and no guide onboard.",
    duration: "About 6 hours",
    stops: ["Moraine Lake (about 1.5 h)", "Lake Louise (1.5–2 h)"],
    places: ["moraine-lake", "lake-louise"],
    season: { text: "June 1–October 12 (Departure 1: June 1–July 31; Departure 2: June 1–October 12)", months: [6, 7, 8, 9, 10] },
    pickup:
      "Listed pickups only (no custom addresses): Departure 1: Canmore 2:45 AM, Banff 3:15 AM, Samson Mall 3:55 AM; Moraine 4:30–6:00, Lake Louise 6:30–8:00; est. return Samson Mall 8:15 AM, Banff 9:00 AM, Canmore 9:30 AM. Departure 2: Canmore 3:45 AM, Banff 4:15 AM, Samson Mall 4:55 AM; Moraine 5:30–7:00, Lake Louise 7:30–9:30; est. return Samson Mall 9:45 AM, Banff 10:30 AM, Canmore 11:00 AM.",
    capacity: "Small-group shuttle, up to 14 guests per departure (minimum 4 passengers required)",
    maxGuests: 14,
    included: ["Arranged shuttle access to Moraine Lake and Lake Louise (subject to road closures and operating conditions)", "Parks Canada admission fees", "Bottled water", "Round trip from listed Canmore, Banff or Samson Mall pickups"],
    notIncluded: ["Guided tour (explore independently)", "Meals and hot drinks", "Parking at Samson Mall"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["A sunrise departure can't guarantee clear skies. Guests must be ready 10 minutes before departure and follow their booked schedule. Four-passenger minimum; no refund if Parks Canada closes one lake while the shuttle operates."],
    bookIn: "chat",
    goodFor: ["sunrise", "photography", "Moraine Lake", "Lake Louise", "budget", "independent", "early"],
  },
  {
    slug: "full-day-at-lake-louise-and-moraine-lake",
    name: "Moraine Lake & Lake Louise Shuttle",
    type: "SHUTTLE",
    days: 1,
    page: "/shuttles#shuttle-departure-3",
    image: "/media/photos/moraine-lake-red-canoes.webp",
    overview:
      "Moraine Lake & Lake Louise Shuttle departures 3–7 (CAD $120 for departures 3–4; CAD $108 for departures 5–7; same fare for adults, children and infants), with independent time at both lakes and no guide.",
    duration: "About 5–6.5 hours, depending on the departure",
    stops: ["Moraine Lake (about 1.25–1.75 h)", "Lake Louise (about 1.5–2.5 h)"],
    places: ["moraine-lake", "lake-louise"],
    season: { text: "June 1–October 12 (Departures 3–6 run June 1–October 12; Departure 7 runs June 1–July 31)", months: [6, 7, 8, 9, 10] },
    pickup:
      "Listed pickups only in Canmore (30 min before Banff), Banff and Samson Mall (40 min after Banff). Est. Samson Mall returns: Dep 3 12:15 PM, Dep 4 3:00 PM, Dep 5 5:15 PM, Dep 6 7:45 PM, Dep 7 9:15 PM.",
    capacity: "Small-group shuttle, up to 14 guests per departure (minimum 4 passengers required)",
    maxGuests: 14,
    included: ["Arranged shuttle access to Moraine Lake and Lake Louise (subject to road closures and operating conditions)", "Parks Canada admission fees", "Bottled water", "Round trip from listed Canmore, Banff or Samson Mall pickups"],
    notIncluded: ["Guided tour (explore independently)", "Meals and hot drinks", "Parking at Samson Mall"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["Parking is not provided at Samson Mall, village public parking, or day-use areas. Eating onboard is not permitted (water allowed). Four-passenger minimum; no refund if Parks Canada closes one lake while the shuttle operates."],
    bookIn: "chat",
    goodFor: ["Moraine Lake", "Lake Louise", "budget", "independent", "flexible time", "families"],
  },
  {
    slug: "two-day-rockies-explorer",
    name: "Two-Day Rockies Explorer (Shared)",
    type: "SHARED",
    days: 2,
    page: "/two-day-rockies-explorer",
    image: "/media/photos/moraine-lake-classic.webp",
    overview: "Both small-group day tours in one booking with 10% off: Banff & Yoho Discovery on day 1 and the Columbia Icefield Adventure on day 2, each on its own date.",
    duration: "Two full-day tours",
    stops: ["Day 1: Banff & Yoho Discovery route", "Day 2: Columbia Icefield Adventure route (Ice Explorer and Skywalk June 1–Oct 10)"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield"],
    season: { text: "Year round (summer inclusions as each day tour)" },
    pickup: "Banff and Canmore, from about 7:30 AM (Canmore) and 8:00 AM (Banff) each day.",
    capacity: "Small group each day (not private)",
    maxGuests: 12,
    included: ["Everything included in each day tour", "10% off both tours"],
    notIncluded: ["Accommodation", "Lunch", "Gratuities on the Icefield day"],
    cancellation: "Shared-tour terms: free cancellation up to 24 hours before each tour.",
    bookIn: "page",
    packagePrice: { text: "CAD $396 per guest (both tours, 10% off the CAD $440 separate price)", fromAmount: 396, unit: "per guest" },
    goodFor: ["multi-day", "two days", "value", "save 10%", "glacier", "lakes"],
  },
  {
    slug: "two-day-rockies-explorer-private",
    name: "Private Two-Day Rockies Explorer",
    type: "PRIVATE",
    days: 2,
    page: "/two-day-rockies-explorer/private",
    image: "/media/photos/columbia-icefield-skywalk-guests-card.webp",
    overview: "Two private adventures, dates that fit your stay: Banff & Yoho Discovery and the Columbia Icefield Adventure in either order, consecutive or not, with a private van and driver-guide each day and 10% savings on summer tour days. Up to 14 guests; 12–13 recommended.",
    duration: "Two full-day private tours, approximately 10–12 hours each",
    stops: ["Banff & Yoho Discovery (private)", "Columbia Icefield Adventure (private; Abraham Lake in winter)"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield"],
    season: { text: "Year round" },
    pickup: "Doorstep pickup and drop-off in Banff or Canmore for each tour; exact pickup time confirmed before each tour.",
    capacity: "Private group of up to 14 guests; 12–13 recommended for comfort; priced per van per day",
    maxGuests: 14,
    included: ["Private vehicle and driver-guide each day", "Park admission", "Taxes and mandatory fees"],
    notIncluded: ["Accommodation", "Meals", "Optional Lake Minnewanka cruise and Ice Explorer + Skywalk (requested when booking, invoiced separately)", "Airport transfers unless added", "Gratuities"],
    cancellation: PACKAGE_CANCEL,
    bookIn: "page",
    packagePrice: { text: "Per van: both summer dates CAD $3,150, one summer and one winter CAD $2,815, both winter CAD $2,480 (CAD $1,575 per summer day with 10% saving, CAD $1,240 per winter day); airport transfers from CAD $364 per one-way transfer", fromAmount: 1240 * 2, unit: "per vehicle" },
    goodFor: ["multi-day", "two days", "private", "premium", "groups"],
  },
  {
    slug: "three-day-rockies-discovery",
    name: "Three-Day Rockies Discovery – Private",
    type: "PRIVATE",
    days: 3,
    page: "/three-day-rockies-discovery",
    image: "/media/photos/bow-lake-dock-sunrise.webp",
    overview: "Three private tours on different dates in any order: Banff Lakes & Viewpoints; Lake Louise, Moraine Lake & Yoho; Icefields Parkway & Columbia Icefield. Private van and driver-guide each tour, 10% savings, Banff/Canmore pickup.",
    duration: "Three private tours; usually around 10 hours each, allow up to 12 hours",
    stops: ["Banff Lakes & Viewpoints: Bow Falls, Surprise Corner, Hoodoos, Lake Minnewanka (optional cruise), Two Jack Lake, Cascade Ponds, Johnston Canyon (Banff Gondola optional)", "Lake Louise, Moraine Lake & Yoho: Moraine Lake, Lake Louise, Emerald Lake, Natural Bridge, Takakkaw Falls, Spiral Tunnels, Morant’s Curve, Bow Valley Parkway", "Icefields Parkway & Columbia Icefield: Bow Lake, Peyto Lake, Crowfoot Glacier, Waterfowl Lakes, Big Bend seen along the drive, Athabasca Glacier (optional Ice Explorer + Skywalk combined)"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield"],
    season: { text: "Summer only (June 1 to October 10)", months: SUMMER_MONTHS },
    pickup: "Doorstep pickup and drop-off in Banff or Canmore for each tour (a different confirmed address per tour is fine).",
    capacity: "Private, up to 14 guests (12–13 recommended); priced per van",
    maxGuests: 14,
    included: ["Private vehicle and driver-guide for 3 days", "Doorstep pickup and drop-off", "Park admission", "Moraine Lake access arrangements", "Taxes and mandatory fees"],
    notIncluded: ["Accommodation", "Meals", "Optional activities (Banff Gondola, Lake Minnewanka cruise, Ice Explorer + Skywalk combined; invoiced separately)", "Airport transfers unless added (CAD $364 one way for 1–6, CAD $850 for 7–14)", "Gratuities"],
    cancellation: PACKAGE_CANCEL,
    bookIn: "page",
    packagePrice: { text: "CAD $4,725 per private van for all three tours (CAD $1,575 per tour, 10% savings, save CAD $525), summer only", fromAmount: 4725, unit: "per vehicle" },
    goodFor: ["multi-day", "three days", "private", "premium", "in-depth"],
  },
  {
    slug: "four-day-rockies-and-jasper",
    name: "Four-Day Rockies & Jasper – Private",
    type: "PRIVATE",
    days: 4,
    page: "/four-day-rockies-and-jasper",
    image: "/media/photos/maligne-lake-cruise-panoramic-card.webp",
    overview: "Four private tours: Banff Lakes & Viewpoints and Lake Louise, Moraine Lake & Yoho on any available dates, then Icefields Parkway to Jasper and Jasper Highlights & Return on consecutive dates with a guest-booked Jasper overnight between them. Final drop-off in Banff, Canmore or Lake Louise included; Calgary extra.",
    duration: "Four private tours; Icefields-to-Jasper about 10 hours, Jasper sightseeing and return to Banff or Canmore 10–12 hours",
    stops: ["Banff Lakes & Viewpoints (optional Lake Minnewanka cruise, Banff Gondola)", "Lake Louise, Moraine Lake & Yoho (with Morant’s Curve)", "Icefields Parkway to Jasper (Big Bend seen along the drive; optional Ice Explorer + Skywalk combined; overnight in Jasper)", "Jasper Highlights & Return, the next day: Medicine Lake, Maligne Lake (cruise to Spirit Island optional), Athabasca and Sunwapta Falls, return south"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield", "jasper"],
    season: { text: "Summer only (June 1 to October 10)", months: SUMMER_MONTHS },
    pickup: "Pickup in Banff or Canmore for the Banff, Lake Louise/Yoho and Icefields-to-Jasper tours; drop-off at your Jasper hotel after the Icefields-to-Jasper tour and pickup there for the Jasper return tour.",
    capacity: "Private, up to 14 guests (12–13 recommended for comfort); priced per van",
    maxGuests: 14,
    included: ["Private van and driver-guide for each of the four tours", "Transfer to Jasper and pickup there", "Final drop-off in Banff, Canmore or Lake Louise", "Park admission", "Taxes and mandatory fees"],
    notIncluded: ["Accommodation, including the Jasper night", "Meals", "Optional activities (Banff Gondola, Lake Minnewanka cruise, Ice Explorer + Skywalk, Maligne cruise; invoiced separately)", "Calgary drop-off incl. airport (extra cost, arranged separately)", "Gratuities"],
    cancellation: "Cancel at least 72 hours before your earliest booked service (an earlier arrival transfer, otherwise the first tour) for an 80% refund; 20% of the total package price is non-refundable. No refund after that or for unused services. Alberta time.",
    bookIn: "page",
    packagePrice: { text: "CAD $6,300 per private van for all four tours, incl. taxes, fees and 10% savings (save CAD $700), summer only", fromAmount: 6300, unit: "per vehicle" },
    goodFor: ["multi-day", "four days", "Jasper", "Maligne Lake", "private", "premium"],
  },
];

export const catalogEntry = (slug: string) => WEBSITE_CATALOG.find((p) => p.slug === slug);

/** Company-wide facts the website states, used across products. */
export const WEBSITE_FACTS = {
  ages: "Age categories: adult 16–99, youth 6–15, infant 0–5. The checkout shows each category's price for the date; infants ride free on a lap unless that departure has an infant price (then they pay it and take a seat).",
  seasons: "Summer prices and itineraries: June 1 to October 10. Winter: October 11 to May 31 (Moraine Lake road closed, no Ice Explorer or Skywalk).",
  airportTransfer: "Calgary Airport (YYC) transfers: per one-way transfer CAD $364 (Banff or Canmore) or CAD $445 (Lake Louise) for up to 6 guests, or CAD $850 (Banff or Canmore) or CAD $895 (Lake Louise) for 7 to 12 guests; a round trip is two transfers, only with private tours of two or more days.",
  contact: "support@vistachase.com, +1 (825) 734-9456, 6 a.m. to 9 p.m. Mountain Time.",
  refunds: "Approved refunds go back to the original payment method in 5–10 business days. Late arrivals, missed pickups and no-shows aren't refunded.",
  payment: "Prices include taxes and required fees; the total is shown before paying. Payment is by card on the secure checkout.",
};
