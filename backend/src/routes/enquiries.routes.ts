import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { Router } from "express";
import { z } from "zod";
import { createEnquiry } from "@/modules/enquiries/enquiry.repository";
import {
  enquiryDateErrors,
  formTokenProblem,
  issueFormToken,
  looksLikeBotMessage,
  looksLikeBotName,
  MAX_ENQUIRY_GUESTS,
  tooManyFromEmail,
  turnstileEnabled,
  verifyTurnstile,
} from "@/modules/enquiries/spam";
import {
  isInvalidTripDate,
  isSpamBotEnquiry,
  isSpamMessage,
  isSuspiciousEmail,
  isSyntheticBotName,
} from "@/lib/security/spam-detector";
import { todayInMountainTime } from "@/lib/utils/time";

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  tourSlug: z.string().trim().max(120).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(MAX_ENQUIRY_GUESTS).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  // "Plan your trip" asks From and To dates (owner, 2026-11-06): `date` is the From date.
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(4000),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(500).optional(),
  // Signed when the form loads (GET /api/enquiries/form-token); proves a person had the form open.
  formToken: z.string().max(64).optional(),
  // Cloudflare Turnstile, when TURNSTILE_SECRET_KEY is set.
  turnstileToken: z.string().max(4096).optional(),
});

// Per-IP limit: 5 enquiries per 10 minutes.
const hits = new Map<string, number[]>();

/** Bot: answer as if it worked, so it learns nothing; save and email nothing. */
function dropAsSpam(res: import("express").Response, reason: string) {
  console.warn(`[enquiry] dropped as spam: ${reason}`);
  return res.status(201).json({ success: true });
}

// GET /api/enquiries/form-token: the contact form fetches this when it loads.
router.get("/form-token", rateLimitMiddleware("enquiry_token", { maxRequests: 60, windowSeconds: 600 }), (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ success: true, token: issueFormToken(), turnstile: turnstileEnabled() });
});

// POST /api/enquiries: contact form and "Request this tour".
router.post("/", rateLimitMiddleware("enquiry_create", { maxRequests: 5, windowSeconds: 600 }), async (req, res) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) return res.status(429).json({ success: false, error: "Too many messages. Please try again in a few minutes." });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Please check the highlighted fields.", fields: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;
  const dateErrors = enquiryDateErrors(data.date || undefined, data.toDate || undefined, todayInMountainTime());
  if (dateErrors) return res.status(400).json({ success: false, error: "Please check the highlighted fields.", fields: dateErrors });

  if (data.website) return dropAsSpam(res, "honeypot filled");
  if (looksLikeBotName(data.name) || isSyntheticBotName(data.name)) return dropAsSpam(res, "random-string name");
  if (looksLikeBotMessage(data.message) || isSpamMessage(data.message)) return dropAsSpam(res, "message has no words");
  if (isSuspiciousEmail(data.email)) return dropAsSpam(res, "suspicious email address");
  const tokenProblem = formTokenProblem(data.formToken, now);
  if (tokenProblem) return dropAsSpam(res, tokenProblem);
  if (!(await verifyTurnstile(data.turnstileToken, req.ip))) {
    return res.status(400).json({ success: false, error: "Please complete the security check and send again." });
  }
  if (tooManyFromEmail(data.email, now)) return dropAsSpam(res, "more than 3 enquiries from one email today");

  recent.push(now);
  hits.set(key, recent);
  const { website: _honeypot, formToken: _token, turnstileToken: _turnstile, phone, tourSlug, date, toDate, ...rest } = data;
  const result = await createEnquiry({ ...rest, phone: phone || undefined, tourSlug: tourSlug || undefined, date: date || undefined, toDate: toDate || undefined });
  return res.status(201).json({ success: true, id: result.id });
});

export default router;
