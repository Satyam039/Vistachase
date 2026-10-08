import { Router } from "express";
import { z } from "zod";
import { getAuthenticatedStaff, getAuthenticatedUser } from "@/lib/auth/admin-guard";
import {
  AFFILIATE_STATUSES,
  AFFILIATE_TYPES,
  applyAffiliate,
  getAffiliateDashboard,
  listAffiliates,
  updateAffiliate,
} from "@/modules/affiliates/affiliate.repository";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";

const router = Router();

const applySchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  type: z.enum(AFFILIATE_TYPES),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
});

// Apply to the partner program. New partners start PENDING until Vista Chase approves them.
router.post("/apply", rateLimitMiddleware("affiliate_apply", { maxRequests: 3, windowSeconds: 3600 }), async (req, res) => {
  const parsed = applySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Please check the highlighted fields.", fields: parsed.error.flatten().fieldErrors });
  }
  try {
    const result = await applyAffiliate(parsed.data);
    return res.status(result.success ? 201 : 409).json(result);
  } catch (error) {
    console.error("Affiliate apply error:", error);
    return res.status(500).json({ success: false, error: "We couldn't submit your application. Please try again." });
  }
});

// The signed-in partner's dashboard.
router.get("/me", async (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: "Sign in to see your partner dashboard." });
  const dashboard = await getAffiliateDashboard(user.userId);
  if (!dashboard) return res.status(404).json({ success: false, error: "This account isn't a partner account." });
  return res.json({ success: true, ...dashboard });
});

// Admin: list partners and approve, suspend or set commission and Bokun channel.
router.get("/admin", async (req, res) => {
  if (!getAuthenticatedStaff(req, ["ADMIN"])) return res.status(403).json({ success: false, error: "Admins only." });
  return res.json({ success: true, affiliates: await listAffiliates() });
});

const updateSchema = z.object({
  status: z.enum(AFFILIATE_STATUSES).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
  bokunChannelId: z.string().trim().max(100).nullable().optional(),
});

router.patch("/admin/:id", async (req, res) => {
  if (!getAuthenticatedStaff(req, ["ADMIN"])) return res.status(403).json({ success: false, error: "Admins only." });
  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid update." });
  try {
    const affiliate = await updateAffiliate(req.params.id, parsed.data);
    return res.json({ success: true, affiliate: { id: affiliate.id, status: affiliate.status } });
  } catch {
    return res.status(404).json({ success: false, error: "Partner not found." });
  }
});

export default router;
