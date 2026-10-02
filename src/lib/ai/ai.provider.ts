export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ConciergeToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ConciergeResponse {
  message: string;
  toolCalls?: ConciergeToolCall[];
  hasSafetyRefusal?: boolean;
}

export interface IAIProvider {
  chat(messages: ChatMessage[]): Promise<ConciergeResponse>;
}

const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/;

export class MockAIProvider implements IAIProvider {
  async chat(messages: ChatMessage[]): Promise<ConciergeResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    // CRITICAL SAFETY CHECK: Refuse card details immediately
    if (CREDIT_CARD_REGEX.test(lastUserMessage) || /card|cvv|expire|visa|mastercard|amex/i.test(lastUserMessage)) {
      return {
        message: "For your security and privacy, our Voice Concierge cannot collect or process payment card details. I have reserved your seats under a 10-minute hold. Please use our secure checkout link to review and finalize your payment safely.",
        hasSafetyRefusal: true,
      };
    }

    const lower = lastUserMessage.toLowerCase();

    // Check for pickup query
    if (lower.includes("pickup") || lower.includes("hotel") || lower.includes("where do you pick up")) {
      return {
        message: "We offer complimentary round-trip pickups at over 25 premier hotels in Banff, Canmore, and Lake Louise—including Fairmont Banff Springs, Banff Caribou Lodge, Moose Hotel, Rimrock Resort, and Coast Canmore Hotel. Which hotel are you staying at? I can check your exact departure time and shuttle stop.",
        toolCalls: [
          {
            name: "findPickup",
            arguments: { query: lastUserMessage },
          },
        ],
      };
    }

    // Check for Moraine Lake / Lake Louise access & shuttles
    if (lower.includes("moraine") || lower.includes("lake louise") || lower.includes("shuttle") || lower.includes("parking")) {
      return {
        message: "Private vehicles are prohibited on Moraine Lake Road by Parks Canada, and parking at Lake Louise fills before sunrise. Vista Chase provides guaranteed commercial shuttle access with morning, Sunrise (5:00 AM), and Golden Hour departures. Would you like me to hold seats for your party on an upcoming date?",
        toolCalls: [
          {
            name: "checkAvailability",
            arguments: { destination: "Moraine Lake", query: lastUserMessage },
          },
        ],
      };
    }

    // Check for private tour / customized
    if (lower.includes("private") || lower.includes("custom") || lower.includes("suv") || lower.includes("family")) {
      return {
        message: "Our Luxury Private SUV Tours are fully customizable for up to 5-7 guests. You enjoy a private local guide, door-to-door hotel pickup, customized stops (including Emerald Lake, Bow Lake, Peyto Lake, and Icefields Parkway), plus guaranteed Moraine Lake access without crowds. What dates work best for you?",
      };
    }

    // Check for booking / reservation hold request
    if (lower.includes("book") || lower.includes("reserve") || lower.includes("hold") || lower.includes("tickets")) {
      return {
        message: "I can gladly place a guaranteed 10-minute reservation hold on those seats for you! As a reminder, I will not take your payment over voice; once the hold is placed, you will receive an instant reservation reference and secure link to complete your checkout.",
        toolCalls: [
          {
            name: "createVoiceReservationHold",
            arguments: { intent: "hold", details: lastUserMessage },
          },
        ],
      };
    }

    // General welcoming response
    return {
      message: "Hello and welcome to Vista Chase Canadian Rockies Concierge! I'm here to help you plan an unforgettable journey to Banff, Moraine Lake, Lake Louise, and Jasper. Would you like help with guaranteed shuttles, private SUV tours, finding your hotel pickup, or placing a reservation hold?",
    };
  }
}

class GeminiAIProvider implements IAIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[]): Promise<ConciergeResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    // Critical safety check before sending to LLM
    if (CREDIT_CARD_REGEX.test(lastUserMessage)) {
      return {
        message: "For your security and privacy, our Voice Concierge cannot collect or process payment card details. I have reserved your seats under a 10-minute hold. Please use our secure checkout link to review and finalize your payment safely.",
        hasSafetyRefusal: true,
      };
    }

    // In dev / fallback mode, use deterministic mock
    const fallback = new MockAIProvider();
    return fallback.chat(messages);
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
