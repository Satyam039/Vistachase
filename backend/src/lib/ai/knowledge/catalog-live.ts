/**
 * Live numbers for the concierge's product knowledgebase (website-catalog.ts): prices by season,
 * departure times and free seats, read from the same departures the website's calendars sell.
 * Nothing here is typed by hand, so a price or time change in the booking system reaches the
 * concierge on its next answer (cached for a few minutes).
 *
 * Also: recommendTours() (matches products to what the guest told the concierge) and tourCard()
 * (the clickable cards the chat shows).
 */

import prisma from "@/lib/db/prisma";
import { sellableInventoryWhere } from "@/modules/departures/inventory";
import { conciergeTours } from "@/modules/tours/product-map";
import { dateOnly, formatDateOnly, formatTimeOfDay, todayInMountainTime } from "@/lib/utils/time";
import { WEBSITE_CATALOG, catalogEntry, type Place, type ProductType, type Season, type WebsiteProduct } from "./website-catalog";

const CACHE_MS = 5 * 60_000;
const HORIZON_DAYS = 400;

export const seasonOf = (isoDate: string): Season => {
  const md = isoDate.slice(5, 10);
  return md >= "06-01" && md <= "10-10" ? "summer" : "winter";
};

interface DepartureRow {
  id: string;
  slug: string;
  date: string;
  time: string;
  price: number; // dollars
  seats: number;
}

export interface LiveProduct {
  slug: string;
  /** Live price range by season (dollars). */
  prices: Partial<Record<Season, { min: number; max: number }>>;
  priceUnit: "per guest" | "per vehicle";
  /** Departure times on sale, by season ("08:00"). */
  times: Partial<Record<Season, string[]>>;
  firstDate: string | null;
  lastDate: string | null;
  image: string | null;
}

let cache: { at: number; products: Map<string, LiveProduct>; departures: DepartureRow[] } | null = null;

/** Clears the cache (tests, or after staff change departures). */
export function resetLiveCatalog() {
  cache = null;
}

async function load() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const today = todayInMountainTime();
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + HORIZON_DAYS);
  const slugs = WEBSITE_CATALOG.filter((p) => p.bookIn === "chat").map((p) => p.slug);
  const tours = await prisma.tour.findMany({ where: { ...conciergeTours(), slug: { in: slugs } }, select: { id: true, slug: true, priceUnit: true, featuredImage: true } });
  const bySlug = new Map(tours.map((t) => [t.id, t]));
  const rows = await prisma.tourDeparture.findMany({
    where: { tourId: { in: tours.map((t) => t.id) }, status: "ACTIVE", date: { gte: dateOnly(today), lte: until }, ...sellableInventoryWhere },
    select: { id: true, tourId: true, date: true, departureTime: true, price: true, capacityTotal: true, capacityBooked: true, capacityHeld: true },
    orderBy: [{ date: "asc" }, { departureTime: "asc" }],
  });
  const departures: DepartureRow[] = rows.map((d) => ({
    id: d.id,
    slug: bySlug.get(d.tourId!)!.slug,
    date: formatDateOnly(d.date),
    time: formatTimeOfDay(d.departureTime),
    price: d.price / 100,
    seats: Math.max(0, d.capacityTotal - d.capacityBooked - d.capacityHeld),
  }));

  const products = new Map<string, LiveProduct>();
  for (const t of tours) {
    const own = departures.filter((d) => d.slug === t.slug);
    const prices: LiveProduct["prices"] = {};
    const times: LiveProduct["times"] = {};
    for (const d of own) {
      const s = seasonOf(d.date);
      const p = (prices[s] ??= { min: d.price, max: d.price });
      p.min = Math.min(p.min, d.price);
      p.max = Math.max(p.max, d.price);
      const list = (times[s] ??= []);
      if (!list.includes(d.time)) list.push(d.time);
    }
    for (const list of Object.values(times)) list?.sort();
    products.set(t.slug, {
      slug: t.slug,
      prices,
      priceUnit: t.priceUnit === "GROUP" ? "per vehicle" : "per guest",
      times,
      firstDate: own[0]?.date ?? null,
      lastDate: own.at(-1)?.date ?? null,
      image: t.featuredImage || null,
    });
  }
  cache = { at: Date.now(), products, departures };
  return cache;
}

export async function liveProduct(slug: string): Promise<LiveProduct | null> {
  return (await load()).products.get(slug) ?? null;
}

const money = (n: number) => `CAD $${n.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const range = (p: { min: number; max: number }) => (p.min === p.max ? money(p.min) : `${money(p.min)}–${money(p.max)}`);

/** The product's price as the guest should hear it, from live departures (or the package page). */
export function priceText(product: WebsiteProduct, live: LiveProduct | null): string {
  if (product.packagePrice) return product.packagePrice.text;
  if (!live || (!live.prices.summer && !live.prices.winter)) return "No dates on sale right now";
  const { summer, winter } = live.prices;
  if (summer && winter && summer.min === winter.min && summer.max === winter.max) return `${range(summer)} ${live.priceUnit}, all year`;
  return [summer && `${range(summer)} ${live.priceUnit} June 1–Oct 10`, winter && `${range(winter)} ${live.priceUnit} Oct 11–May 31`].filter(Boolean).join("; ");
}

export function timesText(live: LiveProduct | null): string | null {
  if (!live) return null;
  const all = [...new Set([...(live.times.summer ?? []), ...(live.times.winter ?? [])])].sort();
  if (!all.length) return null;
  return `Departure time${all.length > 1 ? "s" : ""} on sale: ${all.map(clock).join(", ")} (Mountain Time)`;
}

/** The catalog as knowledgebase text for the concierge's prompt: one block per product. */
export async function renderCatalogKnowledge(): Promise<string> {
  const { products } = await load();
  const blocks = WEBSITE_CATALOG.map((p) => {
    const live = products.get(p.slug) ?? null;
    const times = p.bookIn === "chat" ? timesText(live) : null;
    return [
      `### ${p.name} [slug: ${p.slug}] · ${p.type === "SHUTTLE" ? "Lake shuttle" : p.type === "SHARED" ? "Shared small-group" : "Private"} · ${p.days > 1 ? `${p.days} days` : p.duration}`,
      p.overview,
      `- Price: ${priceText(p, live)}`,
      times ? `- ${times}` : null,
      `- Season: ${p.season.text}`,
      `- Stops: ${p.stops.join("; ")}`,
      `- Pickup: ${p.pickup}`,
      `- Group: ${p.capacity}`,
      `- Included: ${p.included.join("; ")}`,
      `- Not included: ${p.notIncluded.join("; ")}`,
      ...(p.seasonNotes ?? []).map((n) => `- Note: ${n}`),
      `- Cancellation: ${p.cancellation}`,
      `- Book: ${p.bookIn === "chat" ? "in this chat (live departures)" : 'in this chat: get_tour_details shows the card, the guest taps "Choose dates and book" and picks a date for each day (multi-day package)'}; page ${p.page}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return `## Products on the live website (the source of truth for names, stops, inclusions, pickups and prices; prices and times are live)\n\n${blocks.join("\n\n")}`;
}

// ------------------------------------------------------------------ recommendations

export interface Preferences {
  date?: string;
  guests?: number;
  style?: "shared" | "private" | "shuttle" | "any";
  /** Budget per guest in CAD. */
  budgetPerGuest?: number;
  places?: string[];
  days?: number;
  premium?: boolean;
  interests?: string;
  /** How far after `date` a departure may be (default 7 days; a whole month when only the month is known). */
  windowDays?: number;
}

const PLACE_WORDS: Record<Place, RegExp> = {
  banff: /banff|minnewanka|johnston|two jack|gondola/i,
  "lake-louise": /lake louise|louise/i,
  "moraine-lake": /moraine/i,
  yoho: /yoho|emerald|natural bridge|takakkaw/i,
  "icefields-parkway": /icefield|parkway|peyto|bow lake|crowfoot/i,
  "columbia-icefield": /columbia|glacier|ice explorer|skywalk|athabasca/i,
  jasper: /jasper|maligne|spirit island/i,
  "abraham-lake": /abraham|ice bubble/i,
  "johnston-canyon": /johnston/i,
};

export interface TourCard {
  slug: string;
  name: string;
  type: ProductType;
  days: number;
  image: string;
  overview: string;
  duration: string;
  price: string;
  fromAmount: number | null;
  priceUnit: "per guest" | "per vehicle";
  page: string;
  bookIn: "chat" | "page";
  departures: { id: string; date: string; time: string; seats: number; price: number }[];
}

/** Next departures with room for the party, on or after the date (or from today). */
function departuresFor(all: DepartureRow[], slug: string, guests: number, from?: string, max = 4) {
  const start = from ?? todayInMountainTime();
  return all.filter((d) => d.slug === slug && d.date >= start && d.seats >= Math.max(1, guests)).slice(0, max);
}

export async function tourCard(product: WebsiteProduct, opts: { date?: string; guests?: number } = {}): Promise<TourCard> {
  const { products, departures } = await load();
  const live = products.get(product.slug) ?? null;
  const priceUnit = product.packagePrice?.unit ?? live?.priceUnit ?? "per guest";
  // A vehicle takes the whole party, so its departures need only one free vehicle.
  const seatsNeeded = priceUnit === "per vehicle" ? 1 : opts.guests ?? 1;
  const deps = product.bookIn === "chat" ? departuresFor(departures, product.slug, seatsNeeded, opts.date) : [];
  const season = opts.date ? seasonOf(opts.date) : null;
  const seasonal = season && live?.prices[season];
  // With a date, "from" is the cheapest of the departures shown for it; otherwise the season's or year's lowest.
  const fromAmount =
    product.packagePrice?.fromAmount ??
    (opts.date && deps.length ? Math.min(...deps.map((d) => d.price)) : seasonal ? seasonal.min : live ? Math.min(...Object.values(live.prices).map((p) => p!.min)) : null);
  return {
    slug: product.slug,
    name: product.name,
    type: product.type,
    days: product.days,
    image: product.image || live?.image || "/media/photos/moraine-lake-perfect-reflection.webp",
    overview: product.overview,
    duration: product.duration,
    price: priceText(product, live),
    fromAmount: Number.isFinite(fromAmount) ? fromAmount : null,
    priceUnit,
    page: product.page,
    bookIn: product.bookIn,
    departures: deps.map((d) => ({ id: d.id, date: d.date, time: d.time, seats: d.seats, price: d.price })),
  };
}

/**
 * The products that fit what the guest said, best first (at most `limit`). Only products that can
 * actually be booked for the date and party are returned: a single-day product needs a departure
 * with room on (or soon after) the date, a package must run in that month.
 */
export async function recommendTours(prefs: Preferences, limit = 3): Promise<{ cards: TourCard[]; reasonsLeftOut: string[] }> {
  const { departures } = await load();
  const guests = Math.max(1, Math.min(14, Math.round(prefs.guests ?? 1)));
  const wanted = (prefs.places ?? []).join(" ") + " " + (prefs.interests ?? "");
  const month = prefs.date ? Number(prefs.date.slice(5, 7)) : null;
  const left: string[] = [];
  const scored: { p: WebsiteProduct; score: number }[] = [];

  for (const p of WEBSITE_CATALOG) {
    if (prefs.style === "shared" && p.type !== "SHARED") continue;
    if (prefs.style === "private" && p.type !== "PRIVATE") continue;
    if (prefs.style === "shuttle" && p.type !== "SHUTTLE") continue;
    if (prefs.days && prefs.days >= 2 && p.days !== prefs.days && !(prefs.days > 4 && p.days === 4)) continue;
    if (prefs.days === 1 && p.days !== 1) continue;
    if (guests > p.maxGuests) {
      left.push(`${p.name}: up to ${p.maxGuests} guests`);
      continue;
    }
    if (month && p.season.months && !p.season.months.includes(month)) {
      left.push(`${p.name}: ${p.season.text}`);
      continue;
    }
    if (p.bookIn === "chat") {
      const seatsNeeded = p.type === "PRIVATE" ? 1 : guests;
      const soon = departuresFor(departures, p.slug, seatsNeeded, prefs.date, 1)[0];
      if (!soon) continue; // nothing on sale (e.g. off season)
      // A date was given: the departure must be close to it.
      if (prefs.date && soon.date > addDays(prefs.date, prefs.windowDays ?? 7)) {
        left.push(`${p.name}: no departures with room near ${prefs.date}`);
        continue;
      }
    }

    let score = 0;
    for (const [place, re] of Object.entries(PLACE_WORDS) as [Place, RegExp][]) {
      if (re.test(wanted)) score += p.places.includes(place) ? 3 : -2;
    }
    if (prefs.interests) for (const g of p.goodFor) if (new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(prefs.interests)) score += 2;
    if (prefs.premium === true) score += p.type === "PRIVATE" ? 3 : -1;
    if (prefs.premium === false) score += p.type === "PRIVATE" ? -3 : 1;
    if (!prefs.days && p.days > 1) score -= 2; // single days first unless they asked for more
    if (prefs.budgetPerGuest) {
      const card = await tourCard(p, { date: prefs.date, guests });
      const perGuest = card.fromAmount == null ? null : card.priceUnit === "per vehicle" ? card.fromAmount / guests : card.fromAmount;
      if (perGuest != null && perGuest > prefs.budgetPerGuest * 1.15) {
        left.push(`${p.name}: about CAD $${Math.round(perGuest)} per guest`);
        continue;
      }
      if (perGuest != null) score += 1;
    }
    if (p.slug === "banff-highlights-tour") score += 0.5; // best seller breaks ties
    scored.push({ p, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const cards = await Promise.all(scored.slice(0, limit).map(({ p }) => tourCard(p, { date: prefs.date, guests })));
  return { cards, reasonsLeftOut: left.slice(0, 6) };
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Everything the chat shows when a guest opens one tour. */
export async function tourDetail(slug: string, opts: { date?: string; guests?: number } = {}) {
  const p = catalogEntry(slug);
  if (!p) return null;
  const card = await tourCard(p, opts);
  const live = await liveProduct(slug);
  return {
    ...card,
    stops: p.stops,
    included: p.included,
    notIncluded: p.notIncluded,
    pickup: p.pickup,
    capacity: p.capacity,
    season: p.season.text,
    seasonNotes: p.seasonNotes ?? [],
    cancellation: p.cancellation,
    departureTimes: p.bookIn === "chat" ? timesText(live) : null,
  };
}
