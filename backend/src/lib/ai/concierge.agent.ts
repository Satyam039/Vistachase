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

export const CARD_NUMBER = /\b(?:\d[ -]*?){13,19}\b/;
const MAX_STEPS = 8;
const MAX_MEMORY = 8;

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | { type: "done"; response: ConciergeResponse };

type AgentState = SessionState & { memory?: string[] };

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

let catalogCache: { at: number; text: string } | null = null;

async function catalogKnowledge(): Promise<string> {
  if (catalogCache && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.text;
  const tours = await prisma.tour.findMany({
    select: { slug: true, title: true, category: true, durationHours: true, basePrice: true, currency: true, priceUnit: true, summary: true, bookingMode: true },
    orderBy: [{ category: "asc" }, { basePrice: "asc" }],
  });
  const stops = await prisma.shuttleStop.findMany({ where: { isActive: true }, select: { name: true, town: true }, orderBy: { sortOrder: "asc" } });
  const lines = tours.map((t) => {
    const price = t.basePrice > 0 ? `from $${t.basePrice} ${t.currency} ${t.priceUnit === "GROUP" ? "per vehicle" : "per guest"}` : "price on request";
    const mode = t.bookingMode === "ENQUIRY" ? "enquiry only (custom quote)" : "bookable departures";
    return `- ${t.title} [slug: ${t.slug}] · ${t.category} · ~${t.durationHours}h · ${price} · ${mode}. ${t.summary}`;
  });
  const towns = [...new Set(stops.map((s) => s.town))];
  const text = `CATALOG (live)\n${lines.join("\n")}\n\nPICKUP STOPS: ${stops.length} stops in ${towns.join(", ")} (e.g. ${stops
    .slice(0, 8)
    .map((s) => s.name)
    .join(", ")}). Use the find_pickup tool for exact stops and times.`;
  catalogCache = { at: Date.now(), text };
  return text;
}

function companyKnowledge(): string {
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });
  return `You are the Vista Chase concierge, the AI travel assistant on vistachase.com.
Today is ${today} (Mountain Time, Canmore/Banff).

ABOUT VISTA CHASE
- Canmore-based tour operator for Banff and the Canadian Rockies since 2018. Office: 121 Bow Meadows Crescent #110, Canmore, AB. Phone +1 (825) 734-9456 (lines open 6 a.m. – 9 p.m. Mountain Time), support@vistachase.com.
- TripAdvisor Travellers' Choice Best of the Best 2026: the shared Banff tour ranked #6 experience in Canada. Rated 5.0 from 1,000+ reviews.
- Services: shared small-group tours (max 12 guests), private tours (per vehicle: SUV up to 6, executive van up to 13), Moraine Lake & Lake Louise shuttles, multi-day packages (enquiry), Banff activity tickets (Banff Gondola, Lake Minnewanka cruise, Columbia Icefield Skywalk, Banff Upper Hot Springs; on request).
- Moraine Lake Road is closed to private vehicles; Vista Chase shuttles and tours have guaranteed access. Parks Canada licensed commercial operator.
- Hotel pickup in Banff, Canmore and Lake Louise.

POLICIES
- Cancellation (legal policy): cancel at least 72 hours before departure. Groups of 1–6 get a full refund; groups of 7+ and multi-day trips get everything back except the 20% non-refundable deposit. Within 72 hours: no refund. Late arrivals (10+ minutes) and no-shows are fully charged. Refunds take 5–10 business days. Third-party activities (gondola, cruises, Ice Explorer) follow the provider's rules. Full policy: /cancellation-policy.
- Prices in CAD; GST (5%) is added at checkout.
- Guests can manage bookings at /account/trips and see vouchers at /booking/<reference>/voucher.

HOW TO HELP
- Be warm, concise and specific. Short paragraphs or a few bullets. Plain text, no markdown headings or tables.
- Use the tools for anything about tours, dates, prices, seats, pickups or bookings. Never invent prices, times, availability, booking details or reviews.
- Use web_search / web_fetch for live or general information (weather, road and trail conditions, Parks Canada passes and notices, wildlife, what to pack, things to do, travel logistics). Mention the source briefly.
- Booking: find the tour and date (get_available_dates / check_availability), confirm guests and pickup, then collect the lead guest's name and email. Before calling hold_seats, restate tour, date, time, guests and price and get a clear yes. After the hold, tell them the seats are held for 10 minutes and to finish on the secure checkout link. You cannot take payment or confirm bookings yourself.
- Never ask for or repeat card numbers, CVV or expiry. If someone shares payment details, tell them to use the secure checkout only.
- Looking up, tracking or cancelling a booking needs the booking reference AND the email used to book. Cancel only after the guest clearly confirms, and remind them of the 72-hour policy first.
- Enquiry-only products (custom private tours, multi-day, tickets): explain what's included and point them to the "Request" button on the product page or /contact-us.
- If you can't help, offer the phone number and email above.`;
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
      "Cancel a booking (free up to 72h before departure). Only after the guest explicitly confirmed they want to cancel. Requires reference and booking email.",
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
      const r = await executeAiTool(name === "get_available_dates" ? "getAvailableDates" : "checkBokunAvailability", input, ctx);
      if (!r.success) return { result: { error: r.error } };
      const rows = (r.data as any[]) ?? [];
      const departures = rows.slice(0, 8).map((d) => ({
        id: d.departureId,
        title: d.title ?? d.tourTitle,
        date: d.date,
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
        result: { held: true, expiresAt: hold.expiresAt, checkoutUrl: hold.checkoutUrl, estimatedTotalBeforeGst: total },
        card: {
          checkoutUrl: hold.checkoutUrl,
          data: {
            type: "hold",
            departure: { title: dep?.tour?.title ?? dep?.shuttleRoute?.name, date: dep?.date, departureTime: dep?.departureTime, seats: Number(input.seats), price: total, currency: dep?.currency ?? "CAD" },
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
            date: booking.tourDeparture.date,
            departureTime: booking.tourDeparture.departureTime,
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
                    date: booking.tourDeparture.date,
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
    default: {
      const mapped = STAFF_MAP[name];
      if (!mapped) return { result: { error: `Unknown tool ${name}` } };
      if (!ctx.isStaff) return { result: { error: "Staff sign-in required." } };
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

export async function runConciergeAgent(
  messages: ChatMessage[],
  state: AgentState | undefined,
  ctx: ToolExecutionContext,
  onEvent?: (e: AgentEvent) => void,
): Promise<ConciergeResponse> {
  const sessionState: AgentState = { ...(state ?? {}), memory: [...(state?.memory ?? [])] };
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

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

  const history: Anthropic.MessageParam[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.replace(CARD_NUMBER, "[redacted]") }));
  while (history.length && history[0].role !== "user") history.shift();

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: `${companyKnowledge()}\n\n${await catalogKnowledge()}`, cache_control: { type: "ephemeral" } },
    ...(ctx.isStaff ? [{ type: "text" as const, text: `The user is signed in as staff (${ctx.role}). Staff tools are available.` }] : []),
    ...(sessionState.memory?.length ? [{ type: "text" as const, text: memoryBlock(sessionState) }] : []),
  ];

  const tools: Anthropic.ToolUnion[] = [
    ...CUSTOMER_TOOLS.filter(t => process.env.NODE_ENV !== "production" || !["hold_seats", "cancel_booking"].includes(t.name)),
    ...(ctx.isStaff ? STAFF_TOOLS : []),
    { type: "web_search_20260318", name: "web_search", max_uses: 4, user_location: { type: "approximate", city: "Banff", region: "Alberta", country: "CA", timezone: "America/Edmonton" } },
    { type: "web_fetch_20260318", name: "web_fetch", max_uses: 3 },
  ];

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  let text = "";
  let card: Card = {};
  const sources = new Map<string, string>();

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = anthropic().messages.stream({ model, max_tokens: 2048, system, tools, messages: history });
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
  if (sources.size) {
    const list = [...sources.entries()].slice(0, 3).map(([url, title]) => `• ${title}: ${url}`).join("\n");
    message += `\n\nSources:\n${list}`;
    onEvent?.({ type: "text", text: `\n\nSources:\n${list}` });
  }

  const response: ConciergeResponse = { message, sessionState, data: card.data, checkoutUrl: card.checkoutUrl };
  onEvent?.({ type: "done", response });
  return response;
}
