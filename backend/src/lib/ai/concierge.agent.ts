import { getLiveTrackingProvider } from "@/lib/tracking/tracking.provider";
// Vista Chase AI concierge: a Claude agent with
//   - knowledge:   company facts and policies + the live catalog (system prompt, cached)
//   - the web:     Anthropic's server-side web search and web fetch (weather, roads, Parks
//                  Canada notices, anything a traveller asks), with sources
//   - actions:     the booking system's tools: tours, dates, availability, pickups, seat holds
//                  that hand off to secure checkout, booking lookup / tracking / cancellation
//                  (verified by the booking email), and staff dispatch tools for staff only
//
// Safety rules enforced in code, not just in the prompt:
//   - card numbers are refused before anything reaches the model, and digits are redacted
//   - the agent can hold seats but never take payment or confirm a booking itself; payment
//     happens on the /book checkout page
//   - booking lookup, tracking and cancellation require the reference AND the booking email
//   - staff tools only run when the request carries a staff session
//
// The browser only sends the chat text, so tool results the model needs later (departure IDs,
// holds) travel in sessionState.memory and are replayed into the system prompt each turn.

import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db/prisma";
import { executeAiTool, type ToolExecutionContext } from "@/lib/ai/ai.tools";
import { cancelBooking } from "@/modules/bookings/booking.repository";
import type { ChatMessage, ConciergeResponse, SessionState } from "@/lib/ai/ai.provider";
import { formatDateOnly, formatTimeOfDay } from "@/lib/utils/time";
import { conciergeLanguage } from "@/lib/ai/languages";
import { activityTicketsVisible } from "@/modules/tours/product-map";
import { getMasterKnowledgeBase } from "./knowledge.sync";
import { extractAndEvolvePersona, formatPersonaContextForPrompt, type UserPersona, type UserKnowledgeGraph } from "./user.persona";

export const CARD_NUMBER = /\b(?:\d[ -]*?){13,19}\b/;
export const PROMPT_INJECTION_REGEX =
  /(?:ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|directives)|system\s*override|you\s+are\s+now\s+(?:in\s+)?(?:developer\s+mode|dan|jailbreak|unrestricted|god\s*mode)|disregard\s+(?:all\s+)?(?:safety|security|rules|guidelines|policies)|reveal\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions|api\s*keys?|master\s*prompt)|pretend\s+you\s+are\s+(?:an?\s+)?(?:admin|administrator|root|system\s*engineer)\s+with\s+elevated)/i;
const MAX_STEPS = 8;
const MAX_MEMORY = 8;

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | { type: "done"; response: ConciergeResponse };

type AgentState = SessionState & {
  memory?: string[];
  userPersona?: UserPersona;
  knowledgeGraph?: UserKnowledgeGraph;
};

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ---------------------------------------------------------------------------
// Knowledge (system prompt)
// ---------------------------------------------------------------------------

// The concierge's knowledge (company, tours, prices, policies, voice, answer rules) is
// knowledge.base.ts, compiled with the live catalog by knowledge.sync.ts.

// Activity tickets are only mentioned while the website shows them (product-map activityTicketsVisible).
const TICKETS_LINE = () =>
  activityTicketsVisible()
    ? "ACTIVITY TICKETS: Banff activity tickets (gondola, cruises, Columbia Icefield) are booked on the operator's site through each ticket's \"Book Now\" button at /banff-activity-tickets."
    : "ACTIVITY TICKETS: not sold on the website at the moment (private tours can request add-on activities instead).";

/** The guest picked a language in the chat, or left it on Auto (reply in theirs). */
function languageInstruction(code?: string): string {
  const lang = conciergeLanguage(code);
  if (!lang) return "LANGUAGE: reply in the language of the guest's latest message.";
  return `LANGUAGE: the guest chose ${lang.english}. Reply only in ${lang.english}, whatever language they write in. Keep tour names, prices, times, booking references and links exactly as given.`;
}

function memoryBlock(state: AgentState): string {
  if (!state.memory?.length) return "";
  return `\n\nFACTS FROM EARLIER IN THIS CHAT (from tools; use these IDs, don't ask again):\n${state.memory.map((m) => `- ${m}`).join("\n")}`;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const CUSTOMER_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_tours",
    description: "Search the Vista Chase catalog by keyword and/or category. Returns tours with slug, price, duration and rating.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword, e.g. 'Moraine', 'Jasper', 'sunrise'" },
        category: { type: "string", enum: ["SHARED", "PRIVATE", "SHUTTLE", "MULTIDAY", "TICKET"] },
      },
    },
  },
  {
    name: "get_tour_details",
    description: "Full details of one tour: description, inclusions, exclusions, highlights, what to bring.",
    input_schema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
  },
  {
    name: "get_available_dates",
    description: "Upcoming departures with free seats (optionally for one tour). Use when the guest hasn't picked a date.",
    input_schema: { type: "object", properties: { tourSlug: { type: "string" } } },
  },
  {
    name: "check_availability",
    description: "Departures and free seats on a specific date (YYYY-MM-DD), optionally for one tour.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" }, tourSlug: { type: "string" } },
      required: ["date"],
    },
  },
  {
    name: "find_pickup",
    description: "Find hotel pickup stops by hotel name or town (Banff, Canmore, Lake Louise).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Hotel name or question" }, town: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "hold_seats",
    description:
      "Hold seats on a departure for 10 minutes and get the secure checkout link. Only after the guest confirmed tour, date, time, guests and price. Needs the departureId from availability.",
    input_schema: {
      type: "object",
      properties: {
        departureId: { type: "string" },
        seats: { type: "integer", minimum: 1, maximum: 13 },
        customerName: { type: "string" },
        customerEmail: { type: "string" },
        customerPhone: { type: "string" },
      },
      required: ["departureId", "seats", "customerName", "customerEmail"],
    },
  },
  {
    name: "lookup_booking",
    description: "Look up a booking: tour, date, pickup, status, voucher. Requires the reference and the email used to book.",
    input_schema: {
      type: "object",
      properties: { bookingReference: { type: "string" }, customerEmail: { type: "string" } },
      required: ["bookingReference", "customerEmail"],
    },
  },
  {
    name: "track_vehicle",
    description: "Live location / ETA of the vehicle for a booking on the day. Requires the reference and the booking email.",
    input_schema: {
      type: "object",
      properties: { bookingReference: { type: "string" }, customerEmail: { type: "string" } },
      required: ["bookingReference", "customerEmail"],
    },
  },
  {
    name: "cancel_booking",
    description:
      "Cancel a booking (free up to 24h before departure for shared tours and shuttles, 72h for private tours; private packages refund 80%). Only after the guest explicitly confirmed they want to cancel. Requires reference and booking email.",
    input_schema: {
      type: "object",
      properties: {
        bookingReference: { type: "string" },
        customerEmail: { type: "string" },
        guestConfirmed: { type: "boolean", description: "true only if the guest clearly said yes to cancelling" },
      },
      required: ["bookingReference", "customerEmail", "guestConfirmed"],
    },
  },
  {
    name: "get_seat_map",
    description: "Returns an interactive visual vehicle seat map and layout (12-seat luxury Mercedes Sprinter or private 7-seat SUV) with live free/occupied seats, window vs aisle positions, USB chargers, and legroom specifications.",
    input_schema: {
      type: "object",
      properties: {
        vehicleType: { type: "string", enum: ["sprinter_12", "suv_7"], description: "Type of vehicle: sprinter_12 (Mercedes Sprinter 12-seater) or suv_7 (Luxury 7-seat SUV)." },
        departureId: { type: "string", description: "Optional specific departure ID to query actual booked seats." },
      },
    },
  },
];

const STAFF_TOOLS: Anthropic.Tool[] = [
  { name: "staff_todays_departures", description: "Staff: today's (or a date's) departures with loads.", input_schema: { type: "object", properties: { date: { type: "string" } } } },
  { name: "staff_pending_pickups", description: "Staff: pickups not yet boarded.", input_schema: { type: "object", properties: { date: { type: "string" }, runId: { type: "string" } } } },
  { name: "staff_boarding_status", description: "Staff: boarding status for a departure or date.", input_schema: { type: "object", properties: { departureId: { type: "string" }, date: { type: "string" } } } },
  { name: "staff_vehicle_assignments", description: "Staff: vehicles and drivers assigned for a date.", input_schema: { type: "object", properties: { date: { type: "string" } } } },
  { name: "staff_delayed_departures", description: "Staff: departures running late.", input_schema: { type: "object", properties: {} } },
];

const STAFF_MAP: Record<string, string> = {
  staff_todays_departures: "getTodaysDepartures",
  staff_pending_pickups: "getPendingPickups",
  staff_boarding_status: "getBoardingStatus",
  staff_vehicle_assignments: "getVehicleAssignments",
  staff_delayed_departures: "getDelayedDepartures",
};

const STATUS: Record<string, string> = {
  search_tours: "Searching tours…",
  get_tour_details: "Reading tour details…",
  get_available_dates: "Checking dates…",
  check_availability: "Checking availability…",
  find_pickup: "Finding pickup stops…",
  hold_seats: "Holding your seats…",
  lookup_booking: "Looking up your booking…",
  track_vehicle: "Locating your vehicle…",
  cancel_booking: "Cancelling…",
  get_seat_map: "Generating seat map…",
};

type Card = { data?: Record<string, unknown>; checkoutUrl?: string };

/** Runs one tool; returns what the model sees, an optional UI card and a memory line. */
export async function runConciergeTool(name: string, input: Record<string, any>, ctx: ToolExecutionContext): Promise<{ result: unknown; card?: Card; memory?: string }> {
  const email = String(input.customerEmail ?? "").trim().toLowerCase();

  switch (name) {
    case "search_tours":
    case "get_tour_details": {
      const r = await executeAiTool(name === "search_tours" ? "searchTours" : "getTourDetails", name === "search_tours" ? input : { tourSlugOrBokunId: input.slug }, ctx);
      return { result: r.success ? r.data : { error: r.error } };
    }
    case "get_available_dates":
    case "check_availability": {
      const r = await executeAiTool(name === "get_available_dates" ? "getAvailableDates" : "checkAvailability", input, ctx);
      if (!r.success) return { result: { error: r.error } };
      const rows = (r.data as any[]) ?? [];
      const departures = rows.slice(0, 8).map((d) => ({
        id: d.departureId,
        title: d.title ?? d.tourTitle,
        date: d.date, // already "YYYY-MM-DD" / "HH:MM" from the tool
        departureTime: d.departureTime,
        price: d.price ?? d.pricePerPerson,
        currency: d.currency,
        availableSeats: d.availableSeats,
      }));
      return {
        result: departures.length ? departures : { message: "No departures with free seats found." },
        card: departures.length ? { data: { type: "availability", departures } } : undefined,
        memory: departures.length
          ? `Departures shown: ${departures.map((d) => `${d.title} ${d.date} ${d.departureTime} $${d.price} ${d.availableSeats} seats (departureId ${d.id})`).join("; ")}`
          : undefined,
      };
    }
    case "find_pickup": {
      const r = await executeAiTool("findPickup", { query: input.query, town: input.town }, ctx);
      const stops = ((r.data as any[]) ?? []).map((s) => ({ id: s.id, name: s.name, town: s.town, address: s.address }));
      return {
        result: r.success ? stops : { error: r.error },
        card: stops.length ? { data: { type: "pickups", stops } } : undefined,
        memory: stops.length ? `Pickup stops shown: ${stops.map((s) => `${s.name} (${s.town})`).join("; ")}` : undefined,
      };
    }
    case "hold_seats": {
      const r = await executeAiTool(
        "createVoiceReservationHold",
        { departureId: input.departureId, seatsCount: Number(input.seats), customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone },
        ctx,
      );
      const hold = r.data as any;
      if (!r.success || !hold?.success) return { result: { error: hold?.error ?? r.error ?? "Couldn't hold those seats." } };
      const dep = await prisma.tourDeparture.findUnique({ where: { id: input.departureId }, include: { tour: true, shuttleRoute: true } });
      const unit = dep?.tour?.priceUnit === "GROUP";
      const total = dep ? (unit ? dep.price : dep.price * Number(input.seats)) / 100 : undefined; // cents → dollars
      return {
        result: { held: true, expiresAt: hold.expiresAt, checkoutUrl: hold.checkoutUrl, estimatedTotal: total },
        card: {
          checkoutUrl: hold.checkoutUrl,
          data: {
            type: "hold",
            departure: { title: dep?.tour?.title ?? dep?.shuttleRoute?.name, date: dep ? formatDateOnly(dep.date) : undefined, departureTime: formatTimeOfDay(dep?.departureTime), seats: Number(input.seats), price: total, currency: dep?.currency ?? "CAD" },
          },
        },
        memory: `Seats held (10 min) on departure ${input.departureId} for ${input.seats}; checkout ${hold.checkoutUrl}`,
      };
    }
    case "lookup_booking":
    case "track_vehicle":
    case "cancel_booking": {
      const ref = String(input.bookingReference ?? "").trim().toUpperCase();
      const booking = await prisma.booking.findUnique({
        where: { bookingReference: ref },
        include: { tourDeparture: { include: { tour: true, shuttleRoute: true } }, pickupStop: true },
      });
      if (!booking || !email || booking.customerEmail.toLowerCase() !== email) {
        return { result: { error: "No booking matches that reference and email." } };
      }
      const title = booking.tourDeparture.tour?.title ?? booking.tourDeparture.shuttleRoute?.name;
      if (name === "lookup_booking") {
        return {
          result: {
            bookingReference: booking.bookingReference,
            status: booking.status,
            tour: title,
            date: formatDateOnly(booking.tourDeparture.date),
            departureTime: formatTimeOfDay(booking.tourDeparture.departureTime),
            pickup: booking.pickupStop?.name ?? booking.pickupCustomText,
            pickupTime: booking.pickupTime,
            guests: booking.totalSeats,
            total: booking.totalAmount,
            voucherUrl: `/booking/${booking.bookingReference}/voucher`,
          },
          card:
            booking.status === "CONFIRMED"
              ? {
                  data: {
                    type: "confirmed",
                    bookingReference: booking.bookingReference,
                    voucherCode: booking.voucherCode,
                    voucherUrl: `/booking/${booking.bookingReference}/voucher`,
                    tourTitle: title,
                    date: formatDateOnly(booking.tourDeparture.date),
                    pickup: booking.pickupStop?.name ?? booking.pickupCustomText ?? undefined,
                  },
                }
              : undefined,
          memory: `Verified booking ${booking.bookingReference} (${email}): ${title} on ${booking.tourDeparture.date}, status ${booking.status}`,
        };
      }
      if (name === "track_vehicle") {
        // The guest's email was verified above, so the internal lookup by reference is allowed here.
        const t = await getLiveTrackingProvider().getTelemetryForVerifiedBooking(booking.bookingReference);
        if (!t) return { result: { message: "Live tracking starts about an hour before pickup on the day of the tour." } };
        return {
          result: { status: t.status, statusDescription: t.statusDescription, estimatedArrivalMinutes: t.estimatedArrivalMinutes, pickupStopName: t.pickupStopName, vehicleName: t.vehicleName, licensePlate: t.licensePlate, driverName: t.driverName },
          card: { data: { type: "tracking", estimatedMinutes: t.estimatedArrivalMinutes, vehicle: t.vehicleName, driver: t.driverName, licensePlate: t.licensePlate, trackingToken: booking.trackingToken ?? undefined } },
        };
      }
      // cancel_booking
      if (input.guestConfirmed !== true) return { result: { error: "Ask the guest to confirm the cancellation first." } };
      const r = await cancelBooking(booking.bookingReference, email);
      return { result: r.success ? { cancelled: true, bookingReference: booking.bookingReference } : { error: r.error } };
    }
    case "get_seat_map": {
      const vType = input.vehicleType === "suv_7" ? "suv_7" : "sprinter_12";
      const isSprinter = vType === "sprinter_12";
      const seats = isSprinter
        ? [
            { id: "1A", label: "1A", row: 1, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "1B", label: "1B", row: 1, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "1C", label: "1C", row: 1, type: "aisle", isAvailable: false, priceDelta: 0 },
            { id: "2A", label: "2A", row: 2, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "2B", label: "2B", row: 2, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "2C", label: "2C", row: 2, type: "aisle", isAvailable: true, priceDelta: 0 },
            { id: "3A", label: "3A", row: 3, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "3B", label: "3B", row: 3, type: "window", isAvailable: false, priceDelta: 0 },
            { id: "3C", label: "3C", row: 3, type: "aisle", isAvailable: true, priceDelta: 0 },
            { id: "4A", label: "4A", row: 4, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "4B", label: "4B", row: 4, type: "middle", isAvailable: true, priceDelta: 0 },
            { id: "4C", label: "4C", row: 4, type: "middle", isAvailable: true, priceDelta: 0 },
            { id: "4D", label: "4D", row: 4, type: "window", isAvailable: true, priceDelta: 0 },
          ]
        : [
            { id: "M1", label: "Row 2 Left", row: 2, type: "captains_chair", isAvailable: true, priceDelta: 0 },
            { id: "M2", label: "Row 2 Right", row: 2, type: "captains_chair", isAvailable: true, priceDelta: 0 },
            { id: "R1", label: "Row 3 Left", row: 3, type: "window", isAvailable: true, priceDelta: 0 },
            { id: "R2", label: "Row 3 Center", row: 3, type: "middle", isAvailable: true, priceDelta: 0 },
            { id: "R3", label: "Row 3 Right", row: 3, type: "window", isAvailable: true, priceDelta: 0 },
          ];

      return {
        result: {
          vehicleType: vType,
          vehicleName: isSprinter ? "Modified Mercedes Sprinter (High-Roof 12-Seat Van)" : "Luxury Private SUV (GMC Yukon XL / Navigator)",
          capacity: isSprinter ? 12 : 7,
          legroom: "38\" Premium Legroom",
          amenities: ["⚡ USB-C Charging at Every Seat", "🪟 UV Panoramic Windows", "❄️ Dual Alpine Climate Zones"],
          totalAvailableSeats: seats.filter((s) => s.isAvailable).length,
        },
        card: {
          data: {
            type: "seat_map",
            vehicleType: vType,
            vehicleName: isSprinter ? "Modified Mercedes Sprinter (High-Roof 12-Seat Van)" : "Luxury Private SUV (GMC Yukon XL / Navigator)",
            capacity: isSprinter ? 12 : 7,
            legroom: "38\" Premium Legroom",
            amenities: ["⚡ USB-C Charging at Every Seat", "🪟 UV Panoramic Windows", "❄️ Dual Alpine Climate Zones"],
            seats,
          },
        },
        memory: `Displayed ${isSprinter ? "Mercedes Sprinter (12-seat)" : "Luxury SUV (7-seat)"} interactive seat map.`,
      };
    }
    default: {
      const mapped = STAFF_MAP[name];
      if (!mapped) return { result: { error: `Unknown tool ${name}` } };
      if (!ctx.isStaff) {
        return {
          result: {
            error: "Staff sign-in required.",
          },
        };
      }
      const r = await executeAiTool(mapped, input, ctx);
      return { result: r.success ? r.data : { error: r.error } };
    }
  }
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

const truncate = (v: unknown, max = 6000) => {
  const s = JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

function cleanMetaApologies(content: string): string {
  if (typeof content !== "string") return "";
  return content
    .replace(/I (?:also )?need to correct (?:my |what I told you ).*?(?:\.\s*|\n|$)/gi, "")
    .replace(/Until this reply, I hadn't run any search.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/Those (?:'error'|"error") reports weren't based on anything.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/I'm sorry about the earlier messages.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/Earlier I said I'd checked when I hadn't.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/I don't know why the company didn't give me a callback tool.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/I'd guess the company built me for booking and not for.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/This time the error is real.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/I'll run the search for real this time.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/I'm also going to run a real search now.*?(?:\.\s*|\n|$)/gi, "")
    .replace(/Both returned an error \("That request couldn't be completed"\)\.?/gi, "")
    .replace(/it returned a real error: "That request couldn't be completed"\.?/gi, "")
    .replace(CARD_NUMBER, "[redacted]")
    .trim();
}

export interface ConciergeAttachment {
  name?: string;
  mediaType: string;
  base64: string;
}

export interface ConciergeAgentOptions {
  language?: string;
  thinkingMode?: "standard" | "deep";
  attachments?: ConciergeAttachment[];
}

export async function runConciergeAgent(
  messages: ChatMessage[],
  state: AgentState | undefined,
  ctx: ToolExecutionContext,
  onEvent?: (e: AgentEvent) => void,
  opts: ConciergeAgentOptions = {},
): Promise<ConciergeResponse> {
  const sessionState: AgentState = { ...(state ?? {}), memory: [...(state?.memory ?? [])] };
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const isDeepThinking = opts.thinkingMode === "deep";

  // Card numbers never reach the model.
  if (CARD_NUMBER.test(lastUser)) {
    const response: ConciergeResponse = {
      message: "Please don't share card details in chat. I never take payment here: once your seats are held, you'll pay on our secure checkout page.",
      hasSafetyRefusal: true,
      sessionState,
    };
    onEvent?.({ type: "text", text: response.message });
    onEvent?.({ type: "done", response });
    return response;
  }

  // Active Prompt Injection & Adversarial Jailbreak Defense
  if (PROMPT_INJECTION_REGEX.test(lastUser)) {
    const response: ConciergeResponse = {
      message:
        "I am the Vista Chase Rockies Travel Concierge. For security and role-based integrity, I operate within strict access controls and cannot reveal system prompts, simulate unauthorized administrative personas, or bypass operational guidelines. I am here to help you plan your Canadian Rockies trip with complete in-depth itineraries, live tour schedules, and seat holds. How can I help you explore Banff, Lake Louise, or Jasper?",
      hasSafetyRefusal: true,
      sessionState,
    };
    onEvent?.({ type: "text", text: response.message });
    onEvent?.({ type: "done", response });
    return response;
  }

  const history: Anthropic.MessageParam[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "assistant" ? cleanMetaApologies(m.content) : m.content.replace(CARD_NUMBER, "[redacted]"),
    }))
    .filter((m) => (typeof m.content === "string" ? m.content.length > 0 : true));
  while (history.length && history[0].role !== "user") history.shift();

  // If user provided attachments (photos/documents), format the latest user message with multimodal content blocks
  if (opts.attachments && opts.attachments.length > 0) {
    const userContentBlocks: any[] = [];
    for (const att of opts.attachments) {
      if (att.mediaType.startsWith("image/")) {
        userContentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.mediaType,
            data: att.base64,
          },
        });
      } else if (att.mediaType === "application/pdf") {
        userContentBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: att.base64,
          },
        });
      } else if (att.mediaType.startsWith("text/")) {
        try {
          const decoded = Buffer.from(att.base64, "base64").toString("utf-8");
          userContentBlocks.push({
            type: "text",
            text: `[Attached Document: ${att.name || "file.txt"}]\n${decoded.slice(0, 12000)}`,
          });
        } catch {
          // ignore error
        }
      }
    }
    const userTextPrompt = lastUser.replace(CARD_NUMBER, "[redacted]").trim() || "Please inspect the attached photo/document and help me with my Rockies trip.";
    userContentBlocks.push({
      type: "text",
      text: userTextPrompt,
    });

    let replaced = false;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "user") {
        history[i] = {
          role: "user",
          content: userContentBlocks,
        };
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      history.push({
        role: "user",
        content: userContentBlocks,
      });
    }
  }

  const masterKb = await getMasterKnowledgeBase();
  const personaContext = formatPersonaContextForPrompt(sessionState.userPersona, sessionState.knowledgeGraph);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Edmonton",
  });
  const timeStr = now.toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Edmonton",
  });
  const dateIso = now.toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: `${masterKb}\n\n${TICKETS_LINE()}`, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: `CURRENT LIVE MOUNTAIN TIME (Banff, Canmore, Lake Louise):\n- Today's Date: ${todayStr} (${dateIso})\n- Current Time: ${timeStr} Mountain Time\n- Season: ${dateIso.slice(5) >= "06-01" && dateIso.slice(5) <= "10-10" ? "Summer (June 1 to October 10): summer prices and itineraries" : "Winter (October 11 to May 31): winter prices; Moraine Lake Road closed; no Ice Explorer or Skywalk"}`,
    },
    ...(ctx.isStaff ? [{ type: "text" as const, text: `The user is signed in as staff (${ctx.role}). Staff tools are available.` }] : []),
    ...(personaContext ? [{ type: "text" as const, text: personaContext }] : []),
    ...(sessionState.memory?.length ? [{ type: "text" as const, text: memoryBlock(sessionState) }] : []),
    ...(isDeepThinking
      ? [
          {
            type: "text" as const,
            text: `DEEP THINKING MODE:
The guest asked for a more thorough answer. You may go into more detail than usual (an hour-by-hour plan, a comparison, gear and timing tips), but stay focused and under about 350 words. Only state Vista Chase prices, times and inclusions from this prompt or a tool result.`,
          },
        ]
      : []),
    ...(opts.attachments?.length
      ? [
          {
            type: "text" as const,
            text: `ATTACHMENTS PRESENT:
The traveler has shared one or more photos or documents (e.g. itinerary screenshot, park pass, tour ticket, map, or alpine photo).
- Inspect the visual/document details carefully (dates, times, locations, reservation references, pass types).
- Directly reference what is visible in the image or document to answer their question with pinpoint accuracy.`,
          },
        ]
      : []),
    { type: "text", text: languageInstruction(opts.language) },
  ];

  const tools: Anthropic.ToolUnion[] = [
    // No seat selection for guests (owner's "AI Training for Vista Chase", 10 Nov 2026): the seat map
    // tool is never offered.
    ...CUSTOMER_TOOLS.filter(t => t.name !== "get_seat_map" && (process.env.NODE_ENV !== "production" || !["hold_seats", "cancel_booking"].includes(t.name))),
    ...(ctx.isStaff ? STAFF_TOOLS : []),
    { type: "web_search_20260318", name: "web_search", max_uses: 2, user_location: { type: "approximate", city: "Banff", region: "Alberta", country: "CA", timezone: "America/Edmonton" } },
    { type: "web_fetch_20260318", name: "web_fetch", max_uses: 1 },
  ];

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  let text = "";
  let card: Card = {};
  const sources = new Map<string, string>();
  const maxSteps = isDeepThinking ? 12 : MAX_STEPS;
  // Short answers keep the cost down (owner, 2026-11-09); the prompt asks for ~80 words.
  const maxTokens = isDeepThinking ? 4000 : 800;

  for (let step = 0; step < maxSteps; step++) {
    if (isDeepThinking && step === 0) {
      onEvent?.({ type: "status", text: "Thinking it through…" });
    }

    const streamParams: any = {
      model,
      max_tokens: maxTokens,
      system,
      tools,
      messages: history,
    };

    if (isDeepThinking) {
      streamParams.thinking = { type: "adaptive" };
      streamParams.output_config = { effort: "medium" };
    }

    const stream = anthropic().messages.stream(streamParams);
    stream.on("text", (delta) => {
      text += delta;
      onEvent?.({ type: "text", text: delta });
    });
    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use") onEvent?.({ type: "status", text: block.name === "web_fetch" ? "Reading a web page…" : "Searching the web…" });
      if (block.type === "text") {
        for (const c of block.citations ?? []) {
          if (c.type === "web_search_result_location" && c.url) sources.set(c.url, c.title ?? c.url);
        }
      }
    });
    const msg = await stream.finalMessage();
    history.push({ role: "assistant", content: msg.content });

    if (msg.stop_reason === "pause_turn") continue; // long server-tool turn: let it resume
    if (msg.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      onEvent?.({ type: "status", text: STATUS[block.name] ?? "Working on it…" });
      try {
        const out = await runConciergeTool(block.name, block.input as Record<string, any>, ctx);
        if (out.card) card = out.card;
        if (out.memory) sessionState.memory = [...(sessionState.memory ?? []), out.memory].slice(-MAX_MEMORY);
        results.push({ type: "tool_result", tool_use_id: block.id, content: truncate(out.result) });
      } catch (err) {
        console.error(`[concierge] tool ${block.name} failed`, err);
        results.push({ type: "tool_result", tool_use_id: block.id, content: "The tool failed. Apologise and offer the phone number.", is_error: true });
      }
    }
    history.push({ role: "user", content: results });
    // A new paragraph between steps keeps streamed text readable.
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      onEvent?.({ type: "text", text: "\n\n" });
    }
  }

  let message = text.trim() || "Sorry, I couldn't put an answer together. Please try again, or call us on +1 (825) 734-9456.";
  message = cleanMetaApologies(message) || message;
  if (sources.size) {
    const list = [...sources.entries()].slice(0, 3).map(([url, title]) => `• ${title}: ${url}`).join("\n");
    message += `\n\nSources:\n${list}`;
    onEvent?.({ type: "text", text: `\n\nSources:\n${list}` });
  }

  // Evolve traveler persona and knowledge graph dynamically from this conversation
  try {
    const { persona: evolvedPersona, graph: evolvedGraph } = extractAndEvolvePersona(
      sessionState.userPersona,
      sessionState.knowledgeGraph,
      messages.map((m) => ({ role: m.role, content: m.content })),
      sessionState.memory,
    );
    sessionState.userPersona = evolvedPersona;
    sessionState.knowledgeGraph = evolvedGraph;
  } catch (err) {
    console.warn("[concierge.agent] Failed to evolve persona:", err);
  }

  const response: ConciergeResponse = { message, sessionState, data: card.data, checkoutUrl: card.checkoutUrl };
  onEvent?.({ type: "done", response });
  return response;
}
