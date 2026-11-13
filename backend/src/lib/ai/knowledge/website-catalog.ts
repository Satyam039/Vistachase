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
const PACKAGE_CANCEL = "Private multi-day packages: 80% refund if cancelled 72+ hours before Day 1; no refund after that.";

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
    season: { text: "Year round; Ice Explorer and Skywalk included June 1 to October 10, route adjusted outside those dates" },
    pickup: "Hotel pickup in Canmore from about 7:30 AM and Banff from about 8:00 AM; exact time confirmed the evening before.",
    capacity: "Small group in a 15-passenger van",
    maxGuests: 12,
    included: ["Professional local guide", "Air-conditioned vehicle", "Bottled water", "Park admission", "Ice Explorer and Skywalk tickets (June 1 to October 10)", "Pickup and drop-off in Banff and Canmore", "Taxes and required fees"],
    notIncluded: ["Lunch (stop at the Columbia Icefield Centre)", "Gratuities", "Personal expenses"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["Winter (October 11 to May 31): the glacier activities don't run and the route is adjusted; the team confirms the route for the date."],
    bookIn: "chat",
    goodFor: ["glacier", "Icefields Parkway", "Ice Explorer", "Skywalk", "Peyto Lake", "Bow Lake"],
  },
  {
    slug: "winter-special",
    name: "Winter Special Shared Tour",
    type: "SHARED",
    days: 1,
    page: "/winter-special",
    image: "/media/site/ice-castle-51332-1280.webp",
    overview:
      "Small-group winter day (December 1 to April 30): frozen Lake Louise, Abraham Lake's ice bubbles, Howse Pass, Peyto Lake, Bow Lake and Crowfoot Glacier, with ice cleats provided.",
    duration: "8–10 hours",
    stops: ["Abraham Lake (ice bubbles)", "Howse Pass Viewpoint", "Peyto Lake", "Bow Lake", "Crowfoot Glacier Lookout", "Lunch in Lake Louise Village", "Lake Louise", "Johnston Canyon (if daylight allows)"],
    places: ["abraham-lake", "icefields-parkway", "lake-louise", "johnston-canyon"],
    season: { text: "December 1 to April 30 only", months: [12, 1, 2, 3, 4] },
    pickup: "Hotel pickup in Banff or Canmore, 7:00–8:00 AM (exact time confirmed the day before); back 5:00–6:00 PM.",
    capacity: "Small group, heated SUV or van",
    maxGuests: 12,
    included: ["Parks Canada entry fees", "Professional local guide", "Bottled water", "Heated transport in SUV or van", "Ice cleats"],
    notIncluded: ["Meals", "Gratuity"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["Ice bubble visibility depends on ice clarity and recent snowfall; the tour runs only when safe."],
    bookIn: "chat",
    goodFor: ["winter", "photography", "ice bubbles", "frozen lakes", "snow"],
  },
  {
    slug: "banff-private-tour",
    name: "Banff & Yoho Discovery – Private",
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
    name: "Columbia Icefield Adventure – Private",
    type: "PRIVATE",
    days: 1,
    page: "/icefields-jasper-private-tour",
    image: "/media/photos/columbia-icefield-athabasca-glacier-card.webp",
    overview:
      "Your own vehicle and driver-guide on the Icefields Parkway to the Columbia Icefield and back. Ice Explorer and Skywalk are optional extras (summer). It does not go to Jasper town.",
    duration: "10–12 hours",
    stops: ["Bow Lake", "Crowfoot Glacier", "Peyto Lake", "Waterfowl Lakes", "Columbia Icefield (Ice Explorer and Skywalk optional, extra)"],
    places: ["icefields-parkway", "columbia-icefield"],
    season: { text: "Year round; glacier activities June 1 to October 10 only" },
    pickup: "Doorstep pickup in Banff, Canmore or Lake Louise at a morning time agreed with you.",
    capacity: "Private, up to 13 guests (Luxury SUV up to 6, Mercedes-Benz Sprinter up to 13); priced per vehicle",
    maxGuests: 13,
    included: ["Private vehicle for your group", "Dedicated driver-guide", "Hotel pickup in Banff, Canmore or Lake Louise", "National park admission", "Bottled water", "Taxes and mandatory fees"],
    notIncluded: ["Ice Explorer and Skywalk admission (optional)", "Lunch (Columbia Icefield Centre)", "Gratuities", "Personal expenses"],
    cancellation: PRIVATE_CANCEL,
    bookIn: "chat",
    goodFor: ["private", "premium", "glacier", "Icefields Parkway", "groups"],
  },
  {
    slug: "winter-signature-private-tour",
    name: "Special Winter Private Tour",
    type: "PRIVATE",
    days: 1,
    page: "/winter-signature-private-tour",
    image: "/media/photos/three-sisters-canmore.webp",
    overview:
      "A private winter day in a heated SUV: Abraham Lake's ice bubbles, Howse Pass, Bow Lake, Peyto Lake, Crowfoot Glacier and frozen Lake Louise, with ice cleats provided.",
    duration: "8–10 hours",
    stops: ["Abraham Lake", "Howse Pass Viewpoint", "Bow Lake", "Peyto Lake (weather permitting)", "Crowfoot Glacier", "Lake Louise", "Johnston Canyon ice walk (if daylight allows)"],
    places: ["abraham-lake", "icefields-parkway", "lake-louise", "johnston-canyon"],
    season: { text: "Winter (dates in the live calendar)" },
    pickup: "Pickup from Banff, Canmore and Lake Louise hotels, 6:00–7:00 AM (exact time confirmed the day before).",
    capacity: "Private, up to 6 guests in a heated SUV with winter tires; priced per vehicle",
    maxGuests: 6,
    included: ["Private heated SUV with winter tires", "Professional local guide", "Bottled water", "Hotel pickup", "Ice cleats"],
    notIncluded: ["Meals", "Gratuity"],
    cancellation: PRIVATE_CANCEL,
    bookIn: "chat",
    goodFor: ["winter", "private", "photography", "ice bubbles", "couples", "premium"],
  },
  {
    slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
    name: "Sunrise Shuttle to Moraine Lake & Lake Louise",
    type: "SHUTTLE",
    days: 1,
    page: "/shuttles",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    overview:
      "Early-morning shuttle to both lakes: Moraine Lake around sunrise, then Lake Louise, with free time to explore on your own. Departures 1 and 2.",
    duration: "About 6 hours",
    stops: ["Moraine Lake (about 1.5 h)", "Lake Louise (1.5–2 h)"],
    places: ["moraine-lake", "lake-louise"],
    season: { text: "June to September", months: [6, 7, 8, 9] },
    pickup:
      "Departure 1: Canmore 2:45 AM, Banff 3:15 AM, Lake Louise Village (Samson Mall) 3:55 AM; Moraine 4:30–6:00, Lake Louise 6:30–8:00, back in Banff about 9:00 AM. Departure 2: Canmore 3:45, Banff 4:15, Samson Mall 4:55 AM; Moraine 5:30–7:00, Lake Louise 7:30–9:30, back in Banff about 10:30 AM.",
    capacity: "Small-group shuttle, up to 14 guests per departure",
    maxGuests: 14,
    included: ["Guaranteed Moraine Lake and Lake Louise access", "Parks Canada entry fees", "Professional local guide", "Bottled water and a hot drink", "Round trip from Canmore, Banff or Lake Louise"],
    notIncluded: ["Meals", "Personal expenses"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["A sunrise departure can't guarantee clear skies. Guests must be back at the bus at the booked lake pickup times."],
    bookIn: "chat",
    goodFor: ["sunrise", "photography", "Moraine Lake", "Lake Louise", "budget", "independent", "early"],
  },
  {
    slug: "full-day-at-lake-louise-and-moraine-lake",
    name: "Day Shuttle – Moraine Lake & Lake Louise",
    type: "SHUTTLE",
    days: 1,
    page: "/shuttles",
    image: "/media/photos/moraine-lake-red-canoes.webp",
    overview:
      "Daytime shuttle to Moraine Lake and Lake Louise with free time at each lake. Five departures a day (6:30 AM, 10:15 AM, 11:30 AM, 2:00 PM, 4:45 PM from Banff) in June and July.",
    duration: "About 5–6.5 hours, depending on the departure",
    stops: ["Moraine Lake (about 1.25–1.75 h)", "Lake Louise (about 1.5–2.5 h)"],
    places: ["moraine-lake", "lake-louise"],
    season: { text: "June to September (fewer departures in August and September)", months: [6, 7, 8, 9] },
    pickup:
      "Pickups in Canmore (30 min before Banff), Banff and Lake Louise Village (Samson Mall, 40 min after Banff). Example, 6:30 AM departure: Moraine 7:30–9:00, Lake Louise 9:30 AM–12:00 PM, back in Banff about 1:00 PM.",
    capacity: "Small-group shuttle, up to 14 guests per departure",
    maxGuests: 14,
    included: ["Guaranteed Moraine Lake and Lake Louise access", "Parks Canada entry fees", "Professional local guide", "Bottled water and a hot drink", "Round trip from Canmore, Banff or Lake Louise"],
    notIncluded: ["Meals", "Personal expenses"],
    cancellation: SHARED_CANCEL,
    seasonNotes: ["Don't drive to Lake Louise Village to board: village parking can't be used while on the shuttle."],
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
    overview: "Banff & Yoho Discovery and the Columbia Icefield Adventure, each with your own vehicle and guide, on dates you choose. Up to 13 guests.",
    duration: "Two full-day private tours",
    stops: ["Day 1: Banff & Yoho Discovery (private)", "Day 2: Columbia Icefield Adventure (private)"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield"],
    season: { text: "Year round" },
    pickup: "Doorstep pickup in Banff, Canmore or Lake Louise each day.",
    capacity: "Private, up to 13 guests; priced per vehicle per day",
    maxGuests: 13,
    included: ["Private vehicle and driver-guide each day", "Park admission", "Taxes and mandatory fees"],
    notIncluded: ["Accommodation", "Meals", "Optional activities (billed separately)", "Gratuities"],
    cancellation: PACKAGE_CANCEL,
    bookIn: "page",
    packagePrice: { text: "CAD $1,575 per day per vehicle (June 1–Oct 10) or CAD $1,240 per day (Oct 11–May 31); airport transfer CAD $364 each", fromAmount: 1240 * 2, unit: "per vehicle" },
    goodFor: ["multi-day", "two days", "private", "premium", "groups"],
  },
  {
    slug: "three-day-rockies-discovery",
    name: "Three-Day Rockies Discovery – Private",
    type: "PRIVATE",
    days: 3,
    page: "/three-day-rockies-discovery",
    image: "/media/photos/bow-lake-dock-sunrise.webp",
    overview: "Three private days: Banff's lakes and viewpoints, then Lake Louise, Moraine Lake and Yoho, then the Icefields Parkway to the Columbia Icefield, with doorstep pickup each day.",
    duration: "Three full-day private tours",
    stops: ["Day 1: Bow Falls, Surprise Corner, Hoodoos, Lake Minnewanka, Two Jack Lake, Cascade Ponds, Johnston Canyon (Banff Gondola optional)", "Day 2: Moraine Lake, Lake Louise, Emerald Lake, Natural Bridge, Takakkaw Falls, Spiral Tunnels, Bow Valley Parkway", "Day 3: Bow Lake, Peyto Lake, Crowfoot Glacier, Waterfowl Lakes, Big Bend, Athabasca Glacier (Ice Explorer and Skywalk optional)"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield"],
    season: { text: "Summer only (June 1 to October 10)", months: SUMMER_MONTHS },
    pickup: "Doorstep pickup in Banff, Canmore or Lake Louise each day.",
    capacity: "Private, up to 13 guests; priced per vehicle",
    maxGuests: 13,
    included: ["Private vehicle and driver-guide for 3 days", "Doorstep pickup and drop-off", "Park admission", "Moraine Lake access arrangements", "Taxes and mandatory fees"],
    notIncluded: ["Accommodation", "Meals", "Optional activities (gondola, Ice Explorer, Skywalk)", "Airport transfers unless added (CAD $364 each)", "Gratuities"],
    cancellation: PACKAGE_CANCEL,
    bookIn: "page",
    packagePrice: { text: "CAD $4,725 per vehicle (CAD $1,575 per day), summer only", fromAmount: 4725, unit: "per vehicle" },
    goodFor: ["multi-day", "three days", "private", "premium", "in-depth"],
  },
  {
    slug: "four-day-rockies-and-jasper",
    name: "Four-Day Rockies & Jasper – Private",
    type: "PRIVATE",
    days: 4,
    page: "/four-day-rockies-and-jasper",
    image: "/media/photos/maligne-lake-cruise-panoramic-card.webp",
    overview: "Four private days through Banff, Yoho and Jasper: the Icefields Parkway to Jasper on day 3 (you book a Jasper overnight), Maligne Valley and waterfalls on day 4, finishing in Banff, Lake Louise, Canmore or Calgary.",
    duration: "Four-day private journey",
    stops: ["Day 1: Banff sights", "Day 2: Lake Louise, Moraine Lake and Yoho", "Day 3: Icefields Parkway and Columbia Icefield to Jasper (overnight in Jasper)", "Day 4: Medicine Lake, Maligne Lake (cruise optional), Athabasca and Sunwapta Falls, return south"],
    places: ["banff", "lake-louise", "moraine-lake", "yoho", "johnston-canyon", "icefields-parkway", "columbia-icefield", "jasper"],
    season: { text: "Summer only (June 1 to October 10)", months: SUMMER_MONTHS },
    pickup: "Doorstep pickup in Banff, Canmore or Lake Louise; transfer to your Jasper hotel after day 3 and pickup there on day 4.",
    capacity: "Private, up to 13 guests; priced per vehicle",
    maxGuests: 13,
    included: ["Private vehicle and driver-guide for 4 days", "Transfer to Jasper and pickup there", "Final drop-off in Banff, Lake Louise, Canmore or Calgary", "Park admission", "Taxes and mandatory fees"],
    notIncluded: ["Accommodation, including the Jasper night", "Meals", "Optional activities (gondola, Ice Explorer, Skywalk, Maligne cruise)", "Gratuities"],
    cancellation: PACKAGE_CANCEL,
    bookIn: "page",
    packagePrice: { text: "CAD $6,300 per vehicle (CAD $1,575 per day), summer only", fromAmount: 6300, unit: "per vehicle" },
    goodFor: ["multi-day", "four days", "Jasper", "Maligne Lake", "private", "premium"],
  },
];

export const catalogEntry = (slug: string) => WEBSITE_CATALOG.find((p) => p.slug === slug);

/** Company-wide facts the website states, used across products. */
export const WEBSITE_FACTS = {
  ages: "Age categories: adult 16–99, youth 6–15, infant 0–5. The checkout shows each category's price for the date; infants ride free on a lap unless that departure has an infant price (then they pay it and take a seat).",
  seasons: "Summer prices and itineraries: June 1 to October 10. Winter: October 11 to May 31 (Moraine Lake road closed, no Ice Explorer or Skywalk).",
  airportTransfer: "Calgary Airport (YYC) transfers: CAD $364 per transfer, only with private tours of two or more days.",
  contact: "support@vistachase.com, +1 (825) 734-9456, 6 a.m. to 9 p.m. Mountain Time.",
  refunds: "Approved refunds go back to the original payment method in 5–10 business days. Late arrivals, missed pickups and no-shows aren't refunded.",
  payment: "Prices include taxes and required fees; the total is shown before paying. Payment is by card on the secure checkout.",
};
