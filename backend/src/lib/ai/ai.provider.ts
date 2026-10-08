export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ConciergeToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface SessionState {
  stage?:
    | "INQUIRY"
    | "TOUR_SELECTED"
    | "DATE_REQUESTED"
    | "AVAILABILITY_CHECKED"
    | "PICKUP_REQUESTED"
    | "DETAILS_COLLECTED"
    | "REVIEW_SUMMARY"
    | "HOLD_ACTIVE"
    | "PAYMENT_PENDING"
    | "CONFIRMED";
  tourSlug?: string;
  tourTitle?: string;
  departureId?: string;
  date?: string;
  departureTime?: string;
  adults?: number;
  children?: number;
  pickupHotel?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  holdToken?: string;
  holdExpiresAt?: string;
  pricePerPerson?: number;
  totalAmount?: number;
  currency?: string;
  bookingReference?: string;
  voucherCode?: string;
  voucherUrl?: string;
}

export interface ConciergeResponse {
  message: string;
  toolCalls?: ConciergeToolCall[];
  hasSafetyRefusal?: boolean;
  sessionState?: SessionState;
  data?: any;
  checkoutUrl?: string;
}

export interface IAIProvider {
  chat(messages: ChatMessage[], sessionState?: SessionState): Promise<ConciergeResponse>;
}

const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/;

// ---------------------------------------------------------------------------
// Helper entity extractors for conversational voice slot-filling
// ---------------------------------------------------------------------------

function extractTour(text: string): { slug: string; title: string; defaultPrice: number; category: string } | null {
  const lower = text.toLowerCase();
  if (lower.includes("sunrise") || (lower.includes("moraine") && lower.includes("lake louise"))) {
    return {
      slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
      title: "Moraine Lake & Lake Louise Alpine Sunrise Shuttle",
      defaultPrice: 89,
      category: "SHUTTLE",
    };
  }
  if (lower.includes("private") || lower.includes("suv")) {
    if (lower.includes("jasper") || lower.includes("icefield")) {
      return {
        slug: "icefields-jasper-private-tour",
        title: "Icefields Parkway & Jasper Private Tour",
        defaultPrice: 950,
        category: "PRIVATE",
      };
    }
    if (lower.includes("yoho")) {
      return {
        slug: "banff-yoho-custom-private-tour",
        title: "Banff & Yoho National Park Custom Private Tour",
        defaultPrice: 890,
        category: "PRIVATE",
      };
    }
    return {
      slug: "banff-private-tour",
      title: "Luxury Private SUV Tour: Banff & Lake Louise",
      defaultPrice: 850,
      category: "PRIVATE",
    };
  }
  if (lower.includes("highlights") || lower.includes("shared") || lower.includes("lake louise, moraine lake")) {
    return {
      slug: "banff-highlights-tour",
      title: "Lake Louise, Moraine Lake & Banff Highlights Tour",
      defaultPrice: 189,
      category: "SHARED",
    };
  }
  if (lower.includes("moraine") || lower.includes("lake louise")) {
    return {
      slug: "sunrise-shuttle-to-moraine-lake-and-lake-louise",
      title: "Moraine Lake & Lake Louise Alpine Sunrise Shuttle",
      defaultPrice: 89,
      category: "SHUTTLE",
    };
  }
  return null;
}

function extractPartySize(text: string): { adults: number; children: number } | null {
  const lower = text.toLowerCase();

  let adults = 0;
  let children = 0;

  // Word numerals
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };

  const adultWordMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight)\s*(?:adults?|guests?|passengers?|people|persons?)\b/);
  if (adultWordMatch) {
    adults = wordMap[adultWordMatch[1]];
  }

  const adultNumMatch = lower.match(/\b(\d+)\s*(?:adults?|guests?|passengers?|people|persons?)\b/);
  if (adultNumMatch) {
    adults = parseInt(adultNumMatch[1], 10);
  }

  if (adults === 0) {
    if (lower.includes("for two") || lower.includes("two of us") || lower.includes("couple")) {
      adults = 2;
    } else if (lower.includes("for one") || lower.includes("just me") || lower.includes("solo")) {
      adults = 1;
    } else if (lower.includes("party of 4") || lower.includes("family of 4")) {
      adults = 4;
    } else if (lower.includes("party of 3") || lower.includes("family of 3")) {
      adults = 3;
    }
  }

  const childWordMatch = lower.match(/\b(one|two|three|four)\s*(?:children|child|kids?)\b/);
  if (childWordMatch) {
    children = wordMap[childWordMatch[1]];
  }
  const childNumMatch = lower.match(/\b(\d+)\s*(?:children|child|kids?)\b/);
  if (childNumMatch) {
    children = parseInt(childNumMatch[1], 10);
  }

  if (adults > 0 || children > 0) {
    return { adults: Math.max(1, adults), children };
  }
  return null;
}

function extractDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes("tomorrow")) {
    const tmrw = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return tmrw.toISOString().split("T")[0];
  }
  if (lower.includes("today")) {
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("day after tomorrow")) {
    const dAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return dAfter.toISOString().split("T")[0];
  }

  const isoMatch = text.match(/\b202\d-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const monthNames: Record<string, string> = {
    january: "01",
    jan: "01",
    february: "02",
    feb: "02",
    march: "03",
    mar: "03",
    april: "04",
    apr: "04",
    may: "05",
    june: "06",
    jun: "06",
    july: "07",
    jul: "07",
    august: "08",
    aug: "08",
    september: "09",
    sep: "09",
    sept: "09",
    october: "10",
    oct: "10",
    november: "11",
    nov: "11",
    december: "12",
    dec: "12",
  };

  const dateMatch = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dateMatch) {
    const month = monthNames[dateMatch[1]];
    const day = dateMatch[2].padStart(2, "0");
    const year = now.getFullYear();
    return `${year}-${month}-${day}`;
  }

  return null;
}

function extractPickupHotel(text: string): string | null {
  const hotels = [
    "Fairmont Banff Springs Hotel",
    "Fairmont Banff Springs",
    "Banff Caribou Lodge",
    "Moose Hotel & Suites",
    "Moose Hotel",
    "Rimrock Resort Hotel",
    "Rimrock Resort",
    "Coast Canmore Hotel",
    "Mount Royal Hotel",
    "Banff Ptarmigan Inn",
    "Fox Hotel & Suites",
    "Buffalo Mountain Lodge",
    "Canalta Lodge",
    "Rundlestone Lodge",
    "Brewster Mountain Lodge",
    "Elk + Avenue Hotel",
    "High Country Inn",
    "Fairmont Chateau Lake Louise",
    "Lake Louise Inn",
  ];

  const lower = text.toLowerCase();
  for (const hotel of hotels) {
    if (lower.includes(hotel.toLowerCase())) {
      return hotel;
    }
  }

  const stayMatch = text.match(/(?:staying at|pickup at|pick up at|hotel is|at the)\s+([A-Za-z0-9\s&'-]+(?:Hotel|Lodge|Resort|Inn|Suites|Springs)?)/i);
  if (stayMatch && stayMatch[1].trim().length > 3) {
    return stayMatch[1].trim();
  }

  return null;
}

function extractContactInfo(text: string): { name?: string; email?: string; phone?: string } | null {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/);

  let name: string | undefined = undefined;
  const nameMatch = text.match(/(?:my name is|name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    name = nameMatch[1];
  } else if (emailMatch) {
    // Check if format is "Name, email, phone"
    const parts = text.split(/[,;\n]/).map((s) => s.trim());
    if (parts.length >= 2 && !parts[0].includes("@") && !/\d/.test(parts[0])) {
      name = parts[0];
    }
  }

  if (emailMatch || phoneMatch || name) {
    return {
      name,
      email: emailMatch ? emailMatch[0] : undefined,
      phone: phoneMatch ? phoneMatch[0] : undefined,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// MockAIProvider: Intelligent Dialog State Machine for Zero-Cost Voice Assistant
// ---------------------------------------------------------------------------
export class MockAIProvider implements IAIProvider {
  async chat(messages: ChatMessage[], existingState?: SessionState): Promise<ConciergeResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const lower = lastUserMessage.toLowerCase();

    // 1. CRITICAL SAFETY GUARDRAIL: Strict refusal of credit card / payment PII
    if (CREDIT_CARD_REGEX.test(lastUserMessage) || /card|cvv|expire|visa|mastercard|amex/i.test(lastUserMessage)) {
      return {
        message:
          "For your security, the concierge cannot collect or process payment card details. Please don't share them in chat; use our secure checkout link to review and finalize your payment safely.",
        hasSafetyRefusal: true,
      };
    }

    // 2. Accumulate conversational state across multi-turn context
    const state: SessionState = { ...(existingState || {}) };

    // Extract all signals across message history so user never has to repeat
    for (const msg of messages) {
      if (msg.role === "user") {
        const tour = extractTour(msg.content);
        if (tour && !state.tourSlug) {
          state.tourSlug = tour.slug;
          state.tourTitle = tour.title;
          state.pricePerPerson = tour.defaultPrice;
          state.currency = "CAD";
        }

        const party = extractPartySize(msg.content);
        if (party) {
          state.adults = party.adults;
          state.children = party.children;
        }

        const date = extractDate(msg.content);
        if (date) {
          state.date = date;
        }

        const hotel = extractPickupHotel(msg.content);
        if (hotel) {
          state.pickupHotel = hotel;
        }

        const contact = extractContactInfo(msg.content);
        if (contact) {
          if (contact.name && !state.customerName) state.customerName = contact.name;
          if (contact.email && !state.customerEmail) state.customerEmail = contact.email;
          if (contact.phone && !state.customerPhone) state.customerPhone = contact.phone;
        }
      }
    }

    // Re-extract from latest message to allow corrections / interruptions
    const latestTour = extractTour(lastUserMessage);
    if (latestTour) {
      state.tourSlug = latestTour.slug;
      state.tourTitle = latestTour.title;
      state.pricePerPerson = latestTour.defaultPrice;
      state.currency = "CAD";
    }

    const latestParty = extractPartySize(lastUserMessage);
    if (latestParty) {
      state.adults = latestParty.adults;
      state.children = latestParty.children;
    }

    const latestDate = extractDate(lastUserMessage);
    if (latestDate) {
      state.date = latestDate;
    }

    const latestHotel = extractPickupHotel(lastUserMessage);
    if (latestHotel) {
      state.pickupHotel = latestHotel;
    }

    const latestContact = extractContactInfo(lastUserMessage);
    if (latestContact) {
      if (latestContact.name) state.customerName = latestContact.name;
      if (latestContact.email) state.customerEmail = latestContact.email;
      if (latestContact.phone) state.customerPhone = latestContact.phone;
    }

    // 3a. Cancellation / refund questions: the legal 72-hour policy (see /cancellation-policy).
    if (/\b(cancel\w*|refund\w*)\b/.test(lower) && !/\bVC-\d{4}-\w+\b/i.test(lastUserMessage)) {
      return {
        message:
          "Cancel at least 72 hours before your tour for a full refund (groups of 1–6). For groups of 7 or more and multi-day trips, the 20% deposit is non-refundable and the rest is refunded. Within 72 hours, late arrivals and no-shows aren't refunded, and refunds take 5–10 business days. Activity tickets follow the operator's own rules. You can cancel from My trips (/account/trips); the full policy is at /cancellation-policy.",
        toolCalls: [],
        sessionState: state,
      };
    }

    // 3. Check for Live Tracking / ETA inquiries
    if (lower.includes("where is my shuttle") || lower.includes("track") || lower.includes("eta") || lower.includes("status of my ride")) {
      const refMatch = lastUserMessage.match(/\bVC-\d{4}-\w+\b/i) || [state.bookingReference || "VC-2026-98412"];
      const ref = refMatch[0];
      return {
        message: `Your private shuttle (${ref}) is en route! Vehicle: Mercedes-Benz Sprinter Executive #4 with guide Marc. Current status: In Transit to Fairmont Banff Springs Hotel. Estimated arrival in 8 minutes. Live GPS telemetry is active.`,
        toolCalls: [
          {
            name: "getLiveTracking",
            arguments: { tokenOrRef: ref },
          },
          {
            name: "getETA",
            arguments: { tokenOrRef: ref },
          },
        ],
        sessionState: state,
        data: {
          type: "tracking",
          bookingReference: ref,
          estimatedMinutes: 8,
          vehicle: "Mercedes-Benz Sprinter Executive #4",
          driver: "Marc Tremblay",
          licensePlate: "ALBERTA • 7VC-894",
        },
      };
    }

    // 4. Check for Hotel Pickup queries
    if (
      (lower.includes("pickup") || lower.includes("hotel") || lower.includes("where do you pick up")) &&
      !state.customerEmail &&
      !state.holdToken
    ) {
      const hotelQuery = state.pickupHotel || lastUserMessage;
      return {
        message:
          "We offer complimentary round-trip pickups at over 25 premier hotels in Banff, Canmore, and Lake Louise—including Fairmont Banff Springs, Banff Caribou Lodge, Moose Hotel, Rimrock Resort, and Coast Canmore Hotel. Which hotel are you staying at? I can check your exact departure time and shuttle stop.",
        toolCalls: [
          {
            name: "findPickup",
            arguments: { query: hotelQuery },
          },
        ],
        sessionState: state,
      };
    }

    // 5. Booking Flow Step A: General Information on Moraine Lake / Lake Louise
    if (
      (lower.includes("moraine") || lower.includes("lake louise") || lower.includes("shuttle") || lower.includes("parking")) &&
      !state.adults &&
      !state.date &&
      !lower.includes("book")
    ) {
      return {
        message:
          "Private vehicles are prohibited on Moraine Lake Road by Parks Canada, and parking at Lake Louise fills before sunrise. Vista Chase provides guaranteed commercial shuttle access with morning, Sunrise (5:00 AM), and Golden Hour departures. Would you like me to hold seats for your party on an upcoming date?",
        toolCalls: [
          {
            name: "checkAvailability",
            arguments: { destination: "Moraine Lake", query: lastUserMessage },
          },
        ],
        sessionState: state,
      };
    }

    // 6. Booking Flow Step B: User expressed booking intent, but date is missing
    // Specific general hold inquiry: "Please hold 2 seats for me on the morning tour"
    if (lower.includes("please hold") || (lower.includes("hold") && !state.date && !lower.includes("sunrise") && !lower.includes("tomorrow"))) {
      return {
        message:
          "I can gladly place a guaranteed 10-minute reservation hold on those seats for you! As a reminder, I will not take your payment over voice; once the hold is placed, you will receive an instant reservation reference and secure link to complete your checkout.",
        toolCalls: [
          {
            name: "createVoiceReservationHold",
            arguments: { intent: "hold", details: lastUserMessage },
          },
        ],
        sessionState: state,
      };
    }

    // 6. Booking Flow Step B: User expressed booking intent, but date is missing
    if (
      (lower.includes("book") || lower.includes("reserve") || lower.includes("sunrise") || state.tourSlug) &&
      !state.date
    ) {
      state.stage = "DATE_REQUESTED";
      const tourTitle = state.tourTitle || "Moraine Lake & Lake Louise Alpine Sunrise Shuttle";
      const partyText = state.adults ? ` for ${state.adults} adult${state.adults > 1 ? "s" : ""}` : "";
      return {
        message: `I'd love to help you book the ${tourTitle}${partyText}! What date are you planning to travel? We operate daily departures throughout the week (for example, tomorrow or this coming weekend).`,
        toolCalls: [
          {
            name: "getAvailableDates",
            arguments: { tourSlug: state.tourSlug || "sunrise-shuttle-to-moraine-lake-and-lake-louise" },
          },
        ],
        sessionState: state,
      };
    }

    // 7. Booking Flow Step C: Date and party known, check Bókun availability & request pickup
    if (state.tourSlug && state.date && !state.pickupHotel) {
      state.stage = "PICKUP_REQUESTED";
      state.adults = state.adults || 2;
      const totalCost = (state.pricePerPerson || 89) * state.adults;
      state.totalAmount = totalCost;

      return {
        message: `Great news! On ${state.date}, our ${state.tourTitle || "Sunrise Tour"} has seats available at $${
          state.pricePerPerson || 89
        } CAD per person ($${totalCost} CAD total for ${state.adults} adult${
          state.adults > 1 ? "s" : ""
        }). Which hotel are you staying at in Banff or Canmore for your complimentary round-trip pickup?`,
        toolCalls: [
          {
            name: "checkBokunAvailability",
            arguments: { date: state.date, tourSlug: state.tourSlug },
          },
        ],
        sessionState: state,
        data: {
          type: "availability",
          departures: [
            {
              id: "dep-sunrise-1",
              title: state.tourTitle || "Sunrise Shuttle to Moraine Lake",
              date: state.date,
              departureTime: "05:00",
              price: state.pricePerPerson || 89,
              currency: "CAD",
              availableSeats: 8,
            },
          ],
        },
      };
    }

    // 8. Booking Flow Step D: Pickup known, collect guest contact details
    if (state.tourSlug && state.date && state.pickupHotel && (!state.customerName || !state.customerEmail)) {
      state.stage = "DETAILS_COLLECTED";
      return {
        message: `Perfect! We offer direct door-to-door pickup at ${state.pickupHotel}. To place your guaranteed 10-minute seat hold, could you please provide your full name, email address, and mobile phone number?`,
        toolCalls: [
          {
            name: "findPickup",
            arguments: { query: state.pickupHotel },
          },
        ],
        sessionState: state,
      };
    }

    // 9. Booking Flow Step E: Confirmation & Digital Voucher (checked before review summary when payment complete)
    if (
      lower.includes("payment complete") ||
      lower.includes("confirm booking") ||
      lower.includes("i have paid") ||
      lower.includes("completed payment") ||
      lower.includes("confirm my booking")
    ) {
      state.stage = "CONFIRMED";
      const ref = `VC-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      state.bookingReference = ref;
      state.voucherCode = `VC-BK-${ref.slice(-5)}`;
      state.voucherUrl = `/booking/${ref}/voucher`;

      return {
        message: `Congratulations, ${state.customerName || "traveler"}! Your reservation is officially confirmed under reference #${ref}. Your digital boarding pass and QR code voucher are ready. We have also registered your mobile number for WhatsApp live tracking 60 minutes before departure.`,
        toolCalls: [
          {
            name: "confirmVoiceBooking",
            arguments: {
              departureId: state.departureId || "cmutg855l000x12b4p2hcywbj",
              holdToken: state.holdToken,
              customerName: state.customerName || "David Miller",
              customerEmail: state.customerEmail || "david@example.com",
              customerPhone: state.customerPhone || "+1-825-734-9456",
              pickupLocation: state.pickupHotel || "Fairmont Banff Springs Hotel",
              adultsCount: state.adults || 2,
            },
          },
        ],
        sessionState: state,
        data: {
          type: "confirmed",
          bookingReference: ref,
          voucherCode: state.voucherCode,
          voucherUrl: state.voucherUrl,
          tourTitle: state.tourTitle,
          date: state.date,
          pickup: state.pickupHotel,
        },
      };
    }

    // 10. Booking Flow Step F: All details collected -> Review Summary & 10-minute hold placement
    if (
      state.tourSlug &&
      state.date &&
      state.pickupHotel &&
      state.customerName &&
      state.customerEmail &&
      !state.bookingReference
    ) {
      state.stage = "REVIEW_SUMMARY";
      state.adults = state.adults || 2;
      const total = (state.pricePerPerson || 89) * state.adults;
      state.totalAmount = total;
      state.departureId = state.departureId || "cmutg855l000x12b4p2hcywbj";
      state.departureTime = state.departureTime || "05:00";
      const holdToken = state.holdToken || `hold_vc_${Date.now()}`;
      state.holdToken = holdToken;

      const checkoutUrl = `/book?departureId=${encodeURIComponent(state.departureId)}&holdToken=${encodeURIComponent(
        holdToken
      )}&guests=${encodeURIComponent(state.adults)}`;

      return {
        message: `Here is your booking summary:\n• Experience: ${state.tourTitle}\n• Date & Time: ${state.date} at ${state.departureTime} AM\n• Pickup Location: ${state.pickupHotel}\n• Guest: ${state.customerName} (${state.adults} Adults)\n• Total Amount: $${total}.00 CAD\n\nI have placed a guaranteed 10-minute reservation hold on your seats. As a reminder, I will not take your payment over voice; please tap the secure checkout link below to finalize payment safely.`,
        toolCalls: [
          {
            name: "createVoiceReservationHold",
            arguments: {
              departureId: state.departureId,
              seatsCount: state.adults,
              customerName: state.customerName,
              customerEmail: state.customerEmail,
              customerPhone: state.customerPhone || "+1-825-734-9456",
            },
          },
          {
            name: "createVoiceBookingPaymentIntent",
            arguments: {
              departureId: state.departureId,
              holdToken,
              seatsCount: state.adults,
              customerName: state.customerName,
              customerEmail: state.customerEmail,
              customerPhone: state.customerPhone,
              pickupLocation: state.pickupHotel,
            },
          },
        ],
        checkoutUrl,
        sessionState: state,
        data: {
          type: "hold",
          departure: {
            title: state.tourTitle,
            date: state.date,
            departureTime: state.departureTime,
            seats: state.adults,
            pickup: state.pickupHotel,
            price: total,
            currency: "CAD",
          },
        },
      };
    }

    // 11. General welcoming fallback
    return {
      message:
        "Hello and welcome to Vista Chase Canadian Rockies Concierge! I'm here to help you plan an unforgettable journey to Banff, Moraine Lake, Lake Louise, and Jasper. Would you like help with guaranteed shuttles, private SUV tours, finding your hotel pickup, or placing a reservation hold?",
      sessionState: state,
    };
  }
}

class GeminiAIProvider implements IAIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[], sessionState?: SessionState): Promise<ConciergeResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    // Critical safety check before sending to LLM
    if (CREDIT_CARD_REGEX.test(lastUserMessage)) {
      return {
        message:
          "For your security, the concierge cannot collect or process payment card details. Please don't share them in chat; use our secure checkout link to review and finalize your payment safely.",
        hasSafetyRefusal: true,
      };
    }

    // In dev / fallback mode or when provider is mock, use deterministic dialog state machine
    const fallback = new MockAIProvider();
    return fallback.chat(messages, sessionState);
  }
}

let aiInstance: IAIProvider | null = null;

export function getAIProvider(): IAIProvider {
  if (aiInstance) return aiInstance;

  const providerType = process.env.AI_VOICE_PROVIDER || "mock";
  if (providerType === "gemini" && process.env.GEMINI_API_KEY) {
    aiInstance = new GeminiAIProvider(process.env.GEMINI_API_KEY);
  } else {
    aiInstance = new MockAIProvider();
  }
  return aiInstance;
}
