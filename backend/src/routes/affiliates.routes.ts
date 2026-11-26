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
  deleteAffiliate,
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
import { applicationFields, applicationRecord, decryptBankDetails, encryptBankDetails } from "@/modules/affiliates/partner-application";
import { cancelPayout, createPayout, listPayouts, markPayoutPaid, payoutDto } from "@/modules/affiliates/payouts";
import { affiliateReport, reportToCsv } from "@/modules/affiliates/reports";
import { sendPayoutPaidEmail, sendStatusEmail } from "@/modules/affiliates/partner-emails";
import { rateLimitMiddleware } from "@/lib/security/rate-limit-middleware";
import { recordSubmission } from "@/modules/security/visitor-log";
import { formTokenProblem, looksLikeBotName, verifyTurnstile } from "@/modules/enquiries/spam";
import { hasValidMxRecords, isSuspiciousEmail, isSyntheticBotName } from "@/lib/security/spam-detector";

import { createPromo, deletePromo, updatePromo, usesByCode } from "@/modules/admin/promo-admin";
import { PROMO_SCOPES, promoLabel } from "@/modules/pricing/promo-codes";
import { todayInMountainTime } from "@/lib/utils/time";

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

async function requireAdmin(req: Request, res: Response) {
  const staff = await getAuthenticatedStaff(req, ["ADMIN"]);
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

const partnerBase = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  type: z.enum(AFFILIATE_TYPES),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  phone: phone.optional().or(z.literal("")),
});

// Public applications follow the owner's "Vista Chase Partner Application" form (2026-11-18):
// partner details, wire transfer details and the signed payment authorization. Required fields
// match the form ("optional" / "if ..." fields aren't); the phone needs its country code.
const applySchema = partnerBase
  .omit({ website: true })
  .extend({
    phone: phone.refine((v) => /^\+\d/.test(v) && v.replace(/\D/g, "").length >= 7, "Enter a phone number with its country code"),
  })
  .merge(applicationFields);

const asUrl = (value: string) => {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.includes(".") && !/\s/.test(value) ? url.toString().slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
};

// Apply to the partner program. New partners start PENDING until Vista Chase approves them.
//
// Bot applications (owner, 2026-11-15: fake partner signups were sending "application received"
// emails). The same checks as account signup and the enquiry form: a hidden field people never
// fill (`fax`; `website` is a real field here), a random-string name, a throwaway or dot-spam
// email, an email domain that can't receive mail, the signed token the page fetches when it opens
// (no applying within 3 seconds, or without the page), and Cloudflare Turnstile when it is set up.
// A bot that trips a quiet check is told it worked: nothing is saved and no email is sent.
// Real business names can look odd ("BanffTravelHQ", "AirBnB Banff"), so a name only counts as a
// bot's when it is one word AND the contact name is one random word too ("NuLBPir" / "cHXwtVPyDC").
const looksRandom = (value: unknown) =>
  typeof value === "string" && /^\S{5,}$/.test(value.trim()) && (isSyntheticBotName(value) || looksLikeBotName(value));

const quietlyDropped = (req: Request, res: Response, reason: string) => {
  console.warn(`[affiliate-apply] dropped as spam: ${reason}`);
  void recordSubmission(req, { form: "PARTNER_APPLY", outcome: "SPAM", reason, email: req.body?.email, name: req.body?.contactName });
  return res.status(201).json({ success: true, affiliate: { code: "", status: "PENDING" } });
};

router.post("/apply", rateLimitMiddleware("affiliate_apply", { maxRequests: 3, windowSeconds: 3600 }), async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.fax === "string" && body.fax.trim() !== "") return quietlyDropped(req, res, "honeypot filled");
  if (looksRandom(body.contactName) && looksRandom(body.name)) {
    return quietlyDropped(req, res, `random names "${String(body.contactName)}" / "${String(body.name)}"`);
  }
  if (typeof body.email === "string" && isSuspiciousEmail(body.email)) return quietlyDropped(req, res, `suspicious email "${body.email}"`);
  const tokenProblem = formTokenProblem(body.formToken);
  if (tokenProblem) {
    console.warn(`[affiliate-apply] refused: ${tokenProblem}`);
    void recordSubmission(req, { form: "PARTNER_APPLY", outcome: "REFUSED", reason: tokenProblem, email: body.email, name: body.contactName });
    return res.status(400).json({ success: false, error: "Please wait a moment and try again. If this keeps happening, reload the page." });
  }
  if (!(await verifyTurnstile(body.turnstileToken, req.ip))) {
    return res.status(400).json({ success: false, error: "Please complete the security check and try again." });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    // Field errors by path ("bank.transitNumber") so the form can mark nested bank fields too.
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fields[issue.path.join(".")] ??= []).push(issue.message);
    return res.status(400).json({ success: false, error: "Please check the highlighted fields.", fields });
  }
  const domain = parsed.data.email.toLowerCase().split("@")[1];
  if (domain && !(await hasValidMxRecords(domain))) return quietlyDropped(req, res, `domain ${domain} has no mail server`);
  try {
    const { bank, ...form } = parsed.data;
    const result = await applyAffiliate({
      name: form.name,
      contactName: form.contactName,
      email: form.email,
      password: form.password,
      type: form.type,
      phone: form.phone,
      website: asUrl(form.websiteOrReference),
      payoutEmail: form.statementEmail,
      application: applicationRecord(form, req.ip),
      payoutDetails: encryptBankDetails(bank),
    });
    if (result.success) void recordSubmission(req, { form: "PARTNER_APPLY", outcome: "ACCEPTED", email: parsed.data.email, name: parsed.data.contactName });
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

// Staff (ADMIN) may open the affiliate portal to see it as a partner sees it. Before 2026-11-26 an
// admin always got whichever partner the database returned first, so bookings made with another
// partner's link looked missing. Now the admin picks the partner (the portal sets this cookie with
// the partner's code); with no choice yet, the partner with the latest referred booking is shown.
export const PARTNER_VIEW_COOKIE = "vc_partner_view";

async function resolveAffiliateUserId(req: Request, user: { userId: string; role?: string }): Promise<string> {
  const own = await prisma.affiliate.findUnique({ where: { userId: user.userId }, select: { id: true } });
  if (own || user.role !== "ADMIN") return user.userId;
  const chosen = typeof req.cookies?.[PARTNER_VIEW_COOKIE] === "string" ? req.cookies[PARTNER_VIEW_COOKIE].trim().toUpperCase() : "";
  if (chosen) {
    const picked = await prisma.affiliate.findUnique({ where: { code: chosen }, select: { userId: true } });
    if (picked) return picked.userId;
  }
  const latest = await prisma.booking.findFirst({
    where: { affiliateId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { affiliate: { select: { userId: true } } },
  });
  if (latest?.affiliate) return latest.affiliate.userId;
  const newest = await prisma.affiliate.findFirst({ orderBy: { createdAt: "desc" }, select: { userId: true } });
  return newest?.userId ?? user.userId;
}

/** For an admin viewing the portal: every partner they can switch to, with referred booking counts. */
async function partnersForAdminView() {
  const [partners, counts] = await Promise.all([
    prisma.affiliate.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true, status: true } }),
    prisma.booking.groupBy({ by: ["affiliateId"], where: { affiliateId: { not: null } }, _count: { _all: true } }),
  ]);
  const byId = new Map(counts.map((c) => [c.affiliateId, c._count._all]));
  return partners.map((p) => ({ code: p.code, name: p.name, status: p.status, bookings: byId.get(p.id) ?? 0 }));
}

router.get("/me", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const targetUserId = await resolveAffiliateUserId(req, user);
  const dashboard = await getAffiliateDashboard(targetUserId);
  if (!dashboard) return notPartner(res);
  // An admin looking at a partner's portal is told so, and gets the list of partners to switch to.
  const adminView = targetUserId !== user.userId && user.role === "ADMIN" ? { adminView: { partners: await partnersForAdminView() } } : {};
  return res.json({ success: true, ...dashboard, ...adminView });
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
  const targetUserId = await resolveAffiliateUserId(req, user);
  const parsed = profileSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const updated = await updateAffiliateProfile(targetUserId, parsed.data);
  if (!updated) return notPartner(res);
  return res.json({ success: true });
});

const bookingStatus = z.enum(["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED", "PAID_UNSYNCED"]);

router.get("/me/bookings", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const targetUserId = await resolveAffiliateUserId(req, user);
  const parsed = pageQuery.extend({ status: bookingStatus.optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await listPartnerBookings(targetUserId, parsed.data);
  if (!result) return notPartner(res);
  return res.json({ success: true, ...result });
});

const commissionStatus = z.enum(["PENDING", "APPROVED", "PAID"]);

router.get("/me/commissions", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const targetUserId = await resolveAffiliateUserId(req, user);
  const parsed = pageQuery.extend({ status: commissionStatus.optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await listPartnerCommissions(targetUserId, parsed.data);
  if (!result) return notPartner(res);
  return res.json({ success: true, ...result });
});

router.get("/me/payouts", async (req, res) => {
  const user = requirePartnerUser(req, res);
  if (!user) return;
  const targetUserId = await resolveAffiliateUserId(req, user);
  const payouts = await listPartnerPayouts(targetUserId);
  if (!payouts) return notPartner(res);
  return res.json({ success: true, payouts });
});


// ---------------------------------------------------------------------------------------------
// Partner coupons (affiliate account → Coupons, owner 2026-11-22). A partner makes their own coupon
// codes: percent off, start/end date, active or not, and where it applies (shared tours, private
// tours, shuttles). Guests type them at checkout like any promo code; bookings made with one credit
// this partner. Percent is capped by PARTNER_COUPON_MAX_PERCENT (default 20).

export const partnerCouponMaxPercent = () => {
  const n = Number(process.env.PARTNER_COUPON_MAX_PERCENT);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 20;
};

const couponDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-06-01.");
const couponSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/, "Use 3 to 40 letters, numbers, - or _ (no spaces)."),
    percentOff: z.number().int("Use a whole number.").min(1),
    startsOn: couponDay.nullable().optional(),
    endsOn: couponDay.nullable().optional(),
    isActive: z.boolean().optional(),
    appliesTo: z.array(z.enum(PROMO_SCOPES)).min(1, "Choose where the coupon applies: shared tours, private tours or shuttles.").max(3),
  })
  .strict();

async function partnerForCoupons(req: Request, res: Response) {
  const user = requirePartnerUser(req, res);
  if (!user) return null;
  const affiliate = await prisma.affiliate.findUnique({ where: { userId: await resolveAffiliateUserId(req, user) } });
  if (!affiliate) {
    notPartner(res);
    return null;
  }
  return affiliate;
}

const couponInput = (b: Partial<z.infer<typeof couponSchema>>) => ({
  ...(b.code !== undefined ? { code: b.code } : {}),
  ...(b.percentOff !== undefined ? { kind: "PERCENT" as const, value: b.percentOff } : {}),
  ...(b.startsOn !== undefined ? { startsOn: b.startsOn } : {}),
  ...(b.endsOn !== undefined ? { endsOn: b.endsOn } : {}),
  ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
  ...(b.appliesTo !== undefined ? { appliesTo: b.appliesTo } : {}),
});

router.get("/me/coupons", async (req, res) => {
  const affiliate = await partnerForCoupons(req, res);
  if (!affiliate) return;
  const rows = await prisma.promoCode.findMany({ where: { affiliateId: affiliate.id }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  const uses = await usesByCode(rows.map((r) => r.code));
  const now = new Date();
  return res.json({
    success: true,
    maxPercent: partnerCouponMaxPercent(),
    canCreate: affiliate.status === "ACTIVE",
    coupons: rows.map((r) => ({
      id: r.id,
      code: r.code,
      percentOff: r.percentOff ?? 0,
      label: promoLabel(r),
      isActive: r.isActive,
      startsOn: r.startsAt ? todayInMountainTime(r.startsAt) : null,
      endsOn: r.expiresAt ? todayInMountainTime(new Date(r.expiresAt.getTime() - 1)) : null,
      appliesTo: r.appliesTo.length ? PROMO_SCOPES.filter((x) => r.appliesTo.includes(x)) : [...PROMO_SCOPES],
      uses: uses.get(r.code)?.live ?? 0,
      paidBookings: uses.get(r.code)?.paid ?? 0,
      state: !r.isActive ? "INACTIVE" : r.startsAt && r.startsAt > now ? "SCHEDULED" : r.expiresAt && r.expiresAt <= now ? "EXPIRED" : "ACTIVE",
    })),
  });
});

router.post("/me/coupons", rateLimitMiddleware("partner_coupon", { maxRequests: 30, windowSeconds: 3600 }), async (req, res) => {
  const affiliate = await partnerForCoupons(req, res);
  if (!affiliate) return;
  if (affiliate.status !== "ACTIVE") return res.status(403).json({ success: false, error: "Your partner account must be approved before you can create coupons." });
  const parsed = couponSchema.safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const max = partnerCouponMaxPercent();
  if (parsed.data.percentOff > max) return res.status(400).json({ success: false, error: `The discount can be at most ${max}%.` });
  const result = await createPromo({ ...couponInput(parsed.data), kind: "PERCENT", value: parsed.data.percentOff, code: parsed.data.code, note: `Partner coupon: ${affiliate.name}` }, affiliate.id);
  if (result.status !== 201) return res.status(result.status).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, coupon: { id: result.promo.id, code: result.promo.code } });
});

router.patch("/me/coupons/:id", async (req, res) => {
  const affiliate = await partnerForCoupons(req, res);
  if (!affiliate) return;
  // The code itself can't change once made (guests may already have it).
  const parsed = couponSchema.omit({ code: true }).partial().safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const max = partnerCouponMaxPercent();
  if (parsed.data.percentOff !== undefined && parsed.data.percentOff > max) return res.status(400).json({ success: false, error: `The discount can be at most ${max}%.` });
  if (parsed.data.isActive && affiliate.status !== "ACTIVE") return res.status(403).json({ success: false, error: "Your partner account isn't active, so its coupons can't be turned on." });
  const result = await updatePromo(String(req.params.id), couponInput(parsed.data), affiliate.id);
  if (result.status !== 200) return res.status(result.status).json({ success: false, error: result.status === 404 ? "Coupon not found." : result.error });
  return res.json({ success: true });
});

router.delete("/me/coupons/:id", async (req, res) => {
  const affiliate = await partnerForCoupons(req, res);
  if (!affiliate) return;
  const result = await deletePromo(String(req.params.id), affiliate.id);
  if (result.status !== 200) return res.status(404).json({ success: false, error: "Coupon not found." });
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------------------------
// Admin

router.get("/admin", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  return res.json({ success: true, affiliates: await listAffiliates() });
});

const createSchema = partnerBase.extend({
  status: z.enum(["PENDING", "ACTIVE"]).default("ACTIVE"),
  commissionRate: z.number().min(0).max(0.5).optional(),
});

router.post("/admin", async (req, res) => {
  const staff = await requireAdmin(req, res);
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
  const staff = await requireAdmin(req, res);
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

// The partner's application answers and wire details, for staff setting up payouts. Admins only;
// every read of the bank details is written to the audit log.
router.get("/admin/:id/application", async (req, res) => {
  const staff = await requireAdmin(req, res);
  if (!staff) return;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: String(req.params.id) },
    select: { id: true, application: true, payoutDetails: true, payoutEmail: true },
  });
  if (!affiliate) return res.status(404).json({ success: false, error: "Partner not found." });
  // Bank details only when asked for (?bank=1), so opening a partner doesn't decrypt them.
  const wantBank = req.query.bank === "1";
  const bank = wantBank && affiliate.payoutDetails ? decryptBankDetails(affiliate.payoutDetails) : null;
  if (wantBank && affiliate.payoutDetails) {
    await prisma.auditLog.create({
      data: { userId: staff.userId, action: "PARTNER_BANK_DETAILS_VIEWED", entityType: "Affiliate", entityId: affiliate.id, details: { readable: !!bank } },
    });
  }
  return res.json({
    success: true,
    application: affiliate.application,
    hasBankDetails: !!affiliate.payoutDetails,
    bank,
    bankUnreadable: wantBank && !!affiliate.payoutDetails && !bank,
  });
});

// Delete an application or partner with no bookings, commission or payouts (see deleteAffiliate).
router.delete("/admin/:id", async (req, res) => {
  const staff = await requireAdmin(req, res);
  if (!staff) return;
  const result = await deleteAffiliate(String(req.params.id), staff.userId);
  if (!result.success) return res.status(result.status).json({ success: false, error: result.error });
  return res.json(result);
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
  if (!(await requireAdmin(req, res))) return;
  const rules = await prisma.commissionRule.findMany({ orderBy: { createdAt: "desc" }, include: { affiliate: { select: { name: true } } } });
  const tourIds = [...new Set(rules.map((r) => r.tourId).filter((id): id is string => !!id))];
  const tours = tourIds.length ? await prisma.tour.findMany({ where: { id: { in: tourIds } }, select: { id: true, title: true } }) : [];
  return res.json({
    success: true,
    rules: rules.map((r) => ({ ...ruleDto(r), partner: r.affiliate?.name ?? null, tour: tours.find((t) => t.id === r.tourId)?.title ?? null })),
  });
});

router.post("/admin/rules", async (req, res) => {
  const staff = await requireAdmin(req, res);
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
  const staff = await requireAdmin(req, res);
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
  if (!(await requireAdmin(req, res))) return;
  const parsed = pageQuery.extend({ status: commissionStatus.optional(), affiliateId: z.string().max(40).optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  const { status, affiliateId, ...paging } = parsed.data;
  const result = await listCommissionLines({ ...(status ? { status } : {}), ...(affiliateId ? { affiliateId } : {}) }, paging);
  return res.json({ success: true, ...result });
});

router.post("/admin/commissions/approve", async (req, res) => {
  const staff = await requireAdmin(req, res);
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
  const staff = await requireAdmin(req, res);
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
  if (!(await requireAdmin(req, res))) return;
  const parsed = z.object({ status: z.enum(["DRAFT", "PAID", "CANCELLED"]).optional(), affiliateId: z.string().max(40).optional() }).safeParse(req.query);
  if (!parsed.success) return invalid(res, parsed.error);
  return res.json({ success: true, payouts: await listPayouts(parsed.data) });
});

router.post("/admin/payouts", async (req, res) => {
  const staff = await requireAdmin(req, res);
  if (!staff) return;
  const parsed = z.object({ affiliateId: z.string().min(1).max(40), method: z.string().trim().max(60).optional() }).strict().safeParse(req.body ?? {});
  if (!parsed.success) return invalid(res, parsed.error);
  const result = await createPayout({ affiliateId: parsed.data.affiliateId, method: parsed.data.method, staffId: staff.userId });
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, payout: payoutDto(result.payout) });
});

router.post("/admin/payouts/:id/mark-paid", async (req, res) => {
  const staff = await requireAdmin(req, res);
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
  const staff = await requireAdmin(req, res);
  if (!staff) return;
  const result = await cancelPayout({ payoutId: String(req.params.id), staffId: staff.userId });
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  return res.json({ success: true });
});

// Reports -------------------------------------------------------------------------------------

router.get("/admin/report", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
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
