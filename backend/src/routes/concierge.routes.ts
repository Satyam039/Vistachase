import { Router } from "express";
import { getAIProvider, ChatMessage } from "@/lib/ai/ai.provider";
import { executeAiTool } from "@/lib/ai/ai.tools";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";

const router = Router();

// POST /api/concierge (Chat interaction with safety refusal & tool execution)
router.post("/", async (req, res) => {
  try {
    const messages: ChatMessage[] = req.body?.messages || [];
    const sessionState = req.body?.sessionState;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages array." });
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
