// Copy and structure for the Private Tours page and multi-day private journeys,
// from the owner's change-tracking specification (Private Tour Page section).

export const PRIVATE_HERO = {
  title: "Private Tours of the Canadian Rockies",
  kicker: "YOUR PEOPLE. YOUR PACE.",
  lede:
    "Explore for one to five days with your own guide, private vehicle and doorstep pickup. Add airport transfers when booking two or more tour days—and enjoy the Rockies without renting a car.",
  cta: "Explore Private Tours",
  reviews: "1,700+ company reviews across Google, Tripadvisor & GetYourGuide",
  chips: [
    "Private Vehicle & Guide",
    "Doorstep Pickup",
    "Optional Activities",
    "Priced Per Vehicle not Per Person",
  ],
  note: "Airport transfers available with bookings of 2+ tour days",
};

export const PRIVATE_INTRO = {
  title: "A Journey That Fits",
  body1:
    "Choose a private Banff and Yoho day, a Columbia Icefield adventure, or combine both in a two-day package. Explore further with three, four and five-day options, with activities selected at checkout.",
  body2:
    "For journeys of up to three days, stay in Banff, Canmore or Lake Louise. The four-day itinerary includes an overnight stop in Jasper after day three; accommodation arrangements are detailed with each package.",
  stats: [
    { value: "6", label: "Private Options" },
    { value: "1–5", label: "Days" },
    { value: "Doorstep", label: "Pickup" },
    { value: "15,000+", label: "Guests Guided" },
  ],
  optionalNotice:
    "Paid activities are optional and selected at checkout, including the Banff Gondola, Ice Explorer, Columbia Icefield Skywalk and Spirit Island cruise.",
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
  activities: string;
  airportTransfers: string;
  accommodation?: string;
  priceFrom: number;
  priceUnit: string;
  priceNote?: string;
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
    title: "Banff & Yoho Discovery",
    description: "Iconic lakes, Johnston Canyon and the mountain scenery of Banff and Yoho, experienced privately.",
    duration: "1 day",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Canmore/Banff/Lake Louise",
    pickup: "Doorstep Pickup Included",
    activities: "Optional Activities at Checkout",
    airportTransfers: "Available with 2+ Tour Days",
    priceFrom: 1250,
    priceUnit: "per vehicle",
    buttonLabel: "View Itinerary",
    buttonHref: "/banff-private-tour",
    image: "/media/photos/moraine-lake-reflection-morning.webp",
    imageAlt: "Moraine Lake at sunrise in Banff National Park",
  },
  {
    id: "columbia-icefield-private",
    slug: "icefields-jasper-private-tour",
    title: "Columbia Icefield Adventure",
    description: "Discover Bow Lake, Peyto Lake and the Icefields Parkway, travelling as far as the Columbia Icefield.",
    duration: "1 day",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Canmore/Banff/Lake Louise",
    pickup: "Doorstep Pickup Included",
    activities: "Optional Activities at Checkout",
    airportTransfers: "Available with 2+ Tour Days",
    priceFrom: 1450,
    priceUnit: "per vehicle",
    buttonLabel: "View Itinerary",
    buttonHref: "/icefields-jasper-private-tour",
    image: "/media/photos/peyto-lake.webp",
    imageAlt: "Peyto Lake along the Icefields Parkway",
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
    airportTransfers: "Available with 2+ Tour Days",
    accommodation: "Booked Separately by customers on multi-day cards",
    priceFrom: 2430, // (1250 + 1450) * 0.9 = 2430 (10% package saving)
    priceUnit: "per vehicle",
    priceNote: "Save 10% when booking both days together",
    buttonLabel: "View Itinerary",
    buttonHref: "/contact-us?package=two-day-rockies-explorer-private",
    image: "/media/photos/moraine-lake-classic.webp",
    imageAlt: "Two-day private Canadian Rockies exploration",
  },
  {
    id: "three-day-rockies-discovery",
    slug: "three-day-rockies-discovery",
    title: "Three-Day Rockies Discovery",
    description: "Explore Banff’s highlights, Lake Louise, Moraine Lake, Yoho and the Columbia Icefield across three days.",
    duration: "3 days",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Canmore/Banff/Lake Louise",
    pickup: "Doorstep Pickup Included",
    activities: "Optional Activities at Checkout",
    airportTransfers: "Available with 2+ Tour Days",
    accommodation: "Booked Separately by customers on multi-day cards",
    priceFrom: 3645,
    priceUnit: "per vehicle",
    buttonLabel: "View Itinerary",
    buttonHref: "/three-day-rockies-discovery",
    image: "/media/photos/bow-lake-dock-sunrise.webp",
    imageAlt: "Three days exploring Banff, Yoho and the Columbia Icefield",
  },
  {
    id: "four-day-rockies-jasper",
    slug: "four-day-rockies-and-jasper",
    title: "Four-Day Rockies & Jasper",
    description: "Extend the three-day journey into Jasper, with Maligne Lake, dramatic waterfalls and a return to your chosen destination.",
    duration: "4 days",
    transport: "Private Vehicle & Guide",
    suggestedStay: "Canmore/Banff/Lake Louise (Jasper stay after day 3)",
    pickup: "Doorstep Pickup Included",
    activities: "Optional Activities at Checkout",
    airportTransfers: "Available with 2+ Tour Days",
    accommodation: "Booked Separately by customers on multi-day cards",
    priceFrom: 4860,
    priceUnit: "per vehicle",
    buttonLabel: "View Itinerary",
    buttonHref: "/four-day-rockies-and-jasper",
    image: "/media/photos/spirit-island.webp",
    imageAlt: "Four-day journey extending into Jasper National Park and Maligne Lake",
  },
  {
    id: "premium-custom-banff-elite",
    title: "Your Rockies, Your Way",
    description: "A stay designed around your dates, interests and pace by our premium sister company, Banff Elite.",
    duration: "Tailored to your stay",
    transport: "Premium SUVs & executive vans",
    suggestedStay: "Tailored to itinerary",
    pickup: "Doorstep pickup",
    activities: "Selected around your preferences",
    airportTransfers: "Arranged with your journey",
    accommodation: "Booked directly by you",
    priceFrom: 0,
    priceUnit: "Personalised quote",
    buttonLabel: "Plan with Banff Elite",
    buttonHref: process.env.NEXT_PUBLIC_BANFF_ELITE_URL || "https://banffelite.com",
    image: "/media/photos/emerald-lake-island.webp",
    imageAlt: "Custom tailored Canadian Rockies journey by Banff Elite",
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
    body: "Add airport transportation when booking two or more tour days.",
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
    a: "We can adjust stops and pacing around your interests where the route, travel time and conditions allow. For a fully bespoke premium journey, our sister company Banff Elite can plan your stay.",
  },
  {
    q: "Can you arrange airport transfers?",
    a: "Yes. Airport transfers are available when booking two or more tour days. Arrange them alongside your tours so you can explore without renting a car.",
  },
  {
    q: "Do you book our accommodation?",
    a: "No. You choose and book your accommodation directly. Accommodation costs are not included in our tour prices.",
  },
  {
    q: "Where should we stay?",
    a: "For tours of up to three days, you can stay in Banff, Canmore or Lake Louise. The four-day journey requires accommodation in Jasper after day three.",
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
    description: "Explore with passionate guides and no more than 12 guests. Choose one day or combine both adventures.",
    cta: "Explore Small-Group Tours",
    href: "/shared-tours",
    image: "/media/site/image-2025-11-04t210434-975.webp",
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
];

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
