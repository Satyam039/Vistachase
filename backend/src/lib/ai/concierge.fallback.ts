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

import prisma from "@/lib/db/prisma";
import { CARD_NUMBER, runConciergeTool } from "@/lib/ai/concierge.agent";
import { conciergeLanguage } from "@/lib/ai/languages";
import type { ChatMessage, ConciergeResponse, SessionState } from "@/lib/ai/ai.provider";
import type { ToolExecutionContext } from "@/lib/ai/ai.tools";
import { todayInMountainTime } from "@/lib/utils/time";

type Topic = "price" | "dates" | "details" | "pickup" | "lookup" | "track";
type State = SessionState & { topic?: Topic; englishNotice?: boolean };
type Reply = { message: string; data?: Record<string, unknown>; checkoutUrl?: string; hasSafetyRefusal?: boolean };

const PHONE = "+1 (825) 734-9456";
const CONTACT = `call us on ${PHONE} (6 a.m. – 9 p.m. Mountain Time) or email support@vistachase.com`;
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

type CatalogTour = { slug: string; title: string; category: string; basePrice: number; currency: string; priceUnit: string; durationHours: number; summary: string; bookingMode: string };

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
    const hay = `${t.title} ${t.slug} ${t.summary}`.toLowerCase();
    let score = places.filter((w) => hay.includes(w)).length * 2;
    if (category) score += t.category === category ? 3 : -3;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

async function catalog(): Promise<CatalogTour[]> {
  return prisma.tour.findMany({
    select: { slug: true, title: true, category: true, basePrice: true, currency: true, priceUnit: true, durationHours: true, summary: true, bookingMode: true },
    orderBy: [{ sortOrder: "asc" }, { basePrice: "asc" }],
  });
}

const priceLine = (t: CatalogTour) =>
  t.basePrice > 0 ? `from ${money(t.basePrice, t.currency)} ${t.priceUnit === "GROUP" ? "per vehicle" : "per guest"}` : "price on request";

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

async function tourDetails(tour: CatalogTour, ctx: ToolExecutionContext): Promise<Reply> {
  const { result } = await runConciergeTool("get_tour_details", { slug: tour.slug }, ctx);
  const d = result as { summary?: string; inclusions?: string[]; highlights?: string[]; durationHours?: number } | null;
  const lines = [`${tour.title}: ${priceLine(tour)}, about ${tour.durationHours} hours.`];
  if (d?.summary) lines.push(d.summary);
  const included = (d?.inclusions ?? []).slice(0, 5);
  if (included.length) lines.push(`Included:\n${included.map((i) => `• ${i}`).join("\n")}`);
  lines.push(
    tour.bookingMode === "ENQUIRY"
      ? "This one is arranged on request: use the Request button on the tour page or /contact-us."
      : "Ask me for available dates, or tell me a date to check.",
  );
  return { message: lines.join("\n\n"), data: { type: "tour", tour: { slug: tour.slug, title: tour.title, category: tour.category, durationHours: tour.durationHours, basePrice: tour.basePrice / 100, currency: tour.currency, summary: tour.summary } } };
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
    message: `${date ? `Departures with free seats on ${date}` : `Next departures with free seats for ${what}`}:\n${list.join("\n")}\n\nChoose one to get its booking link.`,
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

const POLICY =
  "Cancel at least 72 hours before departure: groups of 1–6 get a full refund; groups of 7 or more and multi-day trips get everything back except the 20% non-refundable deposit. Within 72 hours, and for late arrivals or no-shows, there's no refund. Refunds take 5–10 business days, and activity tickets follow the provider's rules. You can request a cancellation from My trips (/account/trips). Full policy: /privacy-policy-vista-chase.";

const CAN_DO =
  "I can tell you about our tours and prices, check dates with free seats, find your hotel pickup, explain the cancellation policy, and look up a booking with its reference and email.";

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
      return { message: `Tap "Chat with a live agent" below and this conversation goes to our support team, or ${CONTACT}.`, data: { type: "handoff" } };
    }

    // A departure picked on the availability card: hand over the real checkout link.
    const picked = text.match(/^I choose the departure on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})/);
    if (picked) {
      const out = await runConciergeTool("check_availability", { date: picked[1], tourSlug: state.tourSlug }, ctx);
      const dep = (Array.isArray(out.result) ? (out.result as { id: string; title?: string; departureTime: string }[]) : []).find((d) => d.departureTime === picked[2]);
      if (!dep) return { message: `That departure no longer has free seats. Ask me for other dates, or ${CONTACT}.` };
      return { message: `To book ${dep.title ?? "this departure"} on ${picked[1]} at ${picked[2]}, continue at /book?departureId=${dep.id}\nYou choose guests and pickup there, and the booking is confirmed once payment goes through.` };
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

    const tours = await catalog();
    const named = matchTour(text, tours);
    const tour = named ?? (state.tourSlug ? tours.find((t) => t.slug === state.tourSlug) ?? null : null);
    if (named) {
      state.tourSlug = named.slug;
      state.tourTitle = named.title;
    }
    const date = mentionedDate(text);

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
      const category = CATEGORY_WORDS.find(([re]) => re.test(lower))?.[1];
      // "How much is the shuttle?" names a kind of trip, not one tour: list them all.
      const onlyKind = named && category && !PLACE_WORDS.some((w) => lower.includes(w));
      if (tour && !onlyKind) return { message: `${tour.title}: ${priceLine(tour)}. Prices are in CAD and the price shown is the price you pay. Ask me for dates to see the exact fare per departure.` };
      const list = tours.filter((t) => !category || t.category === category).slice(0, 8);
      return { message: `Prices from our catalog:\n${list.map((t) => `• ${t.title}: ${priceLine(t)}`).join("\n")}\n\nTell me which one interests you and I'll check dates.` };
    }
    if (/\bmoraine\b/.test(lower) && /\b(road|drive|driving|car|park\w*|access|get there|closed)\b/.test(lower)) {
      const shuttles = tours.filter((t) => t.category === "SHUTTLE").slice(0, 4);
      return {
        message: `Moraine Lake Road is closed to private vehicles, so you need a Parks Canada shuttle or a licensed operator like Vista Chase. Our options:\n${shuttles.map((t) => `• ${t.title}: ${priceLine(t)}`).join("\n")}\n\nTell me a date and I'll check seats.`,
      };
    }
    if (/\b(phone|call|email|contact|office|address)\b/.test(lower)) {
      return { message: `You can ${CONTACT}. Our office is at 121 Bow Meadows Crescent #110, Canmore, AB.` };
    }
    if (named || (tour && /\b(it|this|that|tell me more|details?|included|include|itinerary|how long|duration|what do)\b/.test(lower))) {
      state.topic = "details";
      return tourDetails(tour!, ctx);
    }
    if (tour && state.topic === "price") return { message: `${tour.title}: ${priceLine(tour)}.` };
    if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|namaste|bonjour|hola)\b/.test(lower) && text.length < 40) {
      return { message: `Hello! ${CAN_DO} What are you planning?` };
    }
    if (/\b(tours?|things to do|recommend|suggest|options|what do you (offer|have))\b/.test(lower)) {
      const list = tours.filter((t) => t.category !== "TICKET").slice(0, 8);
      return { message: `Here's what we run:\n${list.map((t) => `• ${t.title} (${t.category.toLowerCase()}): ${priceLine(t)}`).join("\n")}\n\nAsk about any of them for details or dates.` };
    }
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
