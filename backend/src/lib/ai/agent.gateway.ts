import Anthropic from "@anthropic-ai/sdk";
import { getMasterKnowledgeBase } from "./knowledge.sync";
import { agentToolExecutor } from "./agent.tools.registry";
import type {
  AgentChatMessage,
  AgentEventPayload,
  SessionContext,
} from "./agent.types";

export const CARD_NUMBER_REGEX = /\b(?:\d[ -]*?){13,19}\b/;
const MAX_ITERATIONS = 5;

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "dummy_key_for_dev",
    });
  }
  return anthropicClient;
}

/**
 * Returns current date and time formatted in Canada/Mountain time (MST/MDT).
 */
export function getMountainTimeContext(): {
  iso: string;
  timeString: string;
  isWinterSeason: boolean;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formatted = formatter.format(now);
  const month = parseInt(formatted.slice(5, 7), 10);
  const isWinterSeason = month >= 10 || month <= 5; // mid-Oct to May

  return {
    iso: now.toISOString(),
    timeString: `${formatted} MST/MDT`,
    isWinterSeason,
  };
}

export class AgentExecutionGateway {
  /**
   * Main Agent Orchestration Loop adhering strictly to the 4-layer Prompt & Cache Hierarchy.
   */
  async runAgenticLoop(
    messages: AgentChatMessage[],
    session: SessionContext,
    onEvent?: (event: AgentEventPayload) => void
  ): Promise<{ reply: string; lastCard?: unknown }> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // 1. Deterministic Security Pre-filter: Reject card numbers before LLM
    if (CARD_NUMBER_REGEX.test(lastUserMessage)) {
      const refusal =
        "Security Notice: Please never type credit card numbers or payment details into the chat. Payment is captured deterministically and securely through our embedded Stripe checkout element.";
      onEvent?.({ type: "text", text: refusal });
      onEvent?.({ type: "done", text: refusal });
      return { reply: refusal };
    }

    // 2. Filter available tools based on out-of-band verified session role
    const allowedToolDefs = agentToolExecutor.getFilteredToolsForSession(session);

    // Convert to Anthropic ToolUnion structure with cache breakpoint on the LAST tool
    const anthropicTools: Anthropic.ToolUnion[] = allowedToolDefs.map((tool, idx) => {
      const isLastTool = idx === allowedToolDefs.length - 1;
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        ...(isLastTool ? { cache_control: { type: "ephemeral" } } : {}),
      };
    });

    // 3. Construct Layer 1: Prompt & Cache Hierarchy
    // BLOCK 2: Static Knowledge Base with cache_control: {"type": "ephemeral"}
    const mountainTime = getMountainTimeContext();
    const moraineStatus = mountainTime.isWinterSeason
      ? "CLOSED for winter season (mid-October through late May)."
      : "OPEN for summer commercial access.";

    // BLOCK 3: Dynamic Session Context (Uncached Tail ~50 tokens)
    const dynamicSessionBlock = `
=== DYNAMIC SERVER & SESSION CONTEXT ===
- Live Server Time: ${mountainTime.timeString}
- Moraine Lake Road Status: ${moraineStatus}
- Verified Session Role: ${session.role}
- Verified User ID: ${session.userId || "GUEST"}
- Authorized PNR Context: ${session.authorizedPnr || "NONE"}
========================================`;

    const masterKnowledgeBase = await getMasterKnowledgeBase();

    const systemPrompt: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: masterKnowledgeBase,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: dynamicSessionBlock,
      },
    ];

    // Sanitize conversation history
    const history: Anthropic.MessageParam[] = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
      .slice(-16)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.replace(CARD_NUMBER_REGEX, "[redacted]"),
      }));

    while (history.length && history[0].role !== "user") {
      history.shift();
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
    let aggregatedReply = "";
    let activeCard: unknown = null;

    // Agentic Tool Loop
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      onEvent?.({ type: "status", text: iteration === 0 ? "Analyzing request…" : "Reasoning next step…" });

      let stream;
      try {
        stream = getAnthropicClient().messages.stream({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          tools: anthropicTools,
          messages: history,
        });
      } catch (clientErr) {
        // If Anthropic SDK or API key isn't active in dev, provide a simulated graceful completion
        console.warn("[AgentExecutionGateway] API call exception, fallback:", clientErr);
        const fallbackText = "Our Vistachase concierge is ready to assist you with tour discovery, atomic seat holds, and reservations.";
        onEvent?.({ type: "text", text: fallbackText });
        return { reply: fallbackText };
      }

      stream.on("text", (delta) => {
        aggregatedReply += delta;
        onEvent?.({ type: "text", text: delta });
      });

      const message = await stream.finalMessage();
      history.push({ role: "assistant", content: message.content });

      // Stop if model didn't ask for a tool
      if (message.stop_reason !== "tool_use") {
        break;
      }

      // Execute each requested tool deterministically via AgentToolExecutor
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== "tool_use") continue;

        onEvent?.({ type: "status", text: `Executing ${block.name.replace(/_/g, " ")}…` });

        try {
          const outcome = await agentToolExecutor.execute(
            block.name,
            block.input as Record<string, any>,
            session
          );

          if (outcome.card) {
            activeCard = outcome.card;
            onEvent?.({ type: "card", card: outcome.card });
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(outcome.data),
          });
        } catch (toolErr: any) {
          console.error(`[AgentExecutionGateway] Tool ${block.name} failed:`, toolErr);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: toolErr?.message || "Tool execution failed" }),
            is_error: true,
          });
        }
      }

      history.push({ role: "user", content: toolResults });
    }

    const finalReply =
      aggregatedReply.trim() ||
      history
        .filter((m) => m.role === "assistant")
        .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
        .filter((b) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n\n");

    onEvent?.({ type: "done", text: finalReply, card: activeCard });
    return { reply: finalReply, lastCard: activeCard };
  }
}

export const agentGateway = new AgentExecutionGateway();
