import { describe, it, expect } from "vitest";
import {
  extractAndEvolvePersona,
  formatPersonaContextForPrompt,
  type UserPersona,
  type UserKnowledgeGraph,
} from "../src/lib/ai/user.persona";

describe("User Persona & Knowledge Graph Extraction Engine", () => {
  it("extracts family traveler type with kid ages and party size", () => {
    const messages = [
      { role: "user", content: "Hi! We are a family of 4 looking to visit Banff. We have two kids aged 8 and 11." },
    ];

    const { persona, graph } = extractAndEvolvePersona({}, undefined, messages);

    expect(persona.travelerType).toBe("family");
    expect(persona.hasKids).toBe(true);
    expect(persona.partySize).toBe(4);
    expect(persona.kidsAges).toBe("8 and 11");

    // Check knowledge graph nodes and edges
    const partyNode = graph.entities.find((e) => e.type === "Party");
    expect(partyNode).toBeDefined();
    expect(partyNode?.label).toContain("Family of 4");

    const travelsWithEdge = graph.edges.find((e) => e.relation === "TRAVELS_WITH");
    expect(travelsWithEdge).toBeDefined();
    expect(travelsWithEdge?.from).toBe("user");
  });

  it("identifies hotel lodging and tags doorstep pickup qualification", () => {
    const messages = [
      { role: "user", content: "We are staying at the Fairmont Banff Springs hotel. Does your tour pick us up there?" },
    ];

    const { persona, graph } = extractAndEvolvePersona({}, undefined, messages);

    expect(persona.lodgingLocation).toBe("Fairmont Banff Springs");
    expect(persona.lodgingTown).toBe("Banff");

    const hotelNode = graph.entities.find((e) => e.type === "Lodging");
    expect(hotelNode).toBeDefined();
    expect(hotelNode?.label).toBe("Fairmont Banff Springs");

    const stayingAtEdge = graph.edges.find((e) => e.relation === "STAYING_AT");
    expect(stayingAtEdge).toBeDefined();
  });

  it("recognizes humor appreciation and playful mountain wit tone preference", () => {
    const messages = [
      { role: "user", content: "Haha that's hilarious! Can I pet the fluffy cows or ride an elk in Banff lol?" },
    ];

    const { persona } = extractAndEvolvePersona({}, undefined, messages);

    expect(persona.humorAppreciation).toBe(true);
    expect(persona.tonePreference).toBe("witty_and_playful");
  });

  it("extracts destinations and activities into the knowledge graph", () => {
    const messages = [
      { role: "user", content: "We really want to see the Moraine Lake sunrise and do some photography." },
    ];

    const { persona, graph } = extractAndEvolvePersona({}, undefined, messages);

    expect(persona.interests).toContain("Moraine Lake Sunrise");
    expect(persona.interests).toContain("Photography");

    const destNode = graph.entities.find((e) => e.label === "Moraine Lake Sunrise");
    expect(destNode).toBeDefined();

    const edge = graph.edges.find((e) => e.to === destNode?.id);
    expect(edge?.relation).toBe("INTERESTED_IN");
  });

  it("formats rich persona context block ready for Claude prompt injection", () => {
    const persona: UserPersona = {
      travelerType: "family",
      partySize: 4,
      hasKids: true,
      kidsAges: "7 and 10",
      lodgingLocation: "Fairmont Banff Springs",
      lodgingTown: "Banff",
      travelDates: "July",
      season: "summer",
      interests: ["Moraine Lake Sunrise", "Wildlife Spotting"],
      tonePreference: "witty_and_playful",
      humorAppreciation: true,
    };

    const graph: UserKnowledgeGraph = {
      entities: [
        { id: "user", type: "Traveler", label: "Guest" },
        { id: "hotel", type: "Lodging", label: "Fairmont Banff Springs" },
      ],
      edges: [{ from: "user", relation: "STAYING_AT", to: "hotel" }],
      lastUpdated: new Date().toISOString(),
    };

    const promptContext = formatPersonaContextForPrompt(persona, graph);

    expect(promptContext).toContain("=== ACTIVE TRAVELER PERSONA & KNOWLEDGE GRAPH ===");
    expect(promptContext).toContain("FAMILY (4 guests) with children (ages: 7 and 10)");
    expect(promptContext).toContain("Fairmont Banff Springs in Banff");
    expect(promptContext).toContain("witty and playful (Enjoys witty Canadian Rockies banter and lighthearted humor)");
    expect(promptContext).toContain("Do NOT re-ask for party size, hotel, or dates if stated above");
  });
});
