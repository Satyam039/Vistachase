import type {
  DestinationDetail,
  DestinationSummary,
  ShuttleWithDepartures,
  TourWithAvailability,
} from "@/lib/api/types";

type CatalogFields =
  | "bokunExperienceId"
  | "bookingMode"
  | "priceUnit"
  | "facts"
  | "tabs"
  | "faqs"
  | "crossSells"
  | "vehicleOptions"
  | "metaTitle"
  | "metaDescription";

/** Fills the imported-catalog fields the hand-written fallback tours don't carry. */
function withCatalogDefaults(
  tour: Omit<TourWithAvailability, CatalogFields> & Partial<Pick<TourWithAvailability, CatalogFields>>
): TourWithAvailability {
  const perGroup = tour.category === "PRIVATE" || tour.category === "MULTIDAY";
  return {
    bokunExperienceId: null,
    bookingMode: "BOKUN",
    priceUnit: perGroup ? "GROUP" : "PERSON",
    facts: [],
    tabs: [],
    faqs: [],
    crossSells: [],
    vehicleOptions: perGroup
      ? [
          { id: "suv", label: "Luxury SUV", seats: 6 },
          { id: "van", label: "Executive van", seats: 13 },
        ]
      : [],
    metaTitle: null,
    metaDescription: null,
    ...tour,
  };
}

export const FALLBACK_TOURS: TourWithAvailability[] = ([
  {
    id: "banff-highlights-tour",
    slug: "banff-highlights-tour",
    title: "Lake Louise, Moraine Lake & Banff Highlights Tour",
    category: "SHARED",
    durationHours: 10,
    summary:
      "TripAdvisor #6 Best Experience in Canada. Guaranteed Moraine Lake access, small group (max 12), complimentary hot drinks, and local expert guide.",
    description:
      "Experience the Canadian Rockies in an intimate small-group setting. Bypass the 3:00 AM personal vehicle parking ban with certified commercial access directly to the Moraine Lake shoreline. Marvel at the Valley of the Ten Peaks, explore Lake Louise, Bow Falls, Castle Mountain, and Johnston Canyon.",
    inclusions: [
      "Guaranteed Moraine Lake & Lake Louise commercial corridor entry",
      "Door-to-door hotel pickup in Banff & Canmore",
      "Certified local mountain guide (interpretive specialist)",
      "Hot French roast coffee, cocoa, and bottled mountain water",
      "High-power spotting scopes for wildlife viewing",
    ],
    exclusions: ["National Park Discovery Pass", "Guide gratuities", "Meals & personal items"],
    highlights: [
      "Moraine Lake Valley of the Ten Peaks Rockpile View",
      "Lake Louise & Victoria Glacier Shoreline",
      "Bow Falls & Fairmont Banff Springs",
      "Suspended Catwalks at Johnston Canyon",
    ],
    whatToBring: [
      "Layered warm alpine clothing",
      "Sturdy walking or hiking shoes",
      "Smartphone or camera for photography",
      "Parks Canada Pass (or purchase at gate)",
    ],
    featuredImage:
      "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/690a1613098a903d97414ebd_Image%20-%202025-11-04T210434.975.png",
    galleryImages: [
      "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/661a357eb4520970ef37baae_Lake%20Moraine-min.jpg",
      "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/661f77d337ee36fafe108e42_vsc-2023-oct-22.jpg",
      "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/66187747e7a83d3e698eaef9_vsc-2023-oct-123.jpg",
    ],
    basePrice: 189,
    currency: "CAD",
    minGroupSize: 1,
    maxGroupSize: 12,
    isFeatured: true,
    rating: 4.9,
    reviewCount: 380,
    destination: {
      id: "dest-banff",
      slug: "banff-national-park",
      name: "Banff National Park",
    },
    departures: [
      {
        id: "dep-hl-01",
        date: "2026-10-15",
        departureTime: "08:30",
        returnTime: "18:30",
        capacityTotal: 12,
        capacityBooked: 4,
        capacityHeld: 0,
        seatsAvailable: 8,
        price: 189,
        currency: "CAD",
        status: "ACTIVE",
      },
      {
        id: "dep-hl-02",
        date: "2026-10-16",
        departureTime: "08:30",
        returnTime: "18:30",
        capacityTotal: 12,
        capacityBooked: 2,
        capacityHeld: 0,
        seatsAvailable: 10,
        price: 189,
        currency: "CAD",
        status: "ACTIVE",
      },
    ],
  },
  {
    id: "banff-private-tour",
    slug: "banff-private-tour",
    title: "Luxury Private SUV Tour: Banff & Lake Louise",
    category: "PRIVATE",
    durationHours: 11,
    summary:
      "Your day, handcrafted to your rhythm. Dedicated GMC Yukon XL / Suburban, dedicated local guide, and fully customizable Bow Valley itinerary.",
    description:
      "Designed for discerning families and private groups. Travel in climate-controlled luxury with heated leather seats, panoramic alpine glass, and personalized pacing. Stop whenever you wish for photographs, spend extra time at Moraine Lake, or take unhurried alpine walks without rigid tour schedules.",
    inclusions: [
      "Exclusive private use of luxury GMC Yukon XL / Suburban",
      "Dedicated local private guide and chauffeur",
      "Guaranteed Moraine Lake & Lake Louise access permits",
      "Flexible door-to-door hotel pickup anywhere in Banff/Canmore",
      "Complimentary hot beverages, chilled mountain water & light snacks",
    ],
    exclusions: ["National Park Discovery Pass", "Lunch at Fairmont (can be arranged)"],
    highlights: [
      "Bespoke Itinerary Handcrafted to Your Group",
      "Heated Leather Seats & Climate-Controlled SUV",
      "Sunrise or Daytime Departure Timing of Your Choice",
      "Direct Shoreline Commercial Access at Moraine Lake",
    ],
    whatToBring: [
      "Comfortable layered mountain attire",
      "Walking shoes or light hiking boots",
      "Camera for family portraits",
    ],
    featuredImage:
      "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/69108a62d2ab543e335612b6_dcb45221eefae27970a0c11f4f7fc0eb3edb65d1%20(1).jpg",
    galleryImages: [
      "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/661a357eb4520970ef37baae_Lake%20Moraine-min.jpg",
      "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/66187747e7a83d3e698eaef9_vsc-2023-oct-123.jpg",
    ],
    basePrice: 1250,
    currency: "CAD",
    minGroupSize: 1,
    maxGroupSize: 6,
    isFeatured: true,
    rating: 5.0,
    reviewCount: 215,
    destination: {
      id: "dest-banff",
      slug: "banff-national-park",
      name: "Banff National Park",
    },
    departures: [
      {
        id: "dep-pv-01",
        date: "2026-10-15",
        departureTime: "08:00",
        returnTime: "19:00",
        capacityTotal: 6,
        capacityBooked: 0,
        capacityHeld: 0,
        seatsAvailable: 6,
        price: 1250,
        currency: "CAD",
        status: "ACTIVE",
      },
    ],
  },
  {
    id: "icefields-jasper-private-tour",
    slug: "icefields-jasper-private-tour",
    title: "Private Columbia Icefield & Jasper Experience",
    category: "PRIVATE",
    durationHours: 11,
    summary:
      "A road through another world. Journey along the iconic Icefields Parkway, Peyto Lake, Bow Lake, and the Athabasca Glacier.",
    description:
      "Travel along what National Geographic rates among the most scenic drives on earth. Experience dramatic glacial valleys, thundering waterfalls, hanging ice formations, and tranquil morning viewpoints at Bow Lake and Peyto Lake.",
    inclusions: [
      "Private luxury GMC Yukon XL for up to 6 guests",
      "Dedicated mountain guide for the full 11-hour expedition",
      "Hotel pickup in Banff, Canmore, or Lake Louise",
      "Hot drinks, refreshments & glacier viewing stops",
    ],
    exclusions: ["Columbia Icefield Glacier Skywalk tickets (optional add-on)"],
    highlights: [
      "Peyto Lake Wolf-Shaped Panorama",
      "Bow Lake & Crowfoot Glacier",
      "Athabasca Glacier Terminal Moraine",
      "Weeping Wall & Sunwapta Pass",
    ],
    whatToBring: ["Warm jacket or windbreaker", "Sturdy footwear", "Sunglasses"],
    featuredImage:
      "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691010a937bd1626bd437647_Horse%20Background%20Image%20V3.png",
    galleryImages: [
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop",
    ],
    basePrice: 1450,
    currency: "CAD",
    minGroupSize: 1,
    maxGroupSize: 6,
    isFeatured: true,
    rating: 5.0,
    reviewCount: 165,
    destination: {
      id: "dest-icefields",
      slug: "icefields-parkway",
      name: "Icefields Parkway",
    },
    departures: [
      {
        id: "dep-ij-01",
        date: "2026-10-18",
        departureTime: "07:30",
        returnTime: "18:30",
        capacityTotal: 6,
        capacityBooked: 0,
        capacityHeld: 0,
        seatsAvailable: 6,
        price: 1450,
        currency: "CAD",
        status: "ACTIVE",
      },
    ],
  },
] satisfies Parameters<typeof withCatalogDefaults>[0][]).map(withCatalogDefaults);

export const FALLBACK_SHUTTLES: ShuttleWithDepartures[] = [
  {
    id: "route-sunrise-shuttle",
    slug: "moraine-lake-sunrise-shuttle",
    name: "Moraine Lake & Lake Louise Alpine Sunrise Shuttle",
    origin: "Banff / Canmore",
    destination: "Moraine Lake & Lake Louise",
    isReturn: true,
    description:
      "Skip the 3:00 AM public transit lottery. Guaranteed early morning commercial access with door-to-door hotel pickup in Banff and Canmore, arriving before first light strikes the Ten Peaks.",
    notes: "Complimentary French roast coffee and cocoa included.",
    departures: [
      {
        id: "dep-sh-01",
        date: "2026-10-15",
        departureTime: "05:00",
        returnTime: "11:00",
        capacityTotal: 14,
        capacityBooked: 6,
        capacityHeld: 0,
        seatsAvailable: 8,
        price: 89,
        currency: "CAD",
        status: "ACTIVE",
      },
      {
        id: "dep-sh-02",
        date: "2026-10-16",
        departureTime: "05:00",
        returnTime: "11:00",
        capacityTotal: 14,
        capacityBooked: 10,
        capacityHeld: 0,
        seatsAvailable: 4,
        price: 89,
        currency: "CAD",
        status: "ACTIVE",
      },
    ],
  },
  {
    id: "route-full-day-express",
    slug: "full-day-at-lake-louise-and-moraine-lake",
    name: "Full Day Express Shuttle: Lake Louise & Moraine Lake",
    origin: "Banff / Canmore",
    destination: "Lake Louise & Moraine Lake",
    isReturn: true,
    description:
      "Comfortable midday commercial shuttle connecting Banff and Canmore hotels to both Lake Louise and Moraine Lake with 2 guaranteed hours at each iconic shoreline.",
    notes: "Direct hotel pickup and drop-off included.",
    departures: [
      {
        id: "dep-sh-03",
        date: "2026-10-15",
        departureTime: "09:30",
        returnTime: "17:30",
        capacityTotal: 14,
        capacityBooked: 5,
        capacityHeld: 0,
        seatsAvailable: 9,
        price: 95,
        currency: "CAD",
        status: "ACTIVE",
      },
    ],
  },
];

export const FALLBACK_DESTINATIONS: DestinationSummary[] = [
  {
    id: "dest-banff",
    slug: "banff-national-park",
    name: "Banff National Park",
    province: "Alberta",
    region: "Canadian Rockies",
    description:
      "Canada's first national park, featuring dramatic limestone peaks, pristine glacial waters, Bow Falls, and the historic alpine town of Banff.",
    heroImage:
      "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1600&auto=format&fit=crop",
    isFeatured: true,
    metaTitle: "Banff National Park Tours & Shuttles | Vista Chase",
    metaDescription:
      "Experience Banff National Park with luxury private SUV tours, guaranteed lake shuttles, and local expert guides.",
    tours: [
      { id: "banff-highlights-tour", title: "Lake Louise, Moraine Lake & Banff Highlights Tour", slug: "banff-highlights-tour", basePrice: 189 },
      { id: "banff-private-tour", title: "Luxury Private SUV Tour: Banff & Lake Louise", slug: "banff-private-tour", basePrice: 1250 },
    ],
  },
  {
    id: "dest-lake-louise",
    slug: "lake-louise",
    name: "Lake Louise & Moraine Lake",
    province: "Alberta",
    region: "Canadian Rockies",
    description:
      "The crown jewels of the Canadian Rockies. Turquoise waters, Victoria Glacier, and the Valley of the Ten Peaks with guaranteed commercial corridor access.",
    heroImage:
      "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/661a357eb4520970ef37baae_Lake%20Moraine-min.jpg",
    isFeatured: true,
    metaTitle: "Moraine Lake & Lake Louise Shuttles | Vista Chase",
    metaDescription:
      "Guaranteed commercial shuttle access and private luxury tours to Moraine Lake and Lake Louise.",
    tours: [
      { id: "banff-highlights-tour", title: "Lake Louise, Moraine Lake & Banff Highlights Tour", slug: "banff-highlights-tour", basePrice: 189 },
      { id: "banff-private-tour", title: "Luxury Private SUV Tour: Banff & Lake Louise", slug: "banff-private-tour", basePrice: 1250 },
    ],
  },
  {
    id: "dest-yoho",
    slug: "yoho",
    name: "Yoho National Park",
    province: "British Columbia",
    region: "Canadian Rockies",
    description:
      "A dramatic landscape of towering waterfalls, Emerald Lake's tranquil jade waters, and ancient natural stone bridges.",
    heroImage:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop",
    isFeatured: true,
    metaTitle: "Yoho National Park Tours | Vista Chase",
    metaDescription: "Explore Emerald Lake, Takakkaw Falls, and Natural Bridge with Vista Chase.",
    tours: [
      { id: "banff-highlights-tour", title: "Lake Louise, Moraine Lake & Banff Highlights Tour", slug: "banff-highlights-tour", basePrice: 189 },
    ],
  },
  {
    id: "dest-icefields",
    slug: "icefields-parkway",
    name: "Icefields Parkway",
    province: "Alberta",
    region: "Canadian Rockies",
    description:
      "One of the world's most spectacular mountain highways, connecting Lake Louise to Jasper past ancient glaciers and emerald alpine lakes.",
    heroImage:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1600&auto=format&fit=crop",
    isFeatured: true,
    metaTitle: "Icefields Parkway Tours | Vista Chase",
    metaDescription: "Private expeditions to Peyto Lake, Bow Lake, and the Athabasca Glacier.",
    tours: [
      { id: "icefields-jasper-private-tour", title: "Private Columbia Icefield & Jasper Experience", slug: "icefields-jasper-private-tour", basePrice: 1450 },
    ],
  },
];
