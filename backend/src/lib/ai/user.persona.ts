/**
 * @file user.persona.ts
 * Dynamic User Persona & Knowledge Graph engine for Vistachase AI Concierge.
 * Extracts traveler signals, maintains an evolving knowledge graph,
 * and formats personalized context for Claude Sonnet 5.5.
 */

export interface UserPersona {
  travelerType?: "solo" | "couple" | "family" | "seniors" | "friends" | "corporate";
  partySize?: number;
  hasKids?: boolean;
  kidsAges?: string;
  lodgingLocation?: string;
  lodgingTown?: "Banff" | "Canmore" | "Lake Louise" | "Calgary" | "Other";
  travelDates?: string;
  season?: "summer" | "winter" | "shoulder";
  activityPreference?: "relaxed" | "moderate" | "avid_hiker" | "photography" | "scenic_drive";
  productPreference?: "shared_tour" | "private_charter" | "shuttle";
  budgetTier?: "value" | "standard" | "luxury";
  interests?: string[];
  tonePreference?: "witty_and_playful" | "direct_and_concise" | "warm_and_detailed";
  humorAppreciation?: boolean;
  specialRequests?: string[];
}

export interface KnowledgeGraphEntity {
  id: string;
  type: "Traveler" | "Party" | "Destination" | "Lodging" | "Activity" | "Tour" | "Preference" | "Restriction";
  label: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  from: string;
  relation: "TRAVELS_WITH" | "STAYING_AT" | "INTERESTED_IN" | "VISITING_ON" | "PREFERS" | "REQUESTED" | "BOOKED";
  to: string;
}

export interface UserKnowledgeGraph {
  entities: KnowledgeGraphEntity[];
  edges: KnowledgeGraphEdge[];
  lastUpdated: string;
}

/**
 * Extracts traveler persona traits and updates the Knowledge Graph from conversation messages.
 */
export function extractAndEvolvePersona(
  currentPersona: UserPersona = {},
  currentGraph: UserKnowledgeGraph = { entities: [], edges: [], lastUpdated: new Date().toISOString() },
  messages: Array<{ role: string; content: string }>,
  sessionMemory: string[] = [],
): { persona: UserPersona; graph: UserKnowledgeGraph } {
  const persona: UserPersona = { ...currentPersona };
  const entitiesMap = new Map<string, KnowledgeGraphEntity>(
    currentGraph.entities.map((e) => [e.id, e]),
  );
  const edges: KnowledgeGraphEdge[] = [...currentGraph.edges];

  // Base traveler node
  if (!entitiesMap.has("user")) {
    entitiesMap.set("user", { id: "user", type: "Traveler", label: "Current Guest" });
  }

  // Combine recent user text
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  // 1. Party Size & Group Composition
  const partyMatch =
    userMessages.match(/(?:family|party|group)\s+of\s+(\d+)/i) ||
    userMessages.match(/(\d+)\s*(?:people|guests|adults|passengers|of us|tickets|seats)/i);
  if (partyMatch) {
    const size = parseInt(partyMatch[1], 10);
    if (!isNaN(size) && size > 0 && size < 40) {
      persona.partySize = size;
      if (size === 1) persona.travelerType = "solo";
      else if (size === 2 && !userMessages.includes("kid") && !userMessages.includes("child")) {
        persona.travelerType = "couple";
      }
    }
  }

  if (/\b(kids|children|toddler|baby|infant|son|daughter|family)\b/i.test(userMessages)) {
    persona.travelerType = "family";
    persona.hasKids = true;
    const kidsAgeMatch = userMessages.match(/kids?\s*(?:are|aged?)\s*([0-9\s,and]+)/i);
    if (kidsAgeMatch) {
      persona.kidsAges = kidsAgeMatch[1].trim();
    }
    const partyId = "party_family";
    entitiesMap.set(partyId, { id: partyId, type: "Party", label: `Family${persona.partySize ? ` of ${persona.partySize}` : ""}` });
    if (!edges.some((e) => e.from === "user" && e.to === partyId)) {
      edges.push({ from: "user", relation: "TRAVELS_WITH", to: partyId });
    }
  }

  if (/\b(parents|seniors|grandparents|elderly|mobility|trouble walking)\b/i.test(userMessages)) {
    persona.travelerType = "seniors";
    persona.activityPreference = "relaxed";
    entitiesMap.set("pref_relaxed", { id: "pref_relaxed", type: "Preference", label: "Senior-Friendly / Minimal Walking" });
    if (!edges.some((e) => e.from === "user" && e.to === "pref_relaxed")) {
      edges.push({ from: "user", relation: "PREFERS", to: "pref_relaxed" });
    }
  }

  // 2. Hotel / Lodging Detection
  const hotelMatches = [
    { pattern: /\b(fairmont\s*banff\s*springs|banff\s*springs)\b/i, label: "Fairmont Banff Springs", town: "Banff" as const },
    { pattern: /\b(chateau\s*lake\s*louise)\b/i, label: "Fairmont Chateau Lake Louise", town: "Lake Louise" as const },
    { pattern: /\b(rimrock)\b/i, label: "The Rimrock Resort Hotel", town: "Banff" as const },
    { pattern: /\b(moose\s*hotel)\b/i, label: "Moose Hotel & Suites", town: "Banff" as const },
    { pattern: /\b(banff\s*ptarmigan|ptarmigan)\b/i, label: "Banff Ptarmigan Inn", town: "Banff" as const },
    { pattern: /\b(canmore|solara|blackstone|malcolm)\b/i, label: "Canmore Hotel / Condo", town: "Canmore" as const },
    { pattern: /\b(lake\s*louise\s*inn)\b/i, label: "Lake Louise Inn", town: "Lake Louise" as const },
  ];

  for (const h of hotelMatches) {
    if (h.pattern.test(userMessages)) {
      persona.lodgingLocation = h.label;
      persona.lodgingTown = h.town;
      const hotelId = `hotel_${h.label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      entitiesMap.set(hotelId, { id: hotelId, type: "Lodging", label: h.label, metadata: { town: h.town, doorstepPickup: true } });
      if (!edges.some((e) => e.from === "user" && e.to === hotelId)) {
        edges.push({ from: "user", relation: "STAYING_AT", to: hotelId });
      }
      break;
    }
  }

  // 3. Travel Dates & Season
  const monthMatches = userMessages.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (monthMatches) {
    persona.travelDates = monthMatches[0];
    const month = monthMatches[0].toLowerCase();
    if (["june", "july", "august", "september"].includes(month)) {
      persona.season = "summer";
    } else if (["november", "december", "january", "february", "march", "april"].includes(month)) {
      persona.season = "winter";
    } else {
      persona.season = "shoulder";
    }
  }

  // 4. Interests & Destinations
  const interestChecks = [
    { key: "Moraine Lake Sunrise", regex: /\b(moraine\s*lake|sunrise\s*shuttle|ten\s*peaks)\b/i, type: "Destination" as const },
    { key: "Lake Louise", regex: /\b(lake\s*louise|victoria\s*glacier)\b/i, type: "Destination" as const },
    { key: "Columbia Icefield & Glacier", regex: /\b(icefield|athabasca\s*glacier|skywalk|peyto)\b/i, type: "Destination" as const },
    { key: "Yoho & Emerald Lake", regex: /\b(yoho|emerald\s*lake|natural\s*bridge|takakkaw)\b/i, type: "Destination" as const },
    { key: "Wildlife Spotting", regex: /\b(bears?|grizzly|elk|moose|bighorn|wildlife)\b/i, type: "Activity" as const },
    { key: "Photography", regex: /\b(photo|photography|camera|tripod|viewpoint|instagram|pictures)\b/i, type: "Activity" as const },
  ];

  persona.interests = persona.interests || [];
  for (const item of interestChecks) {
    if (item.regex.test(userMessages) && !persona.interests.includes(item.key)) {
      persona.interests.push(item.key);
      const entityId = `entity_${item.key.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      entitiesMap.set(entityId, { id: entityId, type: item.type, label: item.key });
      if (!edges.some((e) => e.from === "user" && e.to === entityId)) {
        edges.push({ from: "user", relation: "INTERESTED_IN", to: entityId });
      }
    }
  }

  // 5. Tone & Humor Appreciation
  if (/\b(haha|lol|funny|joke|hilarious|bear spray body spray|ride an elk|gatorade|kool-aid|smile)\b/i.test(userMessages)) {
    persona.humorAppreciation = true;
    persona.tonePreference = "witty_and_playful";
  } else if (/\b(quick|just give me|only the price|bullet points|concise)\b/i.test(userMessages)) {
    persona.tonePreference = "direct_and_concise";
  } else {
    persona.tonePreference = persona.tonePreference || "warm_and_detailed";
  }

  // 6. Integrate session memory from confirmed tools
  for (const mem of sessionMemory) {
    if (mem.includes("Verified booking") || mem.includes("Held seats")) {
      const match = mem.match(/\b([A-Z0-9]{6,8})\b/);
      if (match) {
        const bookId = `booking_${match[1]}`;
        entitiesMap.set(bookId, { id: bookId, type: "Tour", label: `Booking/Hold ${match[1]}`, metadata: { raw: mem } });
        if (!edges.some((e) => e.from === "user" && e.to === bookId)) {
          edges.push({ from: "user", relation: "BOOKED", to: bookId });
        }
      }
    }
  }

  return {
    persona,
    graph: {
      entities: Array.from(entitiesMap.values()),
      edges,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Formats the User Persona and Knowledge Graph into a rich context block for Claude.
 */
export function formatPersonaContextForPrompt(persona?: UserPersona, graph?: UserKnowledgeGraph): string {
  if (!persona && (!graph || graph.entities.length <= 1)) {
    return "";
  }

  const p = persona || {};
  const g = graph || { entities: [], edges: [], lastUpdated: "" };

  const lines: string[] = ["=== ACTIVE TRAVELER PERSONA & KNOWLEDGE GRAPH ==="];

  if (p.travelerType) {
    const partyStr = p.partySize ? ` (${p.partySize} guests)` : "";
    const kidsStr = p.hasKids ? ` with children${p.kidsAges ? ` (ages: ${p.kidsAges})` : ""}` : "";
    lines.push(`• Traveler Profile: ${p.travelerType.toUpperCase()}${partyStr}${kidsStr}`);
  }

  if (p.lodgingLocation) {
    lines.push(`• Lodging: ${p.lodgingLocation}${p.lodgingTown ? ` in ${p.lodgingTown}` : ""} (Qualifies for doorstep pickup)`);
  }

  if (p.travelDates || p.season) {
    lines.push(`• Travel Timing: ${p.travelDates || "Upcoming"} (${p.season || "summer"} season)`);
  }

  if (p.interests && p.interests.length > 0) {
    lines.push(`• Stated Interests: ${p.interests.join(", ")}`);
  }

  if (p.activityPreference) {
    lines.push(`• Activity Level: ${p.activityPreference}`);
  }

  if (p.tonePreference) {
    lines.push(`• Conversational Tone: ${p.tonePreference.replace(/_/g, " ")}${p.humorAppreciation ? " (Enjoys witty Canadian Rockies banter and lighthearted humor)" : ""}`);
  }

  // Knowledge Graph Relationship summary
  if (g.edges && g.edges.length > 0) {
    lines.push("• Knowledge Graph Nodes:");
    for (const edge of g.edges.slice(0, 6)) {
      const fromNode = g.entities.find((e) => e.id === edge.from)?.label || edge.from;
      const toNode = g.entities.find((e) => e.id === edge.to)?.label || edge.to;
      lines.push(`  - [${fromNode}] --(${edge.relation})--> [${toNode}]`);
    }
  }

  lines.push("PERSONALIZATION DIRECTIVE: You already know this traveler! Do NOT re-ask for party size, hotel, or dates if stated above. Seamlessly reference their hotel for pickup, customize itinerary pacing for their party, and match their preferred conversational tone.");

  return `\n\n${lines.join("\n")}\n`;
}
