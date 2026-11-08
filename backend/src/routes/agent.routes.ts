import { Router, type Request, type Response } from "express";
import { getSessionUser, getRequestToken } from "@/lib/auth/admin-guard";
import { verifyToken } from "@/lib/auth/auth";
import { agentGateway } from "@/lib/ai/agent.gateway";
import { agentToolExecutor } from "@/lib/ai/agent.tools.registry";
import { getCacheProvider } from "@/lib/cache/cache.provider";
import { syncMasterKnowledgeBase, getKnowledgeBaseMetadata, invalidateKnowledgeBase } from "@/lib/ai/knowledge.sync";
import type { SessionContext, AgentRole, AgentChatMessage } from "@/lib/ai/agent.types";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";

const router = Router();
const cache = getCacheProvider();

/**
 * Middleware: Extract Out-of-Band Session Context from JWT
 */
async function resolveSessionContext(req: Request): Promise<SessionContext> {
  const token = getRequestToken(req);
  if (!token) {
    // Check if guest has an active authorized PNR cookie/header
    const authorizedPnr = (req.headers["x-authorized-pnr"] as string) || req.cookies?.vc_authorized_pnr;
    return {
      role: "GUEST",
      authorizedPnr: authorizedPnr ? String(authorizedPnr).trim().toUpperCase() : undefined,
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { role: "GUEST" };
  }

  // Check database for fresh role and status
  const user = await getSessionUser(req);
  if (!user) {
    return { role: "GUEST" };
  }

  const role: AgentRole = user.role === "ADMIN" ? "ADMIN" : "CUSTOMER";

  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    role,
    rawStaffRole: user.role,
    authorizedPnr: req.cookies?.vc_authorized_pnr,
  };
}

/**
 * POST /api/agent/chat
 * Main Agentic Chat Endpoint. Supports both SSE streaming and standard JSON.
 */
router.post(
  "/chat",
  rateLimitMiddleware("agent_chat", { maxRequests: 40, windowSeconds: 600 }),
  async (req: Request, res: Response) => {
    const messages: AgentChatMessage[] = req.body?.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages payload." });
    }

    const session = await resolveSessionContext(req);
    const isStream = req.headers.accept === "text/event-stream" || req.query.stream === "true";

    if (isStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const sendSse = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        await agentGateway.runAgenticLoop(messages, session, (ev) => {
          if (ev.type === "text") sendSse("text", { text: ev.text });
          else if (ev.type === "status") sendSse("status", { text: ev.text });
          else if (ev.type === "card") sendSse("card", { card: ev.card });
          else if (ev.type === "done") sendSse("done", { success: true, reply: ev.text, card: ev.card });
          else if (ev.type === "error") sendSse("error", { error: ev.text });
        });
        res.end();
      } catch (err: any) {
        console.error("[/api/agent/chat] Streaming error:", err);
        sendSse("error", { error: err.message || "Agent execution failed." });
        res.end();
      }
    } else {
      try {
        const result = await agentGateway.runAgenticLoop(messages, session);
        return res.json({
          success: true,
          reply: result.reply,
          card: result.lastCard,
          session: {
            role: session.role,
            authorizedPnr: session.authorizedPnr,
          },
        });
      } catch (err: any) {
        console.error("[/api/agent/chat] Execution error:", err);
        return res.status(500).json({ error: err.message || "Agent loop failed." });
      }
    }
  }
);

/**
 * POST /api/agent/verify-otp
 * Verifies 6-digit OTP for guest claiming a PNR and issues authorization cookie
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
  const { pnr_code, otp_code } = req.body || {};
  if (!pnr_code || !otp_code) {
    return res.status(400).json({ error: "pnr_code and otp_code are required." });
  }

  const normalizedPnr = String(pnr_code).trim().toUpperCase();
  const otpKey = `otp_pnr:${normalizedPnr}`;
  const stored = await cache.get<{ otp: string; email: string; pnr: string }>(otpKey);

  if (!stored || stored.otp !== String(otp_code).trim()) {
    return res.status(401).json({ error: "Invalid or expired OTP." });
  }

  await cache.del(otpKey);

  // Set 2-hour authorized session cookie for guest
  res.cookie("vc_authorized_pnr", normalizedPnr, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 2 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    pnr_code: normalizedPnr,
    message: `Verification successful. Suite C tools unlocked for booking ${normalizedPnr}.`,
  });
});

/**
 * GET /api/agent/tools
 * Inspect currently active tools based on the caller's role (used by UI debuggers / admin)
 */
router.get("/tools", async (req: Request, res: Response) => {
  const session = await resolveSessionContext(req);
  const tools = agentToolExecutor.getFilteredToolsForSession(session);
  return res.json({
    role: session.role,
    authorizedPnr: session.authorizedPnr,
    toolCount: tools.length,
    tools: tools.map((t) => ({
      name: t.name,
      scope: t.scope,
      description: t.description,
    })),
  });
});

/**
 * POST /api/agent/sync-knowledge
 * Staff / Webhook endpoint to re-compile the Master Knowledge Base from live DB
 */
router.post("/sync-knowledge", async (req: Request, res: Response) => {
  const session = await resolveSessionContext(req);
  if (session.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin authorization required to sync knowledge base." });
  }

  const meta = await invalidateKnowledgeBase();
  return res.json({
    success: true,
    message: "Master Knowledge Base synchronized successfully.",
    meta,
  });
});

/**
 * GET /api/agent/knowledge-meta
 * View current knowledge base version and sync statistics
 */
router.get("/knowledge-meta", async (_req: Request, res: Response) => {
  const meta = await getKnowledgeBaseMetadata();
  return res.json({
    success: true,
    meta: meta || { status: "STATIC_DEFAULT" },
  });
});

export default router;
