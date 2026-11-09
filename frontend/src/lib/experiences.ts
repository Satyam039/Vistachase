// The experiences Vista Chase offers, as cards, in one place for the home "Experiences Travellers
// Love" rail and the search page (owner's doc, 2026-11-05: search must show only the products we
// offer, e.g. exactly the three shared tours, based on availability).
//
// Each tab shows the same cards as its own page (owner's doc, 2026-10-28): Small-Group Tours =
// the Shared Tours page's three options, Private Tours = the Private Tours page's first three,
// Multi-Day Journeys = its last three, Lake Shuttles = the seven departures from the shuttle
// timetable. Prices are live: each product's departures, the shared two-day package both days less
// 10%. The private packages show the doc's per-day price (lib/privateTours.ts).

import { CalendarDays, Clock, Users, type LucideIcon } from "lucide-react";
import { departureFits, fromPrice, nextDepartureFor } from "@/lib/tours";
import { BANFF_YOHO, ICEFIELD, TWO_DAY_PACKAGE, packagePrice } from "@/lib/sharedTours";
import { PRIVATE_OPTIONS, type PrivateTourOption } from "@/lib/privateTours";
import { LATE_SEASON_DEPARTURES, SHUTTLE_DEPARTURES, clock, clockRange } from "@/lib/shuttleSchedule";
import type { DepartureAvailability, TourWithAvailability } from "@/lib/api/types";

export type ExperienceCategory = "SHARED" | "PRIVATE" | "SHUTTLE" | "MULTIDAY" | "TICKET";

/** Shuttle products the timetable's departures are sold under (seed-departures.ts). */
export const SUNRISE_SHUTTLE = "sunrise-shuttle-to-moraine-lake-and-lake-louise";
export const DAY_SHUTTLE = "full-day-at-lake-louise-and-moraine-lake";
// Card photos (owner 2026-11-06): one photo per card, each showing that experience's own places.
// The owner's Drive folder supplied the Columbia Icefield and Maligne Lake photos (optimised
// *-card.webp copies); it has no Moraine Lake, Lake Louise or Yoho photos, so those cards use the
// site's own library.
const SHUTTLE_PHOTOS = [
  "/media/photos/lake-louise-sunrise.webp",
  "/media/photos/moraine-lake-reflection-morning.webp",
  "/media/photos/moraine-lake-rockpile-view.webp",
  "/media/photos/lake-louise-red-canoes.webp",
  "/media/photos/moraine-lake-perfect-reflection.webp",
  "/media/photos/moraine-lake-canoes.webp",
  "/media/photos/lake-louise-shoreline.webp",
];

/** Search and the home rail: party size up to this; more goes to the contact page (doc, 2026-11-05). */
export const MAX_SEARCH_GUESTS = 12;
/** Where a group larger than MAX_SEARCH_GUESTS is sent. */
export const groupEnquiryHref = (date?: string) => `/contact-us?${new URLSearchParams({ group: "1", ...(date ? { date } : {}) }).toString()}`;

/** 1 to 12 guests, then "12+ guests", which opens the group enquiry on the contact page. */
export function guestOptions() {
  return [
    ...Array.from({ length: MAX_SEARCH_GUESTS }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i === 0 ? "guest" : "guests"}` })),
    { value: String(MAX_SEARCH_GUESTS + 1), label: `${MAX_SEARCH_GUESTS}+ guests` },
  ];
}

export interface LinkCard {
  key: string;
  href: string;
  external?: boolean;
  image: string;
  badge: string;
  eyebrow: string;
  title: string;
  facts: { icon: LucideIcon; text: string }[];
  note?: string;
  price: number;
  /** "per guest", "per vehicle"... (the price itself reads "CAD $189") */
  unit: string;
  /** Shown instead of a price when there is none. */
  noPrice: string;
}

interface CardBase {
  category: ExperienceCategory;
  /** Lower-case text the search keyword is matched against. */
  text: string;
  /** Whether it runs for this party (and on this date, when one is given). */
  fits: (seats: number, date: string) => boolean;
}

export type ExperienceCard = CardBase &
  ({ kind: "tour"; key: string; tour: TourWithAvailability; title?: string; image?: string } | ({ kind: "link" } & LinkCard));

export type ExperienceTabs = Record<"ALL" | ExperienceCategory, ExperienceCard[]>;

const DAY_MS = 86_400_000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
/** June 1 to October 10, when the three- and four-day journeys run. */
const inSummer = (date: string) => date.slice(5) >= "06-01" && date.slice(5) <= "10-10";

const tourText = (t: TourWithAvailability) => `${t.title} ${t.summary} ${t.destination?.name ?? ""} ${(t.highlights ?? []).join(" ")}`;
const linkText = (c: LinkCard) => `${c.title} ${c.eyebrow} ${c.badge} ${c.facts.map((f) => f.text).join(" ")} ${c.note ?? ""}`;

/** A tour fits when, on the date (or on any date), it has a departure with room for the party. */
function tourFits(tour: TourWithAvailability | undefined, seats: number, date: string) {
  if (!tour) return false;
  if (!date && tour.departures.length === 0) return true; // dates on request
  return Boolean(nextDepartureFor(tour, seats, date || undefined));
}

/** The offered experiences by category, built from the live catalog. */
export function buildExperienceTabs(tours: TourWithAvailability[]): ExperienceTabs {
  const bySlug = (slug?: string) => (slug ? tours.find((t) => t.slug === slug) : undefined);
  const price = (slug: string) => {
    const tour = bySlug(slug);
    return tour ? fromPrice(tour) : 0;
  };
  const tourCard = (category: ExperienceCategory, slug: string | undefined, title?: string, image?: string): ExperienceCard[] => {
    const tour = bySlug(slug);
    if (!tour) return [];
    const typeLabel = category === "SHARED" ? "SHARED TOUR" : category === "PRIVATE" ? "PRIVATE TOUR" : category === "SHUTTLE" ? "SHUTTLE" : "TOUR";
    const raw = title ?? tour.title;
    const formattedTitle = raw.includes("–") ? raw : `${raw.toUpperCase()} – ${typeLabel}`;
    return [{ kind: "tour", key: tour.slug, tour, title: formattedTitle, image, category, text: `${formattedTitle} ${tourText(tour)}`.toLowerCase(), fits: (s, d) => tourFits(tour, s, d) }];
  };
  const linkCard = (category: ExperienceCategory, card: LinkCard, fits: CardBase["fits"]): ExperienceCard => ({
    kind: "link",
    ...card,
    category,
    text: linkText(card).toLowerCase(),
    fits,
  });

  const banffYoho = bySlug(BANFF_YOHO.slug);
  const icefield = bySlug(ICEFIELD.slug);
  const sharedPackage = packagePrice(price(BANFF_YOHO.slug), price(ICEFIELD.slug));
  const shared: ExperienceCard[] = [
    ...tourCard("SHARED", BANFF_YOHO.slug, "BANFF & YOHO DISCOVERY – SHARED TOUR", BANFF_YOHO.image),
    ...tourCard("SHARED", ICEFIELD.slug, "COLUMBIA ICEFIELD ADVENTURE – SHARED TOUR", ICEFIELD.image),
    linkCard(
      "SHARED",
      {
        key: "two-day-shared",
        href: TWO_DAY_PACKAGE.href,
        // Peyto Lake is on both days' routes.
        image: "/media/photos/peyto-lake.webp",
        badge: TWO_DAY_PACKAGE.saving,
        eyebrow: "Banff, Yoho & Icefields Parkway",
        title: "TWO-DAY ROCKIES EXPLORER – SHARED TOUR",
        facts: [
          { icon: Clock, text: TWO_DAY_PACKAGE.duration },
          { icon: Users, text: "Max 12 guests" },
        ],
        note: "Accommodation not included",
        price: sharedPackage.price,
        unit: "per guest",
        noPrice: "Price on request",
      },
      // Day 1 Banff & Yoho on the date, day 2 the Icefield within the following week.
      (seats, date) =>
        date
          ? tourFits(banffYoho, seats, date) && [1, 2, 3, 4, 5, 6, 7].some((n) => tourFits(icefield, seats, addDays(date, n)))
          : tourFits(banffYoho, seats, "") && tourFits(icefield, seats, ""),
    ),
  ];

  const privateCard = (category: ExperienceCategory, opt: PrivateTourOption): ExperienceCard => {
    const typeLabel = opt.isCustomPartner ? "BY BANFF ELITE" : "PRIVATE TOUR";
    const formattedTitle = opt.title.includes("–") ? opt.title : `${opt.title.toUpperCase()} – ${typeLabel}`;
    const cardImage = opt.image;

    if (opt.slug && bySlug(opt.slug)) return tourCard(category, opt.slug, formattedTitle, cardImage)[0];
    const privateDays = PRIVATE_OPTIONS.flatMap((o) => (o.slug && bySlug(o.slug) ? [bySlug(o.slug)!] : []));
    const fits: CardBase["fits"] = opt.isCustomPartner
      ? (seats) => seats <= 13
      : opt.id === "two-day-rockies-private"
        ? (seats, date) => privateDays.some((t) => tourFits(t, seats, date))
        : (seats, date) => seats <= 13 && (!date || inSummer(date)); // three- and four-day: summer only
    return linkCard(
      category,
      {
        key: opt.id,
        href: opt.buttonHref,
        external: opt.isCustomPartner,
        image: cardImage,
        badge: opt.isCustomPartner ? "By Banff Elite" : "Private tour",
        eyebrow: opt.suggestedStay,
        title: formattedTitle,
        facts: [
          { icon: Clock, text: opt.duration },
          { icon: Users, text: "Private, up to 13 guests" },
        ],
        note: opt.isCustomPartner ? opt.activities : undefined,
        price: opt.priceFrom,
        unit: "per vehicle",
        noPrice: opt.isCustomPartner ? "Personalised quote" : "Price on request",
      },
      fits,
    );
  };
  const privateTours = PRIVATE_OPTIONS.slice(0, 3).map((o) => privateCard("PRIVATE", o));
  const multiDay = PRIVATE_OPTIONS.slice(-3).map((o) => privateCard("MULTIDAY", o));

  const shuttles: ExperienceCard[] = SHUTTLE_DEPARTURES.map((d, i) => {
    const product = bySlug(d.number <= 2 ? SUNRISE_SHUTTLE : DAY_SHUTTLE);
    const time = d.pickup.banff ?? "";
    return linkCard(
      "SHUTTLE",
      {
        key: `shuttle-${d.number}`,
        href: "/shuttles#departures",
        image: SHUTTLE_PHOTOS[i % SHUTTLE_PHOTOS.length],
        badge: d.number <= 2 ? "Sunrise shuttle" : "Day shuttle",
        eyebrow: "Moraine Lake & Lake Louise",
        title: `DEPARTURE ${d.number}: ${d.name.toUpperCase()} – SHUTTLE`,
        facts: [
          { icon: Clock, text: `Banff ${clock(d.pickup.banff!)} · Canmore ${clock(d.pickup.canmore!)}` },
          { icon: CalendarDays, text: LATE_SEASON_DEPARTURES.includes(d.number) ? "June–September" : "June–July" },
        ],
        note: `Moraine Lake ${clockRange(d.moraine)} · Lake Louise ${clockRange(d.louise)}`,
        price: price(d.number <= 2 ? SUNRISE_SHUTTLE : DAY_SHUTTLE),
        unit: "per guest",
        noPrice: "Price on request",
      },
      // This departure's own time on the date (or on any date).
      (seats, date) =>
        Boolean(product?.departures.some((dep) => dep.departureTime.slice(0, 5) === time && (!date || dep.date === date) && departureFits(product, dep, seats))),
    );
  });

  const tickets: ExperienceCard[] = tours.filter((t) => t.category === "TICKET").flatMap((t) => tourCard("TICKET", t.slug));

  const shuttleProducts: ExperienceCard[] = [SUNRISE_SHUTTLE, DAY_SHUTTLE].flatMap((slug) => tourCard("SHUTTLE", slug));

  return {
    ALL: [...shared, ...privateTours, ...multiDay, ...shuttleProducts],
    SHARED: shared,
    PRIVATE: privateTours,
    SHUTTLE: shuttles,
    MULTIDAY: multiDay,
    TICKET: tickets,
  };
}

/**
 * Tours trimmed for card lists, so a year of dates (seed-departures.ts) stays small in the page:
 * each departure keeps only what cards, prices and availability read. With `days`, only the
 * departures in the next `days` days are kept (or a tour's first 30, e.g. summer shuttles in
 * winter), which is enough for "from" prices; the first departure with seats after the window is
 * kept too, so a card never says "no dates" when there is one later. The search keeps every date.
 */
export function toursForCards(tours: TourWithAvailability[], days?: number): TourWithAvailability[] {
  const until = days ? new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10) : null;
  return tours.map((tour) => {
    const all = Array.isArray(tour.departures) ? tour.departures : [];
    const inWindow = until ? all.filter((d) => d.date <= until) : all;
    let kept = until && inWindow.length === 0 ? all.slice(0, 30) : inWindow;
    if (until && !kept.some((d) => d.seatsAvailable > 0)) {
      const later = all.find((d) => d.date > until && d.seatsAvailable > 0);
      if (later) kept = [...kept, later];
    }
    return {
      ...tour,
      departures: kept.map(slimDeparture),
    };
  });
}

/**
 * A departure with only what cards, the tour page's calendar and its price panel read: date, time,
 * seats and prices. Booking checks every departure again on the server, so nothing here decides a
 * sale; dropping the bookkeeping fields (booked, held, status, source) roughly halves the page.
 */
export function slimDeparture(d: DepartureAvailability): DepartureAvailability {
  return {
    id: d.id,
    date: d.date,
    departureTime: d.departureTime,
    capacityTotal: d.capacityTotal,
    seatsAvailable: d.seatsAvailable,
    price: d.price,
    childPrice: d.childPrice,
    infantPrice: d.infantPrice,
  } as DepartureAvailability;
}

/**
 * Tours for pages that only draw TourCards (destination pages, "You might also like"): the card
 * trim above, minus the long text and media lists a card never reads, so the page doesn't ship
 * every tour's full description, itinerary tabs and FAQs to the browser.
 */
export function toursForTourCards(tours: TourWithAvailability[], days = 60): TourWithAvailability[] {
  return toursForCards(tours, days).map((tour) => ({
    ...tour,
    description: "",
    exclusions: [],
    whatToBring: [],
    galleryImages: [],
    videos: [],
    tabs: [],
    faqs: [],
  }));
}
