// Partner (affiliate / associate) program API. docs/AFFILIATES.md has the rules and lifecycle.
//
// Partner routes resolve the partner from the signed-in user, never from a parameter, and never
// return guest names or contact details. Admin routes need the ADMIN role and write an AuditLog
// row. Amounts, statuses and partner ids from the browser are never trusted: commission is
// computed on the server from verified payments (modules/affiliates/commission.ts).

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getAuthenticatedStaff, getAuthenticatedUser } from "@/lib/auth/admin-guard";
import {
  AFFILIATE_STATUSES,
  AFFILIATE_TYPES,
  applyAffiliate,
  createAffiliateByAdmin,
  getAffiliateDashboard,
  listAffiliates,
  listCommissionLines,
  listPartnerBookings,
  listPartnerCommissions,
  listPartnerPayouts,
  recordAffiliateClick,
  updateAffiliate,
  updateAffiliateProfile,
} from "@/modules/affiliates/affiliate.repository";
import { adjustCommission, approveCommissions } from "@/modules/affiliates/commission";
import { cancelPayout, createPayout, listPayouts, markPayoutPaid, payoutDto } from "@/modules/affiliates/payouts";
import { affiliateReport, reportToCsv } from "@/modules/affiliates/reports";
import { sendPayoutPaidEmail, sendStatusEmail } from "@/modules/affiliates/partner-emails";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";

const router = Router();

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const phone = z.string().trim().max(40).regex(/^[0-9+().\-\s]*$/, "Use digits, spaces and + ( ) - only");
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function invalid(res: Response, error: z.ZodError) {
  return res.status(400).json({ success: false, error: "Please check the highlighted fields.", fields: error.flatten().fieldErrors });
}

function requireAdmin(req: Request, res: Response) {
  const staff = getAuthenticatedStaff(req, ["ADMIN"]);
  if (!staff) res.status(403).json({ success: false, error: "Admins only." });
  return staff;
}

function requirePartnerUser(req: Request, res: Response) {
  const user = getAuthenticatedUser(req);
  if (!user) res.status(401).json({ success: false, error: "Sign in to see your partner dashboard." });
  return user;
}

const notPartner = (res: Response) => res.status(404).json({ success: false, error: "This account isn't a partner account." });

// ---------------------------------------------------------------------------------------------
// Public

const applySchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  type: z.enum(AFFILIATE_TYPES),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  phone: phone.optional().or(z.literal("")),
});

// Apply to the partner program. New partners start PENDING until Vista Chase approves them.
router.post("/apply", rateLimitMiddleware("affiliate_apply", { maxRequests: 3, windowSeconds: 3600 }), async (req, res) => {
  const parsed = applySchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const result = await applyAffiliate(parsed.data);
    return res.status(result.success ? 201 : 409).json(result);
  } catch (error) {
    console.error("Affiliate apply error:", (error as Error).message);
    return res.status(500).json({ success: false, error: "We couldn't submit your application. Please try again." });
  }
});

const clickSchema = z.object({ code: z.string().regex(/^[A-Za-z0-9]{3,24}$/), path: z.string().max(300).default("/") });

// A referral landing, reported by the site's middleware. Records at most one click per visitor
// per partner per day; never earns anything. Always 204 so it reveals nothing about codes.
router.post("/click", rateLimitMiddleware("affiliate_click", { maxRequests: 60, windowSeconds: 60 }), async (req, res) => {
  const parsed = clickSchema.safeParse(req.body ?? {});
  if (parsed.success) {
    await recordAffiliateClick({ code: parsed.data.code, path: parsed.data.path, ip: req.ip || "unknown", userAgent: String(req.headers["user-agent"] ?? "") }).catch((e) =>
      console.error("Affiliate click error:", (e as Error).message),
    );
  }
  return res.status(204).end();
});

// ---------------------------------------------------------------------------------------------
// Partner (own data only)

router.get("/me", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const dashboard = await getAffiliateDashboard(user.userId);
  if (!dashboard) return notPartner(res);
  return res.json({ success: true, ...dashboard });
});

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    contactName: z.string().trim().min(2).max(120).optional(),
    phone: phone.nullable().optional(),
    website: z.string().trim().url().max(300).nullable().optional().or(z.literal("")),
    payoutEmail: z.string().trim().email().max(200).nullable().optional().or(z.literal("")),
  })
  .strict(); // code, status, commission and email change only through staff

router.patch("/me", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const parsed = profileSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const updated = await updateAffiliateProfile(user.userId, parsed.data);
  if (!updated) return notPartner(res);
  return res.json({ success: true });
});

const bookingStatus = z.enum(["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED", "PAID_UNSYNCED"]);

router.get("/me/bookings", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const parsed = pageQuery.extend({ status: bookingStatus.optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await listPartnerBookings(user.userId, parsed.data);
  if (!result) return notPartner(res);
  return res.json({ success: true, ...result });
});

const commissionStatus = z.enum(["PENDING", "APPROVED", "PAID"]);

router.get("/me/commissions", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const parsed = pageQuery.extend({ status: commissionStatus.optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await listPartnerCommissions(user.userId, parsed.data);
  if (!result) return notPartner(res);
  return res.json({ success: true, ...result });
});

router.get("/me/payouts", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const payouts = await listPartnerPayouts(user.userId);
  if (!payouts) return notPartner(res);
  return res.json({ success: true, payouts });
});

// ---------------------------------------------------------------------------------------------
// Admin

router.get("/admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ success: true, affiliates: await listAffiliates() });
});

const createSchema = applySchema.extend({
  status: z.enum(["PENDING", "ACTIVE"]).default("ACTIVE"),
  commissionRate: z.number().min(0).max(0.5).optional(),
});

router.post("/admin", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await createAffiliateByAdmin(parsed.data, staff.userId);
  if (result.success && parsed.data.status === "ACTIVE") {
    sendStatusEmail({ name: parsed.data.name, email: parsed.data.email.toLowerCase(), contactName: parsed.data.contactName, code: result.affiliate.code, status: "ACTIVE" });
  }
  return res.status(result.success ? 201 : 409).json(result);
});

const updateSchema = z
  .object({
    status: z.enum(AFFILIATE_STATUSES).optional(),
    commissionRate: z.number().min(0).max(0.5).optional(),
    bokunChannelId: z.string().trim().max(100).nullable().optional(),
    name: z.string().trim().min(2).max(120).optional(),
    phone: phone.nullable().optional(),
    payoutEmail: z.string().trim().email().max(200).nullable().optional(),
    website: z.string().trim().url().max(300).nullable().optional(),
  })
  .strict();

router.patch("/admin/:id", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid update." });
  try {
    const { before, updated } = await updateAffiliate(String(req.params.id), parsed.data, staff.userId);
    if (parsed.data.status && parsed.data.status !== before.status) {
      const user = await prisma.user.findUnique({ where: { id: updated.userId }, select: { email: true, name: true } });
      if (user) sendStatusEmail({ name: updated.name, email: user.email, contactName: user.name, code: updated.code, status: updated.status });
    }
    return res.json({ success: true, affiliate: { id: updated.id, status: updated.status } });
  } catch {
    return res.status(404).json({ success: false, error: "Partner not found." });
  }
});

// Commission rules ------------------------------------------------------------------------------

const ruleSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    affiliateId: z.string().min(1).max(40).nullable().optional(),
    tourSlug: z.string().min(1).max(200).nullable().optional(),
    category: z.enum(["SHARED", "PRIVATE", "SHUTTLE", "MULTIDAY", "TICKET"]).nullable().optional(),
    percent: z.number().min(0).max(100).optional(), // 12.5 = 12.5%
    fixedAmount: z.number().min(0).max(100_000).optional(), // dollars per booking
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((r) => (r.percent === undefined) !== (r.fixedAmount === undefined), { message: "Give either a percentage or a fixed amount.", path: ["percent"] })
  .refine((r) => !(r.tourSlug && r.category), { message: "Pick a tour or a category, not both.", path: ["category"] });

function ruleDto(r: { id: string; name: string; affiliateId: string | null; tourId: string | null; category: string | null; percentBps: number | null; fixedCents: number | null; active: boolean; validFrom: Date; validTo: Date | null; createdAt: Date }) {
  return {
    id: r.id,
    name: r.name,
    affiliateId: r.affiliateId,
    tourId: r.tourId,
    category: r.category,
    percent: r.percentBps == null ? null : r.percentBps / 100,
    fixedAmount: r.fixedCents == null ? null : r.fixedCents / 100,
    active: r.active,
    validFrom: r.validFrom,
    validTo: r.validTo,
    createdAt: r.createdAt,
  };
}

router.get("/admin/rules", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rules = await prisma.commissionRule.findMany({ orderBy: { createdAt: "desc" }, include: { affiliate: { select: { name: true } } } });
  const tourIds = [...new Set(rules.map((r) => r.tourId).filter((id): id is string => !!id))];
  const tours = tourIds.length ? await prisma.tour.findMany({ where: { id: { in: tourIds } }, select: { id: true, title: true } }) : [];
  return res.json({
    success: true,
    rules: rules.map((r) => ({ ...ruleDto(r), partner: r.affiliate?.name ?? null, tour: tours.find((t) => t.id === r.tourId)?.title ?? null })),
  });
});

router.post("/admin/rules", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = ruleSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const r = parsed.data;
  let tourId: string | null = null;
  if (r.tourSlug) {
    const tour = await prisma.tour.findUnique({ where: { slug: r.tourSlug }, select: { id: true } });
    if (!tour) return res.status(400).json({ success: false, error: "Tour not found." });
    tourId = tour.id;
  }
  if (r.affiliateId && !(await prisma.affiliate.findUnique({ where: { id: r.affiliateId }, select: { id: true } }))) {
    return res.status(400).json({ success: false, error: "Partner not found." });
  }
  const rule = await prisma.$transaction(async (tx) => {
    const created = await tx.commissionRule.create({
      data: {
        name: r.name,
        affiliateId: r.affiliateId ?? null,
        tourId,
        category: r.category ?? null,
        percentBps: r.percent === undefined ? null : Math.round(r.percent * 100),
        fixedCents: r.fixedAmount === undefined ? null : Math.round(r.fixedAmount * 100),
        ...(r.validFrom ? { validFrom: r.validFrom } : {}),
        validTo: r.validTo ?? null,
        createdById: staff.userId,
      },
    });
    await tx.auditLog.create({ data: { userId: staff.userId, action: "COMMISSION_RULE_CREATED", entityType: "CommissionRule", entityId: created.id, details: ruleDto(created) as object } });
    return created;
  });
  return res.status(201).json({ success: true, rule: ruleDto(rule) });
});

// Rules are never edited in place (lines keep a snapshot anyway): they are switched off or ended.
const ruleUpdateSchema = z.object({ active: z.boolean().optional(), validTo: z.coerce.date().nullable().optional() }).strict();

router.patch("/admin/rules/:id", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = ruleUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  try {
    const rule = await prisma.$transaction(async (tx) => {
      const updated = await tx.commissionRule.update({ where: { id: String(req.params.id) }, data: parsed.data });
      await tx.auditLog.create({ data: { userId: staff.userId, action: "COMMISSION_RULE_UPDATED", entityType: "CommissionRule", entityId: updated.id, details: parsed.data as object } });
      return updated;
    });
    return res.json({ success: true, rule: ruleDto(rule) });
  } catch {
    return res.status(404).json({ success: false, error: "Rule not found." });
  }
});

// Commission ledger ---------------------------------------------------------------------------

router.get("/admin/commissions", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = pageQuery.extend({ status: commissionStatus.optional(), affiliateId: z.string().max(40).optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const { status, affiliateId, ...paging } = parsed.data;
  const result = await listCommissionLines({ ...(status ? { status } : {}), ...(affiliateId ? { affiliateId } : {}) }, paging);
  return res.json({ success: true, ...result });
});

router.post("/admin/commissions/approve", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(500) }).strict().safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  return res.json({ success: true, approved: await approveCommissions(parsed.data.ids, staff.userId) });
});

const adjustSchema = z
  .object({
    affiliateId: z.string().min(1).max(40),
    amount: z.number().min(-100_000).max(100_000).refine((n) => n !== 0, "Amount can't be zero"), // dollars, either sign
    reason: z.string().trim().min(5).max(500),
    bookingReference: z.string().trim().max(40).optional(),
  })
  .strict();

router.post("/admin/commissions/adjust", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = adjustSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  let bookingId: string | null = null;
  if (parsed.data.bookingReference) {
    const booking = await prisma.booking.findUnique({ where: { bookingReference: parsed.data.bookingReference }, select: { id: true } });
    if (!booking) return res.status(400).json({ success: false, error: "Booking not found." });
    bookingId = booking.id;
  }
  const result = await adjustCommission({ affiliateId: parsed.data.affiliateId, amountCents: Math.round(parsed.data.amount * 100), reason: parsed.data.reason, bookingId, staffId: staff.userId });
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, id: result.line.id });
});

// Payouts -------------------------------------------------------------------------------------

router.get("/admin/payouts", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z.object({ status: z.enum(["DRAFT", "PAID", "CANCELLED"]).optional(), affiliateId: z.string().max(40).optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  return res.json({ success: true, payouts: await listPayouts(parsed.data) });
});

router.post("/admin/payouts", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = z.object({ affiliateId: z.string().min(1).max(40), method: z.string().trim().max(60).optional() }).strict().safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await createPayout({ affiliateId: parsed.data.affiliateId, method: parsed.data.method, staffId: staff.userId });
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, payout: payoutDto(result.payout) });
});

router.post("/admin/payouts/:id/mark-paid", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const parsed = z.object({ reference: z.string().trim().min(2).max(120) }).strict().safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await markPayoutPaid({ payoutId: String(req.params.id), reference: parsed.data.reference, staffId: staff.userId });
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  const affiliate = await prisma.affiliate.findUnique({ where: { id: result.payout.affiliateId }, include: { user: { select: { email: true, name: true } } } });
  if (affiliate) {
    sendPayoutPaidEmail({ email: affiliate.payoutEmail || affiliate.user.email, contactName: affiliate.user.name, amount: result.payout.amountCents / 100, currency: result.payout.currency, reference: parsed.data.reference });
  }
  return res.json({ success: true, payout: payoutDto(result.payout) });
});

router.post("/admin/payouts/:id/cancel", async (req, res) => {
  const staff = requireAdmin(req, res);
  if (!staff) return;
  const result = await cancelPayout({ payoutId: String(req.params.id), staffId: staff.userId });
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  return res.json({ success: true });
});

// Reports -------------------------------------------------------------------------------------

router.get("/admin/report", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z
    .object({ from: z.coerce.date(), to: z.coerce.date(), format: z.enum(["json", "csv"]).default("json") })
    .refine((q) => q.from <= q.to, { message: "from must be before to", path: ["from"] })
    .safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const rows = await affiliateReport(parsed.data.from, parsed.data.to);
  if (parsed.data.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="partner-report.csv"`);
    return res.send(reportToCsv(rows));
  }
  return res.json({ success: true, from: parsed.data.from, to: parsed.data.to, rows });
});

export default router;
