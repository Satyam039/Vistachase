import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router } from "express";
import { z } from "zod";
import type { ChatMessage } from "@/lib/ai/ai.provider";
import { answerWithoutModel } from "@/lib/ai/concierge.fallback";
import { createSupportHandoff } from "@/modules/support/handoff";
import { LiveChatError, guestCloseLiveChat, guestLiveChat, guestSendLiveChat, startLiveChat } from "@/modules/support/live-chat";
import { executeAiTool } from "@/lib/ai/ai.tools";
import { getAuthenticatedStaff } from "@/lib/auth/admin-guard";
import { CARD_NUMBER, isClaudeConfigured, runConciergeAgent } from "@/lib/ai/concierge.agent";
import type { Request, Response, NextFunction } from "express";

const router = Router();

// Simple per-IP limit so the AI model can't be run up: 30 messages per 10 minutes.


async function staffContext(req: Request) {
  const staff = await getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
  return { isStaff: !!staff, role: staff?.role, userEmail: staff?.email };
}

// POST /api/concierge/stream: Server-Sent Events. Events: status (what the agent is doing),
// text (reply deltas), done (final payload: message, cards, sessionState), error.
// Body: messages, sessionState, language (a code from lib/ai/languages.ts, or none for Auto).
router.post("/stream", rateLimitMiddleware("concierge", { maxRequests: 30, windowSeconds: 600 }), async (req, res) => {
  const messages: ChatMessage[] = req.body?.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid messages array." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const language = typeof req.body?.language === "string" ? req.body.language : undefined;
  const thinkingMode: "standard" | "deep" = req.body?.thinkingMode === "deep" ? "deep" : "standard";
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : undefined;

  try {
    if (isClaudeConfigured()) {
      await runConciergeAgent(
        messages,
        req.body?.sessionState,
        await staffContext(req),
        (e) => {
          if (e.type === "text") send("text", { text: e.text });
          else if (e.type === "status") send("status", { text: e.text });
          else send("done", { success: true, ...e.response });
        },
        { language, thinkingMode, attachments },
      );
    } else {
      // No AI key configured: answers come from the booking system's data only, in one piece.
      const response = await answerWithoutModel(messages, req.body?.sessionState, await staffContext(req), language);
      send("text", { text: response.message });
      send("done", { success: true, ...response });
    }
  } catch (error) {
    console.error("Concierge stream error:", error);
    send("error", { error: "The concierge is unavailable right now. Please try again, or call +1 (825) 734-9456." });
  } finally {
    res.end();
  }
});

// POST /api/concierge: the same conversation without streaming.
router.post("/", rateLimitMiddleware("concierge", { maxRequests: 30, windowSeconds: 600 }), async (req, res) => {
  try {
    const messages: ChatMessage[] = req.body?.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages array." });
    }
    const language = typeof req.body?.language === "string" ? req.body.language : undefined;
    const thinkingMode: "standard" | "deep" = req.body?.thinkingMode === "deep" ? "deep" : "standard";
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : undefined;
    const ctx = await staffContext(req);
    const response = isClaudeConfigured()
      ? await runConciergeAgent(messages, req.body?.sessionState, ctx, undefined, { language, thinkingMode, attachments })
      : await answerWithoutModel(messages, req.body?.sessionState, ctx, language);
    return res.json({ success: true, ...response });
  } catch (error) {
    console.error("Concierge route error:", error);
    return res.status(500).json({ error: "Unable to process concierge request." });
  }
});

const handoffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  language: z.string().max(10).optional(),
  page: z.string().max(300).optional(),
  transcript: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .max(60)
    .default([]),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(500).optional(),
});

// POST /api/concierge/handoff: "Chat with a live agent". Sends the conversation to the support
// team (saved as an enquiry and emailed to the support inbox); see modules/support/handoff.ts.
router.post("/handoff", rateLimitMiddleware("concierge_handoff", { maxRequests: 5, windowSeconds: 600 }), async (req, res) => {
  const parsed = handoffSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Please add your name and a valid email.", fields: parsed.error.flatten().fieldErrors });
  }
  if (parsed.data.website) return res.json({ success: true }); // bot: pretend it worked
  const { website: _honeypot, phone, note, transcript, ...rest } = parsed.data;
  try {
    const result = await createSupportHandoff({
      ...rest,
      phone: phone || undefined,
      note: note || undefined,
      // Card numbers never leave the chat.
      transcript: transcript.slice(-40).map((m) => ({ role: m.role, content: m.content.replace(CARD_NUMBER, "[redacted]") })),
    });
    return res.status(201).json({ success: true, id: result.id });
  } catch (error) {
    console.error("Concierge handoff error:", error);
    return res.status(500).json({ success: false, error: "We couldn't send that just now. Please call +1 (825) 734-9456 or email support@vistachase.com." });
  }
});

// Live chat with the support team (modules/support/live-chat.ts). POST starts a chat and returns
// the guest's token once; the other calls need it (?t= or body.token).
router.post("/live-chat", rateLimitMiddleware("concierge_live_chat", { maxRequests: 5, windowSeconds: 600 }), async (req, res) => {
  const parsed = handoffSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Please add your name and a valid email.", fields: parsed.error.flatten().fieldErrors });
  }
  if (parsed.data.website) return res.status(400).json({ success: false, error: "We couldn't start the chat." }); // bot
  const { website: _honeypot, phone, note, ...rest } = parsed.data;
  try {
    const chat = await startLiveChat({ ...rest, phone: phone || undefined, note: note || undefined });
    return res.status(201).json({ success: true, ...chat });
  } catch (error) {
    console.error("Live chat start error:", error);
    return res.status(500).json({ success: false, error: "We couldn't start the chat just now. Please call +1 (825) 734-9456 or email support@vistachase.com." });
  }
});

const liveChatError = (res: import("express").Response, error: unknown) => {
  if (error instanceof LiveChatError) return res.status(error.status).json({ success: false, error: error.message });
  console.error("Live chat error:", error);
  return res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
};
const chatToken = (req: import("express").Request) => String((req.query.t as string | undefined) ?? req.body?.token ?? "");

router.get("/live-chat/:id", rateLimitMiddleware("concierge_live_chat_poll", { maxRequests: 120, windowSeconds: 60 }), async (req, res) => {
  try {
    return res.json({ success: true, chat: await guestLiveChat(String(req.params.id), chatToken(req)) });
  } catch (error) {
    return liveChatError(res, error);
  }
});

const chatMessageSchema = z.object({ token: z.string().min(20).max(100), body: z.string().trim().min(1).max(2000) });

router.post("/live-chat/:id/messages", rateLimitMiddleware("concierge_live_chat_send", { maxRequests: 30, windowSeconds: 60 }), async (req, res) => {
  const parsed = chatMessageSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, error: "Type a message first." });
  try {
    return res.status(201).json({ success: true, chat: await guestSendLiveChat(String(req.params.id), parsed.data.token, parsed.data.body) });
  } catch (error) {
    return liveChatError(res, error);
  }
});

router.post("/live-chat/:id/close", rateLimitMiddleware("concierge_live_chat_send", { maxRequests: 30, windowSeconds: 60 }), async (req, res) => {
  try {
    return res.json(await guestCloseLiveChat(String(req.params.id), chatToken(req)));
  } catch (error) {
    return liveChatError(res, error);
  }
});

// POST /api/concierge/tool (Direct Tool Invocation with Validation & RBAC)
router.post("/tool", rateLimitMiddleware("concierge_tool", { maxRequests: 30, windowSeconds: 600 }), async (req, res) => {
  try {
    const { toolName, args } = req.body ?? {};
    if (!toolName) {
      return res.status(400).json({ error: "toolName is required." });
    }

    const staff = await getAuthenticatedStaff(req, ["ADMIN", "OPERATOR", "DISPATCHER"]);
    if (!staff) {
      return res.status(401).json({ error: "UNAUTHORIZED: Staff credentials required." });
    }

    const context = {
      isStaff: true,
      role: staff.role,
      userEmail: staff.email,
    };


    const result = await executeAiTool(toolName, args || {}, context);
    if (!result.success) {
      return res.status(result.error?.includes("UNAUTHORIZED") ? 403 : 400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to execute AI tool." });
  }
});

export default router;
