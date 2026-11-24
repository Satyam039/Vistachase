// Banff Elite personalised tour enquiry handler.
// Validates contact details (name, email, phone with country code), planning fields,
// prevents duplicates, dispatches email to support@vistachase.com and support@banffelite.com,
// and returns exact confirmation/error messages for the customer and AI.

import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getEmailProvider } from "@/lib/email/email.provider";
import { escapeHtml, renderMasterEmail } from "@/lib/email/email-template";

export const BANFF_ELITE_SUCCESS_MESSAGE =
  "Your enquiry has been sent. The Banff Elite team will contact you within 24 hours.";

export const BANFF_ELITE_FAILURE_MESSAGE =
  "Your enquiry couldn’t be sent. Please try again or email support@banffelite.com.";

export const BANFF_ELITE_RECIPIENTS = ["support@vistachase.com", "support@banffelite.com"];

export const banffEliteSchema = z.object({
  name: z.string().trim().min(2, "Main contact name is required").max(120),
  email: z.string().trim().email("Valid email address is required").max(200),
  // Phone must be provided and include digits (and usually country code)
  phone: z
    .string()
    .trim()
    .min(7, "Phone number including country code is required")
    .max(40)
    .refine((val) => /\d{6,}/.test(val.replace(/\D/g, "")), {
      message: "Phone number must contain at least 6 digits and include country code",
    }),
  // Optional planning fields (guests may submit contact details only)
  guests: z.union([z.number().int().min(1).max(50), z.string()]).optional().nullable(),
  travelDates: z.string().trim().max(200).optional().nullable(),
  tourDays: z.union([z.number().int().min(1).max(30), z.string()]).optional().nullable(),
  placesOfInterest: z.string().trim().max(1000).optional().nullable(),
  interests: z.string().trim().max(1000).optional().nullable(),
  preferredVehicle: z
    .enum(["luxury SUV", "luxury van", "help me choose", ""])
    .or(z.string().trim().max(100))
    .optional()
    .nullable(),
  paceAndRequests: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: z.string().trim().max(100).optional().nullable(),
});

export type BanffEliteEnquiryPayload = z.infer<typeof banffEliteSchema>;

export interface BanffEliteEnquiryResult {
  success: boolean;
  message?: string;
  error?: string;
  enquiryId?: string;
  duplicate?: boolean;
  status?: number;
  fields?: Record<string, string[]>;
}

// In-memory cache for duplicate prevention (10-minute deduplication window).
const recentSubmissions = new Map<string, { timestamp: number; result: BanffEliteEnquiryResult }>();

/** Purge expired entries older than 10 minutes */
function cleanupSubmissions(now = Date.now()) {
  const windowMs = 10 * 60_000;
  for (const [key, item] of recentSubmissions.entries()) {
    if (now - item.timestamp > windowMs) {
      recentSubmissions.delete(key);
    }
  }
}

/** Clear deduplication cache (useful for tests) */
export function clearBanffEliteSubmissionCache() {
  recentSubmissions.clear();
}

/** Process and send a Banff Elite personalised tour enquiry */
export async function processBanffEliteEnquiry(rawInput: unknown): Promise<BanffEliteEnquiryResult> {
  const now = Date.now();
  cleanupSubmissions(now);

  // 1. Validate fields
  const parsed = banffEliteSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error: BANFF_ELITE_FAILURE_MESSAGE,
      status: 400,
      fields: fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const places = data.placesOfInterest || data.interests || "";
  const vehicle = data.preferredVehicle || "";
  const guestsVal = data.guests != null && data.guests !== "" ? String(data.guests) : "";
  const daysVal = data.tourDays != null && data.tourDays !== "" ? String(data.tourDays) : "";

  // 2. Duplicate prevention
  const dedupeKey =
    data.idempotencyKey ||
    `${data.email.toLowerCase()}:${data.phone.replace(/\D/g, "")}:${data.travelDates || ""}:${vehicle}`;

  const cached = recentSubmissions.get(dedupeKey);
  if (cached && now - cached.timestamp < 10 * 60_000) {
    return {
      ...cached.result,
      duplicate: true,
    };
  }

  // 3. Format email and message contents
  const lines = [
    "BANFF ELITE PERSONALISED TOUR ENQUIRY",
    "=====================================",
    `Main Contact Name: ${data.name}`,
    `Email Address: ${data.email}`,
    `Phone Number: ${data.phone}`,
    "",
    "TRIP PLANNING DETAILS:",
    `Number of Guests: ${guestsVal || "Not specified"}`,
    `Travel Dates / Timeframe: ${data.travelDates || "Not specified"}`,
    `Number of Tour Days: ${daysVal || "Not specified"}`,
    `Places & Experiences of Interest: ${places || "Not specified"}`,
    `Preferred Vehicle: ${vehicle || "Not specified"}`,
    `Preferred Pace & Additional Requests: ${data.paceAndRequests || "Not specified"}`,
    "",
    "NOTE: Scope is tours only; hotels and restaurants are not arranged.",
    "Vehicle options (luxury SUV or luxury van) are priced according to tour requirements.",
  ];

  const fullText = lines.join("\n");

  const emailHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;font-size:14px;color:#1e293b;">
      <tr style="background-color:#f8fafc;"><td style="padding:10px 14px;font-weight:600;width:38%;border:1px solid #e2e8f0;">Main Contact Name</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(data.name)}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Email Address</td><td style="padding:10px 14px;border:1px solid #e2e8f0;"><a href="mailto:${escapeHtml(data.email)}" style="color:#0284c7;">${escapeHtml(data.email)}</a></td></tr>
      <tr style="background-color:#f8fafc;"><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Phone Number</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(data.phone)}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Number of Guests</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(guestsVal || "Not specified")}</td></tr>
      <tr style="background-color:#f8fafc;"><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Travel Dates / Timeframe</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(data.travelDates || "Not specified")}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Number of Tour Days</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(daysVal || "Not specified")}</td></tr>
      <tr style="background-color:#f8fafc;"><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Places & Experiences of Interest</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(places || "Not specified")}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Preferred Vehicle</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(vehicle || "Not specified")}</td></tr>
      <tr style="background-color:#f8fafc;"><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Preferred Pace & Additional Requests</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${escapeHtml(data.paceAndRequests || "Not specified")}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;border:1px solid #e2e8f0;">Scope</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">Tours only; hotels and restaurants are not arranged.</td></tr>
    </table>
  `;

  const masterEmail = renderMasterEmail({
    subject: `Banff Elite Personalised Tour Enquiry from ${data.name}`,
    preheader: `New Banff Elite enquiry from ${data.name} (${data.email})`,
    title: "Banff Elite Tour Enquiry",
    greeting: "Hello Team,",
    paragraphs: [
      `A new personalised tour enquiry for Banff Elite has been submitted by ${data.name}.`,
      "Please review the customer's vehicle and tour requirements below and provide a quote within 24 hours.",
    ],
    customHtml: emailHtml,
    disclaimer: "This enquiry was submitted through the Vista Chase website & AI concierge.",
  });

  // 4. Send email to support@vistachase.com and support@banffelite.com
  let emailSent = false;
  try {
    const emailResult = await getEmailProvider().sendEmail({
      to: BANFF_ELITE_RECIPIENTS,
      replyTo: data.email,
      subject: masterEmail.subject,
      text: fullText,
      html: masterEmail.html,
    });
    emailSent = emailResult.success !== false;
  } catch (err) {
    console.error("[BanffElite] Email send exception:", err);
    emailSent = false;
  }

  if (!emailSent) {
    return {
      success: false,
      error: BANFF_ELITE_FAILURE_MESSAGE,
      status: 500,
    };
  }

  // 5. Persist enquiry to database (best-effort)
  let enquiryId: string | undefined;
  try {
    const numGuests = typeof data.guests === "number" ? data.guests : parseInt(guestsVal, 10);
    const created = await prisma.enquiry.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        tourSlug: "premium-custom-banff-elite",
        guests: Number.isFinite(numGuests) && numGuests > 0 ? numGuests : undefined,
        message: fullText,
        status: "NEW",
      },
      select: { id: true },
    });
    enquiryId = created.id;
  } catch (dbErr) {
    console.warn("[BanffElite] Database persistence warning (handled gracefully):", (dbErr as Error).message);
  }

  const successResult: BanffEliteEnquiryResult = {
    success: true,
    message: BANFF_ELITE_SUCCESS_MESSAGE,
    enquiryId,
  };

  // Cache for duplicate prevention
  recentSubmissions.set(dedupeKey, { timestamp: now, result: successResult });

  return successResult;
}
