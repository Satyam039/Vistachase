// Shared types for the AI concierge. The concierge itself is concierge.agent.ts (Claude, when
// ANTHROPIC_API_KEY is set) or concierge.fallback.ts (answers from the booking data only).

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
