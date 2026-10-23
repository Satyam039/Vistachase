// Copy for the Shared Tours page and the Two-Day Rockies Explorer, from the owner's "Update Vista
// Chase web" doc (Shared Tour Page section, 2026-10-22). Stops and inclusions follow the Viator
// listings the doc points to; prices are not here: they come from each tour's live departures.

export const SHARED_HERO = {
  title: "Small-Group Tours in the Canadian Rockies",
  kicker: "Small Groups. Big Days Out.",
  lede:
    "Discover Banff and Yoho, journey along the Icefields Parkway to the Columbia Icefield, or combine both adventures in one easy two-day booking. Explore with passionate guides and no more than 12 guests.",
  cta: "Explore Our Three Tours",
  reviews: "1,700+ reviews across Google, Tripadvisor & GetYourGuide",
  chips: ["Maximum 12 Guests", "Banff & Canmore Departures", "Park Admission Included", "Passionate Local Guides"],
};

export const SHARED_INTRO = {
  title: "One Day or Two. Make It Memorable.",
  body:
    "Choose from two full-day adventures or book both together in our two-day package. Discover remarkable lakes, mountain landscapes and glacier experiences with a maximum of 12 guests each day.",
  note: "The two-day package combines both day tours in one checkout. Accommodation is not included.",
  stats: [
    { value: "3", label: "Experiences" },
    { value: "Maximum 12", label: "Guests" },
    { value: "1,700+", label: "Reviews" },
    { value: "15,000+", label: "Guests Guided" },
  ],
};

export const PICKUP_TIMES =
  "Pickups start at 7:30 AM in Canmore and 8:00 AM in Banff. Your exact pickup time depends on your location and is confirmed before your tour.";

export interface DayTour {
  /** Product the card books (live price, departures and product page). */
  slug: string;
  title: string;
  label: string;
  description: string;
  highlight: string;
  duration: string;
  keyNote: string;
  image: string;
  imageAlt: string;
  button: string;
  stops: string[];
  included: string[];
  lunch: string;
}

export const BANFF_YOHO: DayTour = {
  slug: "banff-highlights-tour",
  title: "Banff & Yoho Discovery",
  label: "Iconic Lakes & Mountain Views",
  description: "Explore Lake Louise, Moraine Lake and the highlights of Banff and Yoho with a passionate guide.",
  highlight: "Iconic lakes and sightseeing · One full day · Award-winning tour",
  duration: "1 full day",
  keyNote: "Route varies by season",
  image: "/media/photos/moraine-lake-ten-peaks.webp",
  imageAlt: "Moraine Lake below the Valley of the Ten Peaks",
  button: "View Banff & Yoho Tour",
  stops: [
    "Lake Louise",
    "Moraine Lake",
    "Johnston Canyon",
    "Emerald Lake",
    "Natural Bridge",
    "Lake Minnewanka",
    "Two Jack Lake",
    "Lower Spiral Tunnels Viewpoint",
    "Morant's Curve",
  ],
  included: [
    "Park admission",
    "Moraine Lake transportation (June 1 to October 10)",
    "Air-conditioned vehicle",
    "Bottled water",
  ],
  lunch: "Lunch stop in Lake Louise Village (lunch not included).",
};

export const ICEFIELD: DayTour = {
  slug: "shared-tours-icefields-jasper",
  title: "Columbia Icefield Adventure",
  label: "Lakes, Glaciers & Skywalk",
  description: "Journey along the Icefields Parkway, with scenic lake stops, the Ice Explorer and Columbia Icefield Skywalk.",
  highlight: "Icefields Parkway · Ice Explorer and Skywalk on the summer itinerary · One full day",
  duration: "1 full day",
  keyNote: "Glacier activities included on the summer itinerary",
  image: "/media/photos/columbia-icefield-ice-explorer.jpg",
  imageAlt: "Ice Explorer on the Athabasca Glacier",
  button: "View Icefield Tour",
  stops: [
    "Bow Lake",
    "Crowfoot Glacier",
    "Peyto Lake",
    "Waterfowl Lakes",
    "Columbia Icefield Ice Explorer (summer)",
    "Columbia Icefield Skywalk (summer)",
  ],
  included: [
    "Park admission",
    "Ice Explorer and Skywalk tickets (June 1 to October 10)",
    "Air-conditioned vehicle",
    "Bottled water",
  ],
  lunch: "Lunch stop at the Columbia Icefield Centre (lunch not included). Travels as far as the Columbia Icefield, not to Jasper town.",
};

export const TWO_DAY_PACKAGE = {
  slug: "two-day-rockies-explorer",
  href: "/two-day-rockies-explorer",
  title: "Two-Day Rockies Explorer",
  label: "Both Tours. One Booking.",
  description:
    "Combine both single-day adventures to discover Banff, Yoho and the Icefields Parkway as far as the Columbia Icefield.",
  highlight: "Both tours in one booking · Two full days · Accommodation excluded",
  duration: "2 full-day tours",
  keyNote: "Accommodation not included. Columbia Icefield tickets included from June 1 to October 10.",
  saving: "Save 10% when booking both",
  discount: 0.1,
  images: [
    { src: "/media/photos/moraine-lake-classic.webp", alt: "Moraine Lake" },
    { src: "/media/photos/athabasca-glacier.webp", alt: "The Athabasca Glacier" },
  ],
  button: "View Two-Day Package",
  requestMessage:
    "I'd like to book the Two-Day Rockies Explorer (Banff & Yoho Discovery + Columbia Icefield Adventure, 10% off).\nDay 1 date:\nDay 2 date:\nWhere we're staying:",
  days: [BANFF_YOHO, ICEFIELD],
};

/** Package price per guest: both day tours' prices less the package discount, rounded down to
 *  whole dollars (never less than the 10% promised). Separate is what both days cost on their own. */
export function packagePrice(day1: number, day2: number): { price: number; separate: number } {
  if (!(day1 > 0) || !(day2 > 0)) return { price: 0, separate: 0 };
  return { price: Math.floor((day1 + day2) * (1 - TWO_DAY_PACKAGE.discount)), separate: day1 + day2 };
}

export const SHARED_BENEFITS = [
  {
    title: "Small Groups, Personal Attention",
    body: "Explore with no more than 12 guests each day, with more attention from your guide.",
  },
  {
    title: "Passionate Local Guides",
    body: "Discover the stories, scenery and local insights that make the Rockies memorable.",
  },
  {
    title: "Admission Taken Care Of",
    body: "Park and Moraine Lake admission is included, along with the experiences specified in your selected itinerary.",
  },
  {
    title: "Clear, Upfront Pricing",
    body: "Taxes and required fees included. Know the total before you book.",
  },
];

export const SHARED_FAQS: { q: string; a: string }[] = [
  {
    q: "Which tour should I choose?",
    a: "Choose Banff & Yoho Discovery for iconic lakes and sightseeing, or Columbia Icefield Adventure for the Icefields Parkway and glacier experiences. The Two-Day Rockies Explorer combines both tours in one booking.",
  },
  {
    q: "How does the two-day package work?",
    a: "Book both full-day tours together in a single checkout and save 10%. Accommodation is not included; guests arrange their own overnight stay.",
  },
  {
    q: "How long are the tours?",
    a: "Each single-day experience is a full-day outing. Check your selected tour for its estimated duration and pickup details. Traffic, weather and road conditions can affect return times.",
  },
  {
    q: "Where do tours depart from?",
    a: "Tours depart from Banff and Canmore. Available hotel pickups and meeting points are listed on each tour page, with your pickup arrangements confirmed before departure.",
  },
  {
    q: "How many guests join each tour?",
    a: "Our shared tours carry a maximum of 12 guests each day for a more personal experience.",
  },
  {
    q: "Are attraction tickets included?",
    a: "The summer Columbia Icefield Adventure includes Ice Explorer and Skywalk admission from June 1 to October 10. Moraine Lake transportation is included on itineraries visiting Moraine Lake. Check your selected date and tour for seasonal inclusions.",
  },
  {
    q: "Are the tours suitable for everyone?",
    a: "Walking requirements vary by itinerary, with some uneven paths and uphill sections. Review the activity details and contact us before booking if anyone in your group has mobility concerns.",
  },
  {
    q: "Where do we stop for lunch?",
    a: "On the Banff & Yoho tour, we stop in Lake Louise Village. On the Icefields Parkway tour, we stop at the Columbia Icefield Centre. The two-day package follows the lunch stop for each day's itinerary.",
  },
  {
    q: "Can I bring my own lunch?",
    a: "Yes, you're welcome to bring a packed lunch and snacks to enjoy during the designated lunch stop.",
  },
  {
    q: "Do I need to book a separate Moraine Lake shuttle?",
    a: "No. If Moraine Lake is included in your selected itinerary, transportation to the lake is arranged by Vista Chase. No separate shuttle reservation is required.",
  },
  {
    q: "Will we visit every location shown on the website?",
    a: "Each tour has its own itinerary. Some locations are seasonal, and stops or their order may change due to weather, road conditions or closures. Check your selected tour for its planned stops.",
  },
  {
    q: "Does the Icefields Parkway tour visit Jasper town?",
    a: "No. This tour travels along the Icefields Parkway as far as the Columbia Icefield for the glacier adventure and Skywalk. It does not continue to Jasper town.",
  },
  {
    q: "Is the two-day package a private tour?",
    a: "No. It combines our two shared day tours in one booking, with a maximum of 12 guests each day. Other guests may join either day.",
  },
  {
    q: "Does the two-day package include accommodation?",
    a: "No. The package includes two full-day tours. Guests arrange and pay for their own accommodation.",
  },
  {
    q: "What should I bring?",
    a: "Bring comfortable walking shoes, layers, a weatherproof jacket, sun protection and any personal essentials. Pack an extra warm layer for the Columbia Icefield day.",
  },
  {
    q: "Will we see wildlife?",
    a: "Wildlife sightings are possible but cannot be guaranteed. Animals roam freely, and any viewing must respect safe distances and park rules.",
  },
  {
    q: "What time does pickup start?",
    a: "Pickups start at 7:30 AM in Canmore and 8:00 AM in Banff. Your exact pickup time depends on your location and will be confirmed before your tour. Please be ready at your confirmed pickup point at the time provided.",
  },
];

export const SHARED_CLOSING = {
  eyebrow: "Your Rockies Adventure Starts Here",
  title: "One Day or Two. Make It Extraordinary.",
  body:
    "Discover Banff and Yoho, experience the Columbia Icefield, or combine both adventures. Passionate guides, small groups and remarkable places - all waiting for you.",
  phone: { label: "+1 (825) 734-9456", href: "tel:+18257349456" },
  email: { label: "support@vistachase.com", href: "mailto:support@vistachase.com" },
};
