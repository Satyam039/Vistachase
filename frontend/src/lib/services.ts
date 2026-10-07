// The five Vista Chase services, shared by the home hero (ServicesHero), the category pages
// (TourGallery) and the Experiences section. Reasons come from the live product pages' facts.
// Media is served by the backend (backend/media): a background clip where one fits, else a photo.

export type ServiceId = "shared" | "private" | "shuttles" | "multiday" | "tickets";

export interface Service {
  id: ServiceId;
  /** Tour category the service lists (tours API `category`). */
  category: "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY" | "TICKET";
  title: string;
  /** Short "why choose" headline. */
  tagline: string;
  reasons: string[];
  href: string;
  cta: string;
  video?: { src: string; srcHd?: string; poster: string };
  image: string;
  imageAlt: string;
}

export const SERVICES: Service[] = [
  {
    id: "shared",
    category: "SHARED",
    title: "Shared tours",
    tagline: "Why choose a shared tour? Small groups, big days out.",
    reasons: [
      "Groups of up to 12, never a crowded bus",
      "Doorstep pickup in Banff and Canmore",
      "Parks Canada entry fees included",
      "Local guides who know every lookout",
    ],
    href: "/shared-tours",
    cta: "See shared tours",
    video: {
      src: "/media/videos/lake-louise-summer.mp4",
      srcHd: "/media/videos/lake-louise-summer-1080.mp4",
      poster: "/media/videos/lake-louise-summer-poster.webp",
    },
    image: "/media/videos/lake-louise-summer-poster.webp",
    imageAlt: "Turquoise Lake Louise below Victoria Glacier",
  },
  {
    id: "private",
    category: "PRIVATE",
    title: "Private tours",
    tagline: "Why go private? Your vehicle, your guide, your pace.",
    reasons: [
      "A luxury SUV for up to 6 or an executive van for up to 13",
      "Choose your stops and how long you stay",
      "Pickup wherever you are staying",
      "Priced per vehicle, not per person",
    ],
    href: "/private-tours",
    cta: "See private tours",
    video: {
      src: "/media/videos/emerald-lake-canoes.mp4",
      poster: "/media/videos/emerald-lake-canoes-poster.webp",
    },
    image: "/media/videos/emerald-lake-canoes-poster.webp",
    imageAlt: "Red canoes at the Emerald Lake dock in Yoho National Park",
  },
  {
    id: "shuttles",
    category: "SHUTTLE",
    title: "Lake shuttles",
    tagline: "Why take our shuttle? Guaranteed access to Moraine Lake and Lake Louise.",
    reasons: [
      "Private vehicles can't drive to Moraine Lake; our shuttles can",
      "Sunrise and mid-day departures",
      "Pickups in Canmore and Banff",
      "Hours of free time at both lakes",
    ],
    href: "/shuttles",
    cta: "See shuttles",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    imageAlt: "Moraine Lake reflecting the Valley of the Ten Peaks",
  },
  {
    id: "multiday",
    category: "MULTIDAY",
    title: "Multi-day packages",
    tagline: "Why a multi-day package? The Rockies in 2–7 days, planned for you.",
    reasons: [
      "Banff, Yoho, Jasper, Kootenay and Waterton",
      "Airport transfers, no rental car needed",
      "A private vehicle and guide every day",
      "Built around your interests and pace",
    ],
    href: "/multi-day-tour-package-for-banff",
    cta: "Plan a multi-day trip",
    video: {
      src: "/media/videos/athabasca-falls.mp4",
      poster: "/media/videos/athabasca-falls-poster.webp",
    },
    image: "/media/videos/athabasca-falls-poster.webp",
    imageAlt: "Athabasca Falls pouring through its gorge in Jasper National Park",
  },
  {
    id: "tickets",
    category: "TICKET",
    title: "Banff activity tickets",
    tagline: "Why add tickets? The Rockies' classic experiences, timed around your day.",
    reasons: [
      "Banff Gondola and Upper Hot Springs",
      "Lake Minnewanka cruise",
      "Columbia Icefield Skywalk",
      "One request, timed around your tour",
    ],
    href: "/banff-activity-tickets",
    cta: "See activity tickets",
    video: {
      src: "/media/videos/vermilion-lakes.mp4",
      poster: "/media/videos/vermilion-lakes-poster.webp",
    },
    image: "/media/site/banff-gondola-hike.webp",
    imageAlt: "Hiker on Sulphur Mountain above Banff",
  },
];

export const serviceById = (id: ServiceId) => SERVICES.find((s) => s.id === id)!;
