// The concierge when no AI model is configured (ANTHROPIC_API_KEY unset).
//
// It answers only from the booking system's own data (tours and prices from the catalog,
// departures with free seats, pickup stops, a guest's booking after reference + email) and from
// the published policies, and says plainly when it can't answer. Each reply is built for the
// question asked, and follow-ups ("what about tomorrow?", "how much is it?") reuse the tour and
// topic from earlier in the chat. It replaces the old scripted demo, which repeated canned
// replies and made up prices, departures and vehicle locations.
//
// It writes in English only: other languages need the Claude agent (concierge.agent.ts).

import { DOC_TOUR_SLUGS, DOC_TOUR_SUMMARY, WEBSITE_NAMES } from "./concierge.catalog";
import prisma from "@/lib/db/prisma";
import { CARD_NUMBER, runConciergeTool } from "@/lib/ai/concierge.agent";
import { conciergeLanguage } from "@/lib/ai/languages";
import type { ChatMessage, ConciergeResponse, SessionState } from "@/lib/ai/ai.provider";
import type { ToolExecutionContext } from "@/lib/ai/ai.tools";
import { todayInMountainTime } from "@/lib/utils/time";
import { conciergeTours } from "@/modules/tours/product-map";
import { CONTACT, knowledgeAnswer } from "@/lib/ai/concierge.knowledge";
import { WEBSITE_CATALOG } from "@/lib/ai/knowledge/website-catalog";
import type { Preferences } from "@/lib/ai/knowledge/catalog-live";

type Prefs = Preferences & { dateLabel?: string };

type Topic = "price" | "dates" | "details" | "pickup" | "lookup" | "track" | "banff_elite";

export interface BanffEliteEnquiryState {
  name?: string;
  email?: string;
  phone?: string;
  guests?: string | number;
  travelDates?: string;
  tourDays?: string | number;
  placesOfInterest?: string;
  preferredVehicle?: string;
  paceAndRequests?: string;
  step?: "intro" | "details" | "confirm" | "submitted";
}

type State = SessionState & {
  topic?: Topic;
  englishNotice?: boolean;
  consult?: Prefs & { asked?: "date" | "guests" | "style" | "days" };
  trip?: { date?: string; guests?: number };
  banffElite?: BanffEliteEnquiryState;
};
type Reply = { message: string; data?: Record<string, unknown>; checkoutUrl?: string; hasSafetyRefusal?: boolean };

const REFERENCE = /\bVC-\d{4}-[A-Z0-9]{4,}\b/i;
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i;

const money = (cents: number, currency = "CAD") => `${currency} $${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

// ---------------------------------------------------------------------------
// Understanding the question
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A date the guest mentioned, as YYYY-MM-DD in Alberta time; months without a year mean the next one. */
export function mentionedDate(text: string, today = todayInMountainTime()): string | null {
  const lower = text.toLowerCase();
  const shift = (days: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  if (/day after tomorrow/.test(lower)) return shift(2);
  if (/\btomorrow\b/.test(lower)) return shift(1);
  if (/\btoday\b|\btonight\b/.test(lower)) return today;
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const m =
    lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/) ??
    lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (!m) return null;
  const [mon, day] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
  const month = MONTHS.indexOf(mon) + 1;
  if (Number(day) < 1 || Number(day) > 31) return null;
  let year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (candidate < today) year += 1;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

type CatalogTour = { slug: string; title: string; category: string; basePrice: number; currency: string; priceUnit: string; durationHours: number; summary: string; bookingMode: string; aka?: string };

const CATEGORY_WORDS: [RegExp, string][] = [
  [/\bprivate\b|\bsuv\b/, "PRIVATE"],
  [/\bshared\b|\bgroup tour\b|\bsmall[- ]group\b/, "SHARED"],
  [/\bshuttles?\b/, "SHUTTLE"],
  [/\bmulti[- ]?day\b|\b\d[- ]day\b|\bpackage\b/, "MULTIDAY"],
  [/\btickets?\b|\bgondola\b|\bcruise\b|\bhot springs?\b|\bskywalk\b/, "TICKET"],
];

// "Banff" and "Canmore" are left out: nearly every tour mentions them.
const PLACE_WORDS = ["moraine", "louise", "jasper", "icefield", "yoho", "sunrise", "sunset", "minnewanka", "johnston", "peyto", "emerald", "gondola", "skywalk", "hot springs", "wildlife", "cruise"];

/** The catalog tour the guest means, scored on category and place words; null when unclear. */
function matchTour(text: string, tours: CatalogTour[]): CatalogTour | null {
  const lower = text.toLowerCase();
  const category = CATEGORY_WORDS.find(([re]) => re.test(lower))?.[1];
  const places = PLACE_WORDS.filter((w) => lower.includes(w));
  if (!category && places.length === 0) return null;
  let best: CatalogTour | null = null;
  let bestScore = 0;
  for (const t of tours) {
    const hay = `${t.title} ${t.aka ?? ""} ${t.slug} ${t.summary}`.toLowerCase();
    let score = places.filter((w) => hay.includes(w)).length * 2;
    if (category) score += t.category === category ? 3 : -3;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/** A tour's name as the website shows it. */
export { websiteName } from "./concierge.catalog";

async function catalog(): Promise<CatalogTour[]> {
  const tours = await prisma.tour.findMany({
    where: conciergeTours(),
    select: { slug: true, title: true, category: true, basePrice: true, currency: true, priceUnit: true, durationHours: true, summary: true, bookingMode: true },
    orderBy: [{ sortOrder: "asc" }, { basePrice: "asc" }],
  });
  // The catalog title is kept (aka) so guests can still name a tour either way.
  // Doc tours get the website's name and summary (their database text is the old Webflow copy).
  return tours.map((t) =>
    WEBSITE_NAMES[t.slug] ? { ...t, title: WEBSITE_NAMES[t.slug], aka: t.title, summary: DOC_TOUR_SUMMARY[t.slug] ?? t.summary } : t,
  );
}

const priceLine = (t: CatalogTour) =>
  t.basePrice > 0 ? `from ${money(t.basePrice, t.currency)} ${t.priceUnit === "GROUP" ? "per vehicle" : "per guest"}` : "price on request";

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

/** The first sentence of a description, without sales filler ("Book now."), at most ~200 characters. */
export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? clean;
  return sentence.length > 200 ? `${sentence.slice(0, 197).replace(/\s+\S*$/, "")}…` : sentence;
}

/** A short answer about one tour: price, length, one line on what it is, a few inclusions, the page link. */
async function tourDetails(tour: CatalogTour, ctx: ToolExecutionContext): Promise<Reply> {
  const { result } = await runConciergeTool("get_tour_details", { slug: tour.slug }, ctx);
  const d = result as { summary?: string; inclusions?: string[] } | null;
  const lines = [`${tour.title}: ${priceLine(tour)}, about ${tour.durationHours} hours.`];
  const about = firstSentence(tour.summary || d?.summary || "");
  if (about) lines.push(about);
  const included = DOC_TOUR_SLUGS.has(tour.slug) ? [] : (d?.inclusions ?? []).filter((i) => i.length <= 80).slice(0, 4);
  if (included.length) lines.push(`Includes: ${included.join(", ")}.`);
  lines.push(`Full details: /${tour.slug}`);
  lines.push(
    tour.bookingMode === "ENQUIRY"
      ? "This one is arranged on request: use the Request button on the tour page or /contact-us."
      : "Want me to check dates? Tell me a day.",
  );
  return { message: lines.join("\n"), data: { type: "tour", tour: { slug: tour.slug, title: tour.title, category: tour.category, durationHours: tour.durationHours, basePrice: tour.basePrice / 100, currency: tour.currency, summary: tour.summary } } };
}

/** "Tell me about your shuttles": every product of that kind in one short list. */
function kindOverview(category: string, tours: CatalogTour[]): Reply | null {
  const list = tours.filter((t) => t.category === category);
  if (list.length < 2) return null;
  const name = { SHARED: "shared tours", PRIVATE: "private tours", SHUTTLE: "lake shuttles", MULTIDAY: "multi-day journeys", TICKET: "activity tickets" }[category] ?? "options";
  return {
    message: `Our ${name}:\n${list.slice(0, 8).map((t) => `• ${t.title}: ${priceLine(t)}, about ${t.durationHours} hours`).join("\n")}\n\nAsk about one of them, or tell me a date to check seats.`,
  };
}

async function availability(date: string | null, tour: CatalogTour | null, ctx: ToolExecutionContext): Promise<Reply> {
  const out = date
    ? await runConciergeTool("check_availability", { date, tourSlug: tour?.slug }, ctx)
    : await runConciergeTool("get_available_dates", { tourSlug: tour?.slug }, ctx);
  const rows = Array.isArray(out.result) ? (out.result as { title?: string; date: string; departureTime: string; price: number; currency: string; availableSeats: number }[]) : [];
  const what = tour ? tour.title : "our tours and shuttles";
  if (rows.length === 0) {
    if (tour?.bookingMode === "ENQUIRY") return { message: `${tour.title} is arranged on request, so there's no online calendar. Use the Request button on the tour page or /contact-us and the team will confirm a date.` };
    return {
      message: date
        ? `I can't find free seats for ${what} on ${date}. Ask me for the next available dates, or try another day.`
        : `I can't find upcoming departures with free seats for ${what} right now. Our team can check other options: ${CONTACT}.`,
    };
  }
  const list = rows.slice(0, 6).map((r) => `• ${r.date} at ${r.departureTime}: ${r.title ?? what}, ${r.currency} $${r.price} per seat, ${r.availableSeats} seats left`);
  return {
    message: `${date ? `Departures with free seats on ${date}` : `Next departures with free seats for ${what}`}:\n${list.join("\n")}\n\nTap "Book" on one to book it here in the chat.`,
    data: out.card?.data,
  };
}

async function pickups(text: string, ctx: ToolExecutionContext): Promise<Reply> {
  const out = await runConciergeTool("find_pickup", { query: text }, ctx);
  const stops = Array.isArray(out.result) ? (out.result as { name: string; town: string; address: string }[]) : [];
  const total = await prisma.shuttleStop.count({ where: { isActive: true } });
  if (stops.length === 0) {
    return { message: `I couldn't find that hotel in our pickup list. We pick up at ${total} hotels and stops in Banff, Canmore and Lake Louise: see /pickup-finder, or tell me your hotel's name. If it isn't listed, add it at checkout and the team will confirm.` };
  }
  return {
    message: `Pickup stops that match:\n${stops.map((s) => `• ${s.name}, ${s.town}: ${s.address}`).join("\n")}\n\nYour pickup time is on your voucher once you book. All ${total} stops are at /pickup-finder.`,
    data: out.card?.data,
  };
}

async function booking(name: "lookup_booking" | "track_vehicle", reference: string, email: string, ctx: ToolExecutionContext): Promise<Reply> {
  const out = await runConciergeTool(name, { bookingReference: reference, customerEmail: email }, ctx);
  const r = out.result as Record<string, unknown>;
  if (r?.error) return { message: `${r.error} Check the reference and the email you booked with, or ${CONTACT}.` };
  if (name === "track_vehicle") {
    if (r.message) return { message: String(r.message) };
    return { message: `${r.statusDescription ?? r.status}${r.estimatedArrivalMinutes != null ? `. Estimated arrival in about ${r.estimatedArrivalMinutes} minutes` : ""}.`, data: out.card?.data };
  }
  const status = String(r.status).replace(/_/g, " ").toLowerCase();
  const lines = [
    `Booking ${r.bookingReference}: ${r.tour} on ${r.date}${r.departureTime ? ` at ${r.departureTime}` : ""}.`,
    `Status: ${status}.${r.status === "CONFIRMED" ? "" : " It isn't confirmed yet."}`,
    r.pickup ? `Pickup: ${r.pickup}${r.pickupTime ? ` at ${r.pickupTime}` : ""}.` : null,
    `Guests: ${r.guests}.`,
    r.status === "CONFIRMED" ? `Voucher: ${r.voucherUrl}` : null,
  ].filter(Boolean);
  return { message: lines.join("\n"), data: out.card?.data };
}


// ---------------------------------------------------------------------------
// Helping a guest choose (owner, 12 November 2026): ask what matters, one question at a time,
// then show only tours that fit, as cards.
// ---------------------------------------------------------------------------

const FULL_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** What the guest said about their trip in this message (only what's there). */
export function preferencesIn(text: string, asked?: string, today = todayInMountainTime()): Prefs {
  const lower = text.toLowerCase();
  const out: Prefs = {};
  const date = mentionedDate(text, today);
  if (date) {
    out.date = date;
    out.dateLabel = date;
  } else {
    const m = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
    // "may" alone is too often the verb: only as a month after "in"/"of" or with a year.
    if (m && (m[1] !== "may" || /\b(in|of|during|early|late|mid)\s+may\b|\bmay\s+20\d\d\b/.test(lower))) {
      const month = MONTHS.indexOf(m[1]) + 1;
      let year = Number(text.match(/\b(20\d\d)\b/)?.[1] ?? today.slice(0, 4));
      const thisMonth = Number(today.slice(5, 7));
      if (!text.match(/\b20\d\d\b/) && month < thisMonth) year += 1;
      const first = `${year}-${String(month).padStart(2, "0")}-01`;
      out.date = first < today ? today : first;
      out.windowDays = 31;
      out.dateLabel = `${FULL_MONTHS[month - 1][0].toUpperCase()}${FULL_MONTHS[month - 1].slice(1)} ${year}`;
    }
  }
  const n = lower.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(people|persons?|guests?|adults?|pax|of us|travell?ers|friends|kids|children)\b/) ?? lower.match(/\bfamily of (\d{1,2}|three|four|five|six)\b/) ?? lower.match(/\bgroup of (\d{1,2})\b/);
  if (n) out.guests = Number(n[1]) || NUMBER_WORDS[n[1]];
  else if (/\b(couple|two of us|me and my (wife|husband|partner|girlfriend|boyfriend))\b/.test(lower)) out.guests = 2;
  else if (/\b(solo|just me|alone|myself|1 person)\b/.test(lower)) out.guests = 1;
  else if (asked === "guests" && /^\s*\d{1,2}\s*\+?\s*$/.test(text)) out.guests = Number(text.trim().replace("+", ""));
  if (/\bprivate\b|\bour own\b|\bjust us\b/.test(lower)) out.style = "private";
  else if (/\bshared\b|\bsmall[- ]group\b|\bgroup tour\b/.test(lower)) out.style = "shared";
  else if (/\bshuttles?\b/.test(lower)) out.style = "shuttle";
  else if (asked === "style" && /\b(any|either|not sure|all|show me|whatever|both|don'?t know)\b/.test(lower)) out.style = "any";
  const d = lower.match(/\b(\d|two|three|four)[- ]days?\b/);
  if (d) out.days = Number(d[1]) || NUMBER_WORDS[d[1]];
  else if (/\b(day trip|one day|single day|a day)\b/.test(lower)) out.days = 1;
  // "Not sure" to the one-day-or-more question: any length (0 = no preference).
  else if (asked === "days" && /\b(not sure|either|any|no preference|don'?t mind|whatever|both)\b/.test(lower)) out.days = 0;
  const places = ["moraine", "lake louise", "jasper", "maligne", "icefield", "glacier", "yoho", "emerald", "peyto", "johnston", "abraham", "sunrise", "banff"].filter((w) => lower.includes(w));
  if (places.length) out.places = places;
  if (/\b(luxury|premium|vip|exclusive)\b/.test(lower)) out.premium = true;
  else if (/\b(cheap\w*|budget|economical|affordable|low cost|lowest)\b/.test(lower)) out.premium = false;
  const budget = lower.match(/\$\s?(\d{2,5})|\b(\d{2,5})\s*(?:cad|dollars|\$)/);
  if (budget && /budget|per (person|guest)|each|under|max|up to/.test(lower)) out.budgetPerGuest = Number(budget[1] ?? budget[2]);
  const interests = ["sunrise", "photography", "winter", "snow", "hiking", "wildlife", "families", "kids", "glacier", "lakes"].filter((w) => lower.includes(w));
  if (interests.length) out.interests = interests.join(" ");
  return out;
}

const CONSULT_START = /\b(recommend\w*|suggest\w*|which (tour|one|trip)|what (should|can|could) (we|i) (do|book|see)|help (me |us )?(choose|pick|plan|decide)|plan(ning)? (a|my|our) (trip|visit|day)|best (tour|option|trip)|options|things to do|what do you (offer|have)|what tours|which tours|looking for a tour|want (a|to book a) tour)\b/;

const STYLE_CHOICES = ["Shared small-group tour", "Private tour", "Lake shuttle", "Show me all"];

/** The next question, or the recommendation once date, guests and style are known. */
async function consult(prefs: State["consult"] & object, state: State, ctx: ToolExecutionContext): Promise<Reply> {
  if (!prefs.date) {
    prefs.asked = "date";
    return { message: "Happy to help you choose. When are you travelling? A date or just the month is fine." };
  }
  if (!prefs.guests) {
    prefs.asked = "guests";
    return { message: "How many people are travelling, including children?", data: { type: "choices", options: ["1 guest", "2 guests", "4 guests", "6 guests"] } };
  }
  if (!prefs.style) {
    prefs.asked = "style";
    return {
      message: "Would you like a shared small-group tour, a private tour with your own guide, or a lake shuttle to Moraine Lake and Lake Louise?",
      data: { type: "choices", options: STYLE_CHOICES },
    };
  }
  // One day or more: asked in the step-by-step chat (not when the guest said it all at once), and
  // only where a multi-day package fits the style and season.
  if (prefs.days === undefined && prefs.asked === "style" && prefs.style !== "shuttle") {
    const lengths = multiDayChoices(prefs.style, prefs.date);
    if (lengths.length) {
      prefs.asked = "days";
      return {
        message: "Would you like a single day tour, or a multi-day trip with a date for each day?",
        data: { type: "choices", options: ["One day", ...lengths, "Not sure"] },
      };
    }
  }
  const out = await runConciergeTool("recommend_tours", { ...prefs, style: prefs.style, days: prefs.days || undefined }, ctx);
  const result = out.result as { shownToGuestAsCards?: { name: string }[]; reasonsLeftOut?: string[] };
  state.consult = undefined;
  state.trip = { date: prefs.date, guests: prefs.guests }; // kept for the tour the guest opens next
  const when = prefs.dateLabel ?? prefs.date;
  if (!result.shownToGuestAsCards?.length) {
    const why = result.reasonsLeftOut?.slice(0, 2).join("; ");
    return { message: `Nothing fits all of that for ${when}${why ? ` (${why})` : ""}. Try another date, or a different kind of tour, and I'll check again.` };
  }
  return {
    message: `${result.shownToGuestAsCards.length === 1 ? "This one fits" : "These fit"} ${when} for ${prefs.guests} ${prefs.guests === 1 ? "guest" : "guests"}. Tap a tour to see its details and dates.`,
    data: out.card?.data,
  };
}

/** Multi-day lengths on sale for the style and date: the shared two-day package all year; the private
 *  two-day package all year and the three- and four-day journeys in summer (catalog seasons). */
function multiDayChoices(style: Prefs["style"], date?: string): string[] {
  const month = date ? Number(date.slice(5, 7)) : undefined;
  const lengths = new Set<number>();
  for (const p of WEBSITE_CATALOG) {
    if (p.days < 2) continue;
    if (style === "shared" && p.type !== "SHARED") continue;
    if (style === "private" && p.type !== "PRIVATE") continue;
    if (month && p.season.months && !p.season.months.includes(month)) continue;
    lengths.add(p.days);
  }
  return [...lengths].sort().map((n) => `${n} days`);
}

/** "Show me the tour: Banff & Yoho Discovery" (a tap on a recommendation card), or a website name. */
function catalogProductIn(text: string) {
  const lower = text.toLowerCase().replace(/[–—]/g, "-");
  const norm = (n: string) => n.toLowerCase().replace(/[–—]/g, "-");
  return [...WEBSITE_CATALOG].sort((a, b) => b.name.length - a.name.length).find((p) => lower.includes(norm(p.name))) ?? null;
}

async function catalogTourDetails(slug: string, state: State, ctx: ToolExecutionContext): Promise<Reply> {
  const trip = state.consult ?? state.trip ?? {};
  const out = await runConciergeTool("get_tour_details", { slug, date: trip.date, guests: trip.guests }, ctx);
  const d = out.result as { name?: string; overview?: string; price?: string; duration?: string; bookIn?: string; departures?: unknown[] };
  if (!d?.name) return { message: `I couldn't open that tour. ${CONTACT}.` };
  state.tourSlug = slug;
  state.tourTitle = d.name;
  const ask = trip.guests ? "" : " How many guests are travelling?";
  const next =
    d.bookIn === "page"
      ? `Tap "Choose dates and book" to pick a date for each day and pay here in the chat.${ask}`
      : d.departures?.length
        ? `Tap "Book" on a date below to book it here, or tell me another date.${ask}`
        : `Tell me a date and I'll check seats.${ask}`;
  return { message: `${d.name}: ${firstSentence(d.overview ?? "")} ${d.duration}, ${d.price}. ${next}`, data: out.card?.data };
}

const POLICY =
  "Shared tours and shuttles: full refund if you cancel at least 24 hours before departure. Private single-day tours: full refund at least 72 hours before. Private packages of two or more days: 80% refund at least 72 hours before the first tour day (20% of the total is non-refundable). After the deadline, and for late arrivals or no-shows, there's no refund. Refunds take 5–10 business days, and activity tickets follow the provider's rules. You can request a cancellation from My trips (/account/trips). Full policy: /privacy-policy-vista-chase.";

const CAN_DO =
  "I can tell you about our tours, shuttles and prices, check dates with free seats, find your hotel pickup, answer questions like what's included, what to bring, ages, lunch or airport transfers, explain the cancellation policy, and look up a booking with its reference and email.";

const BANFF_ELITE_TRIGGER = /\b(banff elite|personalised tour|personalized tour|bespoke tour|custom tour|custom journey|personalize|customise|request personalised tours|request personalized tours)\b/i;
const CONFIRM_WORDS = /\b(yes|send|submit|confirm|go ahead|please send|looks good|send it|send enquiry)\b/i;

async function handleBanffEliteFallback(
  text: string,
  userTurns: ChatMessage[],
  state: State,
  ctx: ToolExecutionContext,
): Promise<Reply | null> {
  const lower = text.toLowerCase();
  const isTrigger = BANFF_ELITE_TRIGGER.test(lower);
  if (!isTrigger && !state.banffElite) return null;

  const be = (state.banffElite = state.banffElite || {});
  state.topic = "banff_elite";

  // 1. Extract details from the text
  const emailMatch = text.match(EMAIL)?.[0];
  if (emailMatch) be.email = emailMatch.trim();

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-\s]?\d{6,14}/)?.[0];
  if (phoneMatch) be.phone = phoneMatch.trim();

  const nameMatch =
    text.match(/(?:my name is|i'm|i am|name[:\s]+)([a-zA-Z\s]{2,40})/i)?.[1]?.trim() ??
    text.match(/^([a-zA-Z]{2,20}\s+[a-zA-Z]{2,20})$/)?.[1]?.trim();
  if (nameMatch && !/banff|elite|vista|tour|help/i.test(nameMatch)) be.name = nameMatch;

  const guestsMatch = text.match(/(\d+)\s*(?:guests?|people|passengers?|adults?|travelers?|travellers?)/i)?.[1];
  if (guestsMatch) be.guests = parseInt(guestsMatch, 10);

  const daysMatch = text.match(/(\d+)\s*(?:days?|day tour)/i)?.[1];
  if (daysMatch) be.tourDays = parseInt(daysMatch, 10);

  if (/\bluxury suv\b/i.test(lower)) be.preferredVehicle = "luxury SUV";
  else if (/\bluxury van\b/i.test(lower)) be.preferredVehicle = "luxury van";
  else if (/\bhelp me choose\b/i.test(lower)) be.preferredVehicle = "help me choose";

  const dateMention = mentionedDate(text);
  if (dateMention) be.travelDates = dateMention;
  else {
    const timeMatch = text.match(/\b(in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|summer|winter|spring|autumn|fall))\b/i)?.[1];
    if (timeMatch) be.travelDates = timeMatch;
  }

  // Check if user is confirming submission of complete details
  const hasRequired = !!(be.name && be.email && be.phone);
  if (hasRequired && be.step === "confirm" && CONFIRM_WORDS.test(lower)) {
    const res = (await runConciergeTool("submit_banff_elite_enquiry", { ...be }, ctx)).result as any;
    if (res?.success) {
      state.banffElite = undefined;
      return {
        message: "Your enquiry has been sent. The Banff Elite team will contact you within 24 hours.",
        data: {
          type: "banff_elite_enquiry_result",
          success: true,
          message: "Your enquiry has been sent. The Banff Elite team will contact you within 24 hours.",
        },
      };
    } else {
      return {
        message: "Your enquiry couldn’t be sent. Please try again or email support@banffelite.com.",
        data: {
          type: "banff_elite_enquiry_result",
          success: false,
          error: "Your enquiry couldn’t be sent. Please try again or email support@banffelite.com.",
        },
      };
    }
  }

  // If all required fields are present, show brief enquiry summary and ask whether the guest wants it sent
  if (hasRequired) {
    be.step = "confirm";
    const summaryLines = [
      "Here is a summary of your enquiry:",
      `• Contact Name: ${be.name}`,
      `• Email: ${be.email}`,
      `• Phone: ${be.phone}`,
      be.guests ? `• Number of Guests: ${be.guests}` : null,
      be.travelDates ? `• Travel Dates / Timeframe: ${be.travelDates}` : null,
      be.tourDays ? `• Number of Tour Days: ${be.tourDays}` : null,
      be.preferredVehicle ? `• Preferred Vehicle: ${be.preferredVehicle}` : null,
      be.placesOfInterest ? `• Interests: ${be.placesOfInterest}` : null,
      be.paceAndRequests ? `• Pace & Requests: ${be.paceAndRequests}` : null,
      "",
      "Vehicle options (luxury SUV or luxury van) have different prices, and the Banff Elite team provides the quote after consultation. Scope is tours only; hotels and restaurants are not arranged.",
      "",
      "Would you like me to send this enquiry to the Banff Elite team?",
    ].filter((l): l is string => l !== null);

    return {
      message: summaryLines.join("\n"),
      data: {
        type: "banff_elite_enquiry_summary",
        enquiry: be,
      },
    };
  }

  // Missing required contact fields - collect only missing details
  be.step = "details";
  const missing: string[] = [];
  if (!be.name) missing.push("main contact name");
  if (!be.email) missing.push("email address");
  if (!be.phone) missing.push("phone number (including country code)");

  const isFirstGreeting =
    userTurns.length <= 1 || (!state.banffElite?.name && !state.banffElite?.email && !state.banffElite?.phone);

  if (isFirstGreeting) {
    return {
      message:
        "Banff Elite is Vista Chase’s sister company for personalised tour itineraries. Choose a luxury SUV or luxury van, with options priced according to your vehicle and tour requirements.\n\n" +
        "You can explore [banffelite.com](https://banffelite.com) or submit an enquiry here. Vehicle options have different prices, and the Banff Elite team provides the quote after consultation. Scope is tours only; hotels and restaurants are not arranged.\n\n" +
        `To get started, please provide your ${missing.join(", ")}. You can submit contact details only, or also share optional planning details (number of guests, travel dates, tour days, places of interest, vehicle preference, or preferred pace).`,
      data: {
        type: "banff_elite_enquiry_form",
        enquiry: be,
      },
    };
  }

  return {
    message: `Thanks. Please provide your ${missing.join(" and ")} so we can complete your enquiry. (You can submit contact details only without completing the planning questions).`,
    data: {
      type: "banff_elite_enquiry_form",
      enquiry: be,
    },
  };
}

/** Answers the latest message from real data, or says it can't. */
export async function answerWithoutModel(messages: ChatMessage[], previous: State | undefined, ctx: ToolExecutionContext, language?: string): Promise<ConciergeResponse> {
  const state: State = { ...(previous ?? {}) };
  const userTurns = messages.filter((m) => m.role === "user");
  const text = userTurns.at(-1)?.content.trim() ?? "";
  const lower = text.toLowerCase();

  const reply = await (async (): Promise<Reply> => {
    if (CARD_NUMBER.test(text) || /\b(cvv|cvc|card number|credit card details)\b/.test(lower)) {
      return { message: "Please don't share card details in chat. I never take payment here: you pay on our secure checkout page.", hasSafetyRefusal: true };
    }
    if (/\b(human|real person|live agent|live chat|an agent|representative|(talk|speak) to (a person|someone|staff))\b/.test(lower)) {
      return { message: `Tap "Chat with a live agent" below to chat with our support team here, or ${CONTACT}.`, data: { type: "handoff" } };
    }

    // Banff Elite personalised tour enquiry flow
    const banffEliteReply = await handleBanffEliteFallback(text, userTurns, state, ctx);
    if (banffEliteReply) return banffEliteReply;

    // A departure the guest names: show it with its in-chat "Book" button.
    const picked = text.match(/^I choose the departure on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})/);
    if (picked) {
      const out = await runConciergeTool("check_availability", { date: picked[1], tourSlug: state.tourSlug }, ctx);
      const dep = (Array.isArray(out.result) ? (out.result as { id: string; title?: string; departureTime: string }[]) : []).find((d) => d.departureTime === picked[2]);
      if (!dep) return { message: `That departure no longer has free seats. Ask me for other dates, or ${CONTACT}.` };
      // The card's "Book" button opens the checkout inside the chat (no /book page).
      return {
        message: `To book ${dep.title ?? "this departure"} on ${picked[1]} at ${picked[2]}, tap "Book" below. You choose guests and pickup and pay right here in the chat; the booking is confirmed once payment goes through.`,
        data: { type: "availability", departures: [dep] },
      };
    }

    // Booking lookup and tracking need the reference and the booking email, possibly over two messages.
    const refInText = text.match(REFERENCE)?.[0].toUpperCase();
    const emailInText = text.match(EMAIL)?.[0];
    const awaitingEmail = !!emailInText && !refInText && !!state.bookingReference && (state.topic === "lookup" || state.topic === "track");
    const trackingWords = /\b(where is (my|the) (shuttle|bus|van|driver|vehicle|pickup)|track\w*|eta|running late)\b/.test(lower);
    const bookingWords = /\b(my booking|my reservation|my trip|booking reference|my voucher|booking status)\b/.test(lower);
    if (refInText || awaitingEmail || trackingWords || bookingWords) {
      const wantsTracking = trackingWords || (awaitingEmail && state.topic === "track");
      state.topic = wantsTracking ? "track" : "lookup";
      const reference = refInText ?? state.bookingReference;
      if (reference) state.bookingReference = reference;
      if (!reference) return { message: "Please send your booking reference (it looks like VC-2026-XXXXXXXX, on your confirmation email) and the email address you booked with." };
      const email = emailInText ?? userTurns.map((m) => m.content.match(EMAIL)?.[0]).filter(Boolean).at(-1);
      if (!email) return { message: `Thanks. What email address did you book ${reference} with? I need both to show booking details.` };
      return booking(wantsTracking ? "track_vehicle" : "lookup_booking", reference, email, ctx);
    }

    if (/\b(cancel\w*|refund\w*|money back|reschedul\w*|change my date)\b/.test(lower)) return { message: POLICY };

    // A tap on a recommendation card, or a tour named as the website names it.
    const product = /^show me the tour:/i.test(text) || !state.consult ? catalogProductIn(text) : null;
    if (product && (/^show me the tour:/i.test(text) || /\b(tell me|about|details?|more|what is|show)\b/.test(lower))) {
      state.topic = "details";
      return catalogTourDetails(product.slug, state, ctx);
    }

    // Helping the guest choose: one question at a time, then matching tours as cards.
    const said = preferencesIn(text, state.consult?.asked);
    const saidSomething = Object.keys(said).length > 0;
    if (CONSULT_START.test(lower) || (state.consult && saidSomething)) {
      state.consult = { ...(state.consult ?? {}), ...said };
      return consult(state.consult, state, ctx);
    }
    state.consult = undefined;

    const tours = await catalog();
    const named = matchTour(text, tours);
    const tour = named ?? (state.tourSlug ? tours.find((t) => t.slug === state.tourSlug) ?? null : null);
    if (named) {
      state.tourSlug = named.slug;
      state.tourTitle = named.title;
    }
    const date = mentionedDate(text);
    const category = CATEGORY_WORDS.find(([re]) => re.test(lower))?.[1];
    // Named by kind only ("the shuttle"), not by a place: the guest means the kind, not one tour.
    const onlyKind = !!named && !!category && !PLACE_WORDS.some((w) => lower.includes(w));

    // Questions the website's FAQ and tour pages answer (lunch, what to bring, ages, airport…).
    const known = knowledgeAnswer(text);
    // A tour named by place ("the sunrise shuttle") gets its own answer, not the overview of its kind.
    const kindTopic = known && ["shuttle", "private", "duration"].includes(known.id);
    if (known && known.score >= 2 && !date && !(kindTopic && named && !onlyKind && known.id !== "duration")) {
      state.topic = undefined;
      if (known.id === "duration" && tour && !onlyKind) return { message: `${tour.title} takes about ${tour.durationHours} hours. ${known.answer}` };
      if (known.id === "duration" && category) {
        const list = tours.filter((t) => t.category === category);
        if (list.length) return { message: `${list.map((t) => `• ${t.title}: about ${t.durationHours} hours`).join("\n")}\n\n${known.answer}` };
      }
      if (known.id === "shuttle") {
        const shuttles = tours.filter((t) => t.category === "SHUTTLE");
        if (shuttles.length) return { message: `${known.answer}\n\n${shuttles.map((t) => `• ${t.title}: ${priceLine(t)}`).join("\n")}` };
      }
      return { message: known.answer };
    }

    if (/\b(pick ?up|pick you up|hotel|staying at|where do you (pick|meet)|meeting point)\b/.test(lower)) {
      state.topic = "pickup";
      return pickups(text, ctx);
    }
    if (date || /\b(available|availability|dates?|when|seats?|book|reserve|schedule|times?|departures?|next)\b/.test(lower)) {
      state.topic = "dates";
      return availability(date, tour, ctx);
    }
    if (/\b(price|prices|cost|how much|fare|rate|cheap\w*|expensive|budget)\b/.test(lower)) {
      state.topic = "price";
      // "How much is the shuttle?" names a kind of trip, not one tour: list them all.
      if (tour && !onlyKind) return { message: `${tour.title}: ${priceLine(tour)}. Prices are in CAD and the price shown is the price you pay. Ask me for dates to see the exact fare per departure.` };
      const list = tours.filter((t) => !category || t.category === category).slice(0, 8);
      return { message: `Prices from our catalog:\n${list.map((t) => `• ${t.title}: ${priceLine(t)}`).join("\n")}\n\nTell me which one interests you and I'll check dates.` };
    }
    if (/\bmoraine\b/.test(lower) && /\b(road|drive|driving|car|park\w*|access|get there|get to|reach|closed)\b/.test(lower)) {
      const shuttles = tours.filter((t) => t.category === "SHUTTLE").slice(0, 4);
      return {
        message: `Moraine Lake Road is closed to private vehicles, so you need a Parks Canada shuttle or a licensed operator like Vista Chase. Our options:\n${shuttles.map((t) => `• ${t.title}: ${priceLine(t)}`).join("\n")}\n\nTell me a date and I'll check seats.`,
      };
    }
    if (/\b(phone|call|email|contact|office|address)\b/.test(lower)) {
      return { message: `You can ${CONTACT}. Our office is at 121 Bow Meadows Crescent #110, Canmore, AB.` };
    }
    if (onlyKind && category) {
      const overview = kindOverview(category, tours);
      if (overview) return overview;
    }
    if (named || (tour && /\b(it|this|that|tell me more|details?|included|include|itinerary|how long|duration|what do)\b/.test(lower))) {
      state.topic = "details";
      return tourDetails(tour!, ctx);
    }
    if (tour && state.topic === "price") return { message: `${tour.title}: ${priceLine(tour)}.` };
    if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|namaste|bonjour|hola)\b/.test(lower) && text.length < 40) {
      return { message: `Hello! ${CAN_DO} What are you planning?` };
    }
    if (/\btours?\b/.test(lower)) {
      state.consult = {};
      const first = await consult(state.consult, state, ctx);
      return { ...first, message: `We run small-group shared tours, private tours, lake shuttles and multi-day journeys. ${first.message.replace(/^Happy to help you choose\. /, "")}` };
    }
    if (known) return { message: known.answer };
    return {
      message: `I don't have reliable information to answer that here. ${CAN_DO} For anything else, tap "Chat with a live agent" below, or ${CONTACT}.`,
      data: { type: "handoff" },
    };
  })();

  let message = reply.message;
  const lang = conciergeLanguage(language);
  if (lang && lang.code !== "en" && !state.englishNotice) {
    state.englishNotice = true;
    message = `(Replies in ${lang.english} need the full AI assistant, which isn't switched on yet, so I'm answering in English.)\n\n${message}`;
  }
  return { message, data: reply.data, checkoutUrl: reply.checkoutUrl, hasSafetyRefusal: reply.hasSafetyRefusal, sessionState: state };
}
