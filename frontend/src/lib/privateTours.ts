import { isVisibleLink } from "@/lib/activityTickets";
import { THREE_DAY_CANCELLATION } from "@/lib/threeDayContent";
// Copy and structure for the Private Tours page and multi-day private journeys,
// from the owner's change-tracking specification (Private Tour Page section).

export const PRIVATE_HERO = {
  title: "Private Tours of the Canadian Rockies",
  kicker: "YOUR PEOPLE. YOUR PACE.",
  lede:
    "Explore for one to four days with your own guide, private vehicle and doorstep pickup. Add airport transfers when booking two or more tour days—and enjoy the Rockies without renting a car.",
  cta: "Explore Private Tours",
  reviews: "1,700+ company reviews across Google, Tripadvisor & GetYourGuide",
  chips: [
    "Private Vehicle & Guide",
    "Doorstep Pickup",
    "Optional Activities",
    "Priced Per Vehicle not Per Person",
  ],
  note: "Airport transfers from CAD $364 per transfer, with bookings of 2+ tour days",
};

export const PRIVATE_INTRO = {
  title: "A Journey That Fits",
  body1:
    "Choose a private Banff and Yoho day, a Columbia Icefield adventure, or combine both in a two-day package. Explore further with three and four-day options, with activities selected at checkout.",
  body2:
    "For journeys of up to three days, stay in Banff, Canmore or Lake Louise. The four-day package includes a guest-booked overnight in Jasper after your Icefields-to-Jasper tour; accommodation arrangements are detailed with each package.",
  stats: [
    { value: "6", label: "Private Options" },
    { value: "1–4", label: "Days" },
    { value: "Doorstep", label: "Pickup" },
    { value: "15,000+", label: "Guests Guided" },
  ],
  optionalNotice:
    "Paid activities are optional and selected at checkout, including the Banff Gondola, Ice Explorer, Columbia Icefield Skywalk and Spirit Island cruise.",
};

// Per-vehicle prices from the owner's doc (Pricing, 2026-10-29), CAD, up to 13 guests. Summer is
// June 1 – October 10, winter October 11 – May 31. The day tours are charged from their departures
// (backend scripts/seed-departures.ts and migration 9g_private_seasonal_prices); the packages are
// booked online from those same departures with the package price (PRIVATE_PACKAGES below).
export const PRIVATE_MAX_GUESTS = 14;
export const PACKAGE_DAY_PRICE = { summer: 1575, winter: 1240 };
/** Four-Day Rockies & Jasper (owner, 2026-11-24): up to 14 guests, 12–13 recommended for comfort. */
export const FOUR_DAY_MAX_GUESTS = 14;
/** Three-Day Rockies Discovery (owner, 2026-11-24): up to 14 guests, 12–13 recommended for comfort. */
export const THREE_DAY_MAX_GUESTS = 14;

/**
 * A package booked in one checkout (components/booking/PackageBookingSection.tsx). Must match
 * backend/src/modules/bookings/package-booking.ts PACKAGES: the same days (each a day tour, in
 * order) and discounts. Private journeys: the private day price less 10% in summer (1,750 -> 1,575
 * a day, the doc's package price) and the winter day price (1,240) unchanged.
 */
export interface PackageConfig {
  slug: string;
  title: string;
  days: { slug: string; title: string; label: string }[];
  discountPercent: number;
  winterDiscountPercent?: number;
  summerOnly?: boolean;
  vehicle?: boolean;
  maxGuests?: number;
  /** Pairs of days [i, j] that must be booked on consecutive dates (day j the day after day i). */
  consecutive?: [number, number][];
  /** Checkout copy overrides (Four-Day, owner 2026-11-24). */
  cancellationNote?: string;
  /** Pickups in Banff or Canmore only, each tour may use its own address (Three-Day, owner 2026-11-24). */
  banffCanmorePickup?: boolean;
  /** Airport transfers priced online to Banff or Canmore only; Lake Louise via Special requests. */
  banffCanmoreTransferOnly?: boolean;
  /** Each activity requested with its own participant count, no generic "Add-on activities" box. */
  directActivities?: boolean;
  /** Replace the shared-tour pickup start times with "confirmed before each tour". */
  hidePickupTimes?: boolean;
  /** An arrival transfer before the tours starts the cancellation deadline. */
  arrivalStartsDeadline?: boolean;
  guestNote?: string;
  datesNote?: string;
}

/** The Four-Day package's confirmed cancellation policy (owner, 2026-11-24), shown everywhere on its page. */
export const FOUR_DAY_CANCELLATION = {
  short:
    "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
  paragraphs: [
    "Cancel at least 72 hours before your earliest booked service for an 80% refund. The remaining 20% of the total package price is non-refundable.",
    "If an arrival transfer comes before your tours, the deadline runs from that transfer’s scheduled pickup. Otherwise, it runs from your first tour. Later guest cancellations and voluntarily unused services are non-refundable. Deadlines use local Alberta time.",
    "Changes may be requested at any time, subject to availability and confirmation. Requests do not extend the cancellation deadline or make unused services refundable.",
    "If Vista Chase cancels one tour day, we refund the amount paid for that day without retaining the guest-cancellation penalty. If Vista Chase cancels the entire package, the package amount paid is refunded. Separately invoiced attractions follow their disclosed operator terms.",
  ],
};

const BANFF_DAY = "banff-private-tour";
const ICEFIELD_DAY = "icefields-jasper-private-tour";

export const PRIVATE_PACKAGES: Record<"two" | "three" | "four", PackageConfig> = {
  two: {
    slug: "two-day-rockies-explorer-private",
    title: "Private Two-Day Rockies Explorer",
    days: [
      { slug: BANFF_DAY, title: "Banff & Yoho Discovery", label: "Private · Lake Louise, Moraine Lake & Yoho" },
      { slug: ICEFIELD_DAY, title: "Columbia Icefield Adventure", label: "Private · Icefields Parkway" },
    ],
    discountPercent: 10,
    winterDiscountPercent: 0,
    vehicle: true,
    maxGuests: PRIVATE_MAX_GUESTS,
  },
  three: {
    slug: "three-day-rockies-discovery",
    title: "Three-Day Rockies Discovery",
    // Owner, 2026-11-24: tour names, not Day 1-3; three different dates in any order, June 1 -
    // October 10; up to 14 guests; Banff/Canmore pickups. Same order as backend package-booking.ts.
    days: [
      { slug: BANFF_DAY, title: "Banff Lakes & Viewpoints", label: "Private · Banff, about 10 hours" },
      { slug: BANFF_DAY, title: "Lake Louise, Moraine Lake & Yoho", label: "Private · Lake Louise & Yoho, about 10 hours" },
      { slug: ICEFIELD_DAY, title: "Icefields Parkway & Columbia Icefield", label: "Private · Icefields Parkway, about 10 hours" },
    ],
    discountPercent: 10,
    summerOnly: true,
    vehicle: true,
    maxGuests: THREE_DAY_MAX_GUESTS,
    banffCanmorePickup: true,
    banffCanmoreTransferOnly: true,
    directActivities: true,
    hidePickupTimes: true,
    arrivalStartsDeadline: true,
    cancellationNote: `${THREE_DAY_CANCELLATION.short} If an arrival transfer comes before your tours, the deadline runs from its scheduled pickup; otherwise from your first tour. Alberta local time.`,
    guestNote: "Private, up to 14 guests; 12–13 recommended for comfort. One price per private van, whatever the group size.",
    datesNote:
      "Choose a different available date for each tour, in any order. Dates can be consecutive or separated by other days in your stay. All three tours must fall between June 1 and October 10.",
  },
  four: {
    slug: "four-day-rockies-and-jasper",
    title: "Four-Day Rockies & Jasper",
    // Owner, 2026-11-24: tour names, not fixed Day 1-4. The Banff and Lake Louise/Yoho tours take any
    // free dates; Icefields Parkway to Jasper and Jasper Highlights & Return run on consecutive dates
    // (`consecutive`), and all four dates differ. Same order as backend package-booking.ts.
    days: [
      { slug: BANFF_DAY, title: "Banff Lakes & Viewpoints", label: "Private · Banff" },
      { slug: BANFF_DAY, title: "Lake Louise, Moraine Lake & Yoho", label: "Private · Lake Louise & Yoho" },
      { slug: ICEFIELD_DAY, title: "Icefields Parkway to Jasper", label: "Private · Icefields Parkway, about 10 hours" },
      { slug: ICEFIELD_DAY, title: "Jasper Highlights & Return", label: "Private · Jasper, about 10–12 hours" },
    ],
    discountPercent: 10,
    summerOnly: true,
    vehicle: true,
    maxGuests: FOUR_DAY_MAX_GUESTS,
    consecutive: [[2, 3]],
    cancellationNote: `${FOUR_DAY_CANCELLATION.short} If an arrival transfer comes before your tours, the deadline runs from its scheduled pickup; otherwise from your first tour. Alberta local time.`,
    guestNote: "Private, up to 14 guests; 12–13 recommended for comfort. One price per private van, whatever the group size.",
    datesNote:
      "Choose an available date for each tour. Banff Lakes & Viewpoints and Lake Louise, Moraine Lake & Yoho can be on any free dates. Icefields Parkway to Jasper and Jasper Highlights & Return run on consecutive dates, with your Jasper overnight between them. All four dates must differ.",
  },
};

export interface PrivateTourOption {
  id: string;
  slug?: string;
  title: string;
  description: string;
  duration: string;
  transport: string;
  suggestedStay: string;
  pickup: string;
  group?: string;
  activities: string;
  airportTransfers: string;
  /** Optional rows (Four-Day, owner 2026-11-24). */
  finalDropoff?: string;
  scheduling?: string;
  /** "Dates" row (Three-Day, owner 2026-11-24). */
  dates?: string;
  /** Replaces the summer/winter price rows, e.g. "Summer only: June 1–October 10". */
  seasonLabel?: string;
  savings?: string;
  accommodation?: string;
  itinerary?: string;
  pricing?: string;
  scope?: string;
  priceFrom: number;
  priceUnit: string;
  priceNote?: string;
  seasonalPricing?: {
    summer: string;
    winter: string;
  };
  buttonLabel: string;
  buttonHref: string;
  image: string;
  imageAlt: string;
  isCustomPartner?: boolean;
}

export const PRIVATE_OPTIONS: PrivateTourOption[] = [
  {
    id: "banff-yoho-private",
    slug: "banff-private-tour",
    title: "Private Banff & Yoho Discovery",
    description: "Explore iconic lakes, Johnston Canyon and the highlights of Banff and Yoho with your own driver-guide and private van.",
    duration: "1 full day · approximately 10–12 hours",
    transport: "Private passenger van & driver-guide",
    suggestedStay: "Banff or Canmore",
    pickup: "Doorstep pickup in Banff or Canmore",
    group: "Up to 14 guests · 12–13 recommended for comfort",
    activities: "Optional Lake Minnewanka cruise",
    airportTransfers: "Available with 2+ tour days (from CAD $364)",
    priceFrom: 1240,
    priceUnit: "per van",
    priceNote: "Summer: CAD $1,750 per van · Winter: CAD $1,240 per van. Taxes and mandatory fees included. Optional Lake Minnewanka cruise costs extra.",
    seasonalPricing: {
      summer: "CAD $1,750 per van",
      winter: "CAD $1,240 per van",
    },
    buttonLabel: "View Private Tour",
    buttonHref: "/banff-private-tour",
    image: "/media/photos/lake-louise-chateau-view.webp",
    imageAlt: "Lake Louise below Victoria Glacier in Banff National Park",
  },
  {
    id: "columbia-icefield-private",
    slug: "icefields-jasper-private-tour",
    title: "Columbia Icefield Adventure",
    // Owner's tour card changes, 2026-11-24.
    description:
      "Discover Bow Lake, Peyto Lake and the Icefields Parkway with your own guide and van. Columbia Icefield in summer; Abraham Lake in winter.",
    duration: "1 day · approximately 10–12 hours",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Canmore/Banff/Lake Louise",
    pickup: "Doorstep Pickup Included",
    group: "Up to 14 guests; 12–13 recommended for comfort",
    activities: "Summer Ice Explorer + Skywalk: optional combined experience, invoiced separately.",
    airportTransfers: "From CAD $364 per transfer, with 2+ tour days",
    priceFrom: 0,
    priceUnit: "per vehicle",
    priceNote: "Jun 1–Oct 10: CAD $1,750. Oct 11–May 31: CAD $1,240, visiting Abraham Lake. Private, up to 14 guests.",
    seasonalPricing: {
      summer: "CAD $1,750 per vehicle",
      winter: "CAD $1,240 per vehicle",
    },
    buttonLabel: "View Itinerary",
    buttonHref: "/icefields-jasper-private-tour",
    image: "/media/photos/columbia-icefield-athabasca-glacier-card.webp",
    imageAlt: "Peyto Lake and Athabasca Glacier along the Icefields Parkway",
  },
  {
    id: "two-day-rockies-private",
    title: "Two-Day Rockies Explorer",
    description: "Combine both private day tours in one easy booking for lakes, mountain scenery and glacier views.",
    duration: "2 days",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Canmore/Banff/Lake Louise",
    pickup: "Doorstep Pickup Included",
    activities: "Optional Activities at Checkout",
    airportTransfers: "From CAD $364 per transfer, with 2+ tour days",
    accommodation: "Booked separately by you",
    priceFrom: PACKAGE_DAY_PRICE.winter * 2,
    priceUnit: "per vehicle",
    priceNote: "CAD $1,575 per day Jun 1–Oct 10, $1,240 per day Oct 11–May 31. Private, up to 13 guests.",
    seasonalPricing: {
      summer: "CAD $1,575/day ($3,150)",
      winter: "CAD $1,240/day ($2,480)",
    },
    buttonLabel: "View Itinerary",
    buttonHref: "/two-day-rockies-explorer/private",
    image: "/media/photos/columbia-icefield-skywalk-guests-card.webp",
    imageAlt: "The Columbia Icefield Skywalk above the Sunwapta Valley",
  },
  {
    id: "three-day-rockies-discovery",
    slug: "three-day-rockies-discovery",
    title: "Three-Day Rockies Discovery",
    // Owner's product card, 2026-11-24.
    description: "Three private adventures covering Banff, Lake Louise, Moraine Lake, Yoho and the Icefields Parkway—with flexible dates and 10% summer savings.",
    duration: "3 days",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Banff or Canmore",
    pickup: "Doorstep pickup and drop-off in Banff or Canmore",
    group: "Up to 14 guests; 12–13 recommended for comfort",
    dates: "Three different available dates, in any order",
    activities: "Optional experiences; tickets invoiced separately",
    airportTransfers: "From CAD $364 per one-way transfer for up to six passengers",
    accommodation: "Booked separately by you",
    priceFrom: PACKAGE_DAY_PRICE.summer * 3,
    priceUnit: "per vehicle",
    seasonLabel: "Summer only: June 1–October 10",
    buttonLabel: "View Itinerary",
    buttonHref: "/three-day-rockies-discovery",
    image: "/media/photos/bow-lake-dock-sunrise.webp",
    imageAlt: "Three days exploring Banff, Yoho and the Columbia Icefield",
  },
  {
    id: "four-day-rockies-jasper",
    slug: "four-day-rockies-and-jasper",
    title: "Four-Day Rockies & Jasper",
    // Owner's product card, 2026-11-24.
    description: "Explore Banff, Yoho and the Icefields Parkway, then stay overnight in Jasper for Maligne Valley and waterfall sightseeing before your return.",
    duration: "4 private tours",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Banff or Canmore, plus a guest-booked Jasper overnight between the two linked Jasper tours",
    pickup: "Banff/Canmore for the outbound tours; Jasper for the return tour",
    finalDropoff: "Banff, Canmore or Lake Louise included; Calgary extra",
    group: "Up to 14 guests; 12–13 recommended for comfort",
    scheduling: "Flexible Banff/Yoho dates; consecutive Icefields-to-Jasper and Jasper return dates",
    activities: "Optional experiences; tickets invoiced separately",
    airportTransfers: "Available at extra cost; Calgary–Banff/Canmore from CAD $364 one way for up to six passengers",
    accommodation: "Booked separately by you",
    priceFrom: PACKAGE_DAY_PRICE.summer * 4,
    priceUnit: "per vehicle",
    seasonLabel: "Summer only: June 1–October 10",
    savings: "10% included · Save CAD $700 on the four-tour price",
    buttonLabel: "View Itinerary",
    buttonHref: "/four-day-rockies-and-jasper",
    image: "/media/photos/maligne-lake-cruise-panoramic-card.webp",
    imageAlt: "Four-day journey extending into Jasper National Park and Maligne Lake",
  },
  {
    id: "premium-custom-banff-elite",
    title: "Your Rockies, Your Way",
    description:
      "Banff Elite is Vista Chase’s sister company for personalised tour itineraries. Choose a luxury SUV or luxury van, with options priced according to your vehicle and tour requirements.",
    duration: "Personalised itinerary",
    transport: "Luxury SUVs and luxury vans",
    suggestedStay: "Personalised around your interests and preferred pace",
    itinerary: "Personalised around your interests and preferred pace",
    pricing: "Personalised quote after consultation",
    scope: "Tours only; hotels and restaurants are not arranged",
    pickup: "Doorstep pickup",
    activities: "Tours and experiences personalised to you",
    airportTransfers: "Tours only; hotels and restaurants are not arranged",
    priceFrom: 0,
    priceUnit: "Personalised quote after consultation",
    buttonLabel: "Explore Banff Elite",
    buttonHref: "https://banffelite.com",
    image: "/media/photos/emerald-lake-island.webp",
    imageAlt: "Personalised Canadian Rockies tour itineraries by Banff Elite",
    isCustomPartner: true,
  },
];

export const PRIVATE_BENEFITS = [
  {
    title: "Your Own Guide",
    body: "Enjoy a dedicated guide and private vehicle exclusively for your group.",
  },
  {
    title: "Doorstep Pickup Included",
    body: "Start each tour day with pickup directly from your booked accommodation.",
  },
  {
    title: "Airport Transfers Available",
    body: "Add airport transportation from CAD $364 per transfer when booking two or more tour days.",
  },
  {
    title: "Priced Per Vehicle",
    body: "One vehicle price for your group, with optional activities selected at checkout.",
  },
];

export const PRIVATE_FAQS = [
  {
    q: "What is included in a private tour?",
    a: "Your tour includes a private vehicle, a dedicated guide and doorstep pickup. Check your selected package for its full inclusions. Optional activities are selected and priced at checkout.",
  },
  {
    q: "Can we customise our itinerary?",
    a: "We can adjust stops and pacing around your interests where the route, travel time and conditions allow. For personalised tour itineraries, our sister company Banff Elite can plan your journey.",
  },
  {
    q: "Can you arrange airport transfers?",
    a: "Yes. Airport transfers are available when booking two or more tour days, per one-way transfer for CAD $364 (Banff or Canmore) or CAD $445 (Lake Louise) for up to 6 guests, or CAD $850 (Banff or Canmore) or CAD $895 (Lake Louise) for 7 to 12 guests; a round trip is two transfers, added to your total at checkout. Arrange them alongside your tours so you can explore without renting a car.",
  },
  {
    q: "Do you book our accommodation?",
    a: "No. You choose and book your accommodation directly. Accommodation costs are not included in our tour prices.",
  },
  {
    q: "Where should we stay?",
    a: "For tours of up to three days, you can stay in Banff, Canmore or Lake Louise. The four-day package needs a guest-booked night in Jasper town after your Icefields-to-Jasper tour, with Banff or Canmore for the Banff-based tours.",
  },
  {
    q: "Are attraction tickets included?",
    a: "Activities are optional and selected at checkout. Choose experiences such as the Banff Gondola, Columbia Icefield Ice Explorer, Skywalk or Maligne Lake cruise where available on your itinerary.",
  },
  {
    q: "Can we visit Moraine Lake?",
    a: "Yes, on itineraries that include Moraine Lake during its operating season. Transportation arrangements depend on your vehicle option and will be explained before booking, including whether a shuttle transfer is required.",
  },
  {
    q: "How does the two-day package work?",
    a: "It combines our private Banff and Yoho tour with our private Icefields Parkway tour in one booking. You arrange your own accommodation between tour days.",
  },
  {
    q: "When will our guide be assigned?",
    a: "Your guide will be assigned the day before your tour. We’ll share their contact information once the assignment is confirmed.",
  },
  {
    q: "Will we have the same guide each day?",
    a: "We aim to keep the same guide throughout multi-day bookings. However, availability or operational circumstances may require a change.",
  },
  {
    q: "Can we request a specific guide?",
    a: "Yes. Let us know your preferred guide when booking, and we’ll do our best to accommodate your request. Requests are subject to the guide’s availability and cannot be guaranteed.",
  },
  {
    q: "What is included in the price?",
    a: "Your private tour price includes a dedicated driver-guide, private vehicle, doorstep pickup, national park fees, Moraine Lake access where included in your itinerary, taxes and all other required fees charged by authorities. Third-party activities—including gondola rides, lake cruises, canoe rentals, the Ice Explorer and Skywalk—cost extra. Available add-ons can be selected at checkout. Lunch and accommodation are not included.",
  },
];

export const PRIVATE_OTHER_WAYS = [
  {
    key: "shared",
    title: "Small-Group Tours",
    description: "Explore in small groups with passionate local guides. Choose one day or combine both adventures.",
    cta: "Explore Small-Group Tours",
    href: "/shared-tours",
    image: "/media/site/bow-river-train-canadian-rockies.webp",
  },
  {
    key: "shuttles",
    title: "Lake Shuttles",
    description: "Convenient transportation to Moraine Lake and Lake Louise, with time to explore independently.",
    cta: "Explore Lake Shuttles",
    href: "/shuttles",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
  },
  {
    key: "banff-elite",
    title: "Bespoke by Banff Elite",
    description: "A premium journey shaped around your dates, interests and pace, with premium vehicles and personalised planning.",
    cta: "Plan with Banff Elite ↗",
    href: process.env.NEXT_PUBLIC_BANFF_ELITE_URL || "https://banffelite.com",
    image: "/media/photos/bow-lake-reflection.webp",
    external: true,
  },
  {
    key: "tickets",
    title: "Attraction Tickets",
    description: "Discover gondola rides, lake cruises and glacier experiences to complement your Rockies visit.",
    cta: "Explore Attraction Tickets",
    href: "/banff-activity-tickets",
    image: "/media/site/banff-gondola-hike.webp",
  },
].filter(isVisibleLink);

export const PRIVATE_CLOSING = {
  eyebrow: "YOUR PRIVATE ROCKIES EXPERIENCE",
  title: "Your Journey Starts Here",
  body:
    "Your own guide, private vehicle and doorstep pickup. Choose a day of discovery or explore further with a multi-day itinerary, adding the activities you love. Booking two or more tour days? Add airport transfers and enjoy your visit without renting a car.",
  buttons: [
    { label: "Choose Your Private Tour", href: "#private-tours" },
    { label: "Contact Our Team", href: "/contact-us" },
  ],
  phone: { label: "+1 (825) 734-9456", href: "tel:+18257349456" },
  email: { label: "support@vistachase.com", href: "mailto:support@vistachase.com" },
};
