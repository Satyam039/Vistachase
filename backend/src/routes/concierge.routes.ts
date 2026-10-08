import { Router } from "express";
import { getAIProvider, ChatMessage } from "@/lib/ai/ai.provider";
import { executeAiTool } from "@/lib/ai/ai.tools";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { isClaudeConfigured, runConciergeAgent } from "@/lib/ai/concierge.agent";
import type { Request, Response, NextFunction } from "express";

const router = Router();

// Simple per-IP limit so the AI model can't be run up: 30 messages per 10 minutes.
const WINDOW_MS = 10 * 60_000;
const LIMIT = 30;
const hits = new Map<string, number[]>();
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    return res.status(429).json({ error: "You're sending messages quickly. Please wait a few minutes and try again." });
  }
  recent.push(now);
  hits.set(key, recent);
  next();
}

function staffContext(req: Request) {
  const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
  return { isStaff: !!staff, role: staff?.role, userEmail: staff?.email };
}

// POST /api/concierge/stream: Server-Sent Events. Events: status (what the agent is doing),
// text (reply deltas), done (final payload: message, cards, sessionState), error.
router.post("/stream", rateLimit, async (req, res) => {
  const messages: ChatMessage[] = req.body?.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid messages array." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    if (isClaudeConfigured()) {
      await runConciergeAgent(messages, req.body?.sessionState, staffContext(req), (e) => {
        if (e.type === "text") send("text", { text: e.text });
        else if (e.type === "status") send("status", { text: e.text });
        else send("done", { success: true, ...e.response });
      });
    } else {
      // No AI key configured: the scripted assistant answers in one piece.
      const response = await getAIProvider().chat(messages, req.body?.sessionState);
      const ctx = staffContext(req);
      for (const call of response.toolCalls ?? []) await executeAiTool(call.name, call.arguments, ctx);
      send("text", { text: response.message });
      send("done", { success: true, ...response, toolCalls: undefined });
    }
  } catch (error) {
    console.error("Concierge stream error:", error);
    send("error", { error: "The concierge is unavailable right now. Please try again, or call +1 (825) 734-9456." });
  } finally {
    res.end();
  }
});

// POST /api/concierge (Chat interaction with safety refusal & tool execution)
router.post("/", rateLimit, async (req, res) => {
  try {
    const messages: ChatMessage[] = req.body?.messages || [];
    const sessionState = req.body?.sessionState;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages array." });
    }

    // Real AI agent when an Anthropic key is configured (tools run inside the agent loop).
    if (isClaudeConfigured()) {
      const response = await runConciergeAgent(messages, sessionState, staffContext(req));
      return res.json({ success: true, ...response, toolCalls: [], toolResults: [] });
    }

    const aiProvider = getAIProvider();

    // 1. Send chat to AI provider (with built-in credit card refusal guardrail)
    const response = await aiProvider.chat(messages, sessionState);

    const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
    const toolContext = {
      isStaff: !!staff,
      role: staff?.role,
      userEmail: staff?.email,
    };

    let toolExecutionResults: any[] = [];

    // 2. Safely execute validated backend tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const call of response.toolCalls) {
        const result = await executeAiTool(call.name, call.arguments, toolContext);
        toolExecutionResults.push(result);
      }
    }

    // 3. Surface pickup search results as the "pickups" card when the provider sent no card of its own
    let data = response.data;
    const pickupResult = toolExecutionResults.find(
      (r) => (r.toolName === "findPickup" || r.toolName === "getPickup") && r.success && Array.isArray(r.data),
    );
    if (!data && pickupResult && pickupResult.data.length > 0) {
      data = {
        type: "pickups",
        stops: pickupResult.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          town: s.town,
          address: s.address,
          instructions: s.instructions,
        })),
      };
    }

    return res.json({
      success: true,
      message: response.message,
      hasSafetyRefusal: response.hasSafetyRefusal || false,
      toolCalls: response.toolCalls || [],
      toolResults: toolExecutionResults,
      sessionState: response.sessionState,
      data,
      checkoutUrl: response.checkoutUrl,
    });
  } catch (error: any) {
    console.error("Concierge route error:", error);
    return res.status(500).json({
      error: "Unable to process concierge request.",
    });
  }
});

// POST /api/concierge/tool (Direct Tool Invocation with Validation & RBAC)
router.post("/tool", async (req, res) => {
  try {
    const { toolName, args } = req.body ?? {};
    if (!toolName) {
      return res.status(400).json({ error: "toolName is required." });
    }

    const staff = getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
    const context = {
      isStaff: !!staff,
      role: staff?.role,
      userEmail: staff?.email,
    };

    const result = await executeAiTool(toolName, args || {}, context);
    if (!result.success) {
      return res.status(result.error?.includes("UNAUTHORIZED") ? 403 : 400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to execute AI tool." });
  }
});

export default router;
