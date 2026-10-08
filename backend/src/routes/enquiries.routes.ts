import { Router } from "express";
import { z } from "zod";
import { createEnquiry } from "@/modules/enquiries/enquiry.repository";

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  tourSlug: z.string().trim().max(120).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(60).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(4000),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(500).optional(),
});

// Per-IP limit: 5 enquiries per 10 minutes.
const hits = new Map<string, number[]>();

// POST /api/enquiries: contact form and "Request this tour".
router.post("/", async (req, res) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) return res.status(429).json({ success: false, error: "Too many messages. Please try again in a few minutes." });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Please check the highlighted fields.", fields: parsed.error.flatten().fieldErrors });
  }
  if (parsed.data.website) return res.json({ success: true }); // bot: pretend it worked

  recent.push(now);
  hits.set(key, recent);
  const { website: _honeypot, phone, tourSlug, date, ...rest } = parsed.data;
  const result = await createEnquiry({ ...rest, phone: phone || undefined, tourSlug: tourSlug || undefined, date: date || undefined });
  return res.status(201).json({ success: true, id: result.id });
});

export default router;
