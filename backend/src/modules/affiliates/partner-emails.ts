// Partner notifications. Sent fire-and-forget: a failed email never blocks an application or an
// admin action. Bodies carry no guest details.

import { staffInbox } from "@/lib/email/staff-inbox";
import { getEmailProvider } from "@/lib/email/email.provider";
import { renderMasterEmail } from "@/lib/email/email-template";
import { siteUrl } from "@/lib/security/signed-links";
import type { EmailAttachment } from "@/lib/email/email.provider";
import { decryptBankDetails } from "@/modules/affiliates/partner-application";
import { affiliateForDocs, applicationPdf } from "@/modules/affiliates/partner-contract";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function send(to: string, subject: string, lines: string[], attachments?: EmailAttachment[]) {
  const master = renderMasterEmail({
    site: siteUrl(),
    subject,
    title: subject,
    paragraphs: lines,
    plainTextLines: [
      subject,
      "",
      ...lines.map((l) => l.replace(/<[^>]*>/g, "")),
      "",
      "© Vista Chase | Explore the Canadian Rockies",
      "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456",
    ],
  });
  getEmailProvider()
    .sendEmail({ to, subject: master.subject, html: master.html, text: master.text, ...(attachments?.length ? { attachments } : {}) })
    .catch((e) => console.error(`Partner email "${subject}" failed:`, (e as Error).message));
}

const partnersInbox = () => staffInbox(process.env.PARTNERS_TO, process.env.ENQUIRIES_TO);

const pdfFileName = (prefix: string, name: string) => `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "partner"}.pdf`;

/** The application form as a PDF (bank account numbers masked), or nothing if it can't be built. */
async function applicationAttachment(affiliateId: string): Promise<EmailAttachment[]> {
  try {
    const a = await affiliateForDocs(affiliateId);
    if (!a) return [];
    const details = a.payoutDetails ? decryptBankDetails(a.payoutDetails) : null;
    const pdf = await applicationPdf(a, { details, full: false, stored: !!a.payoutDetails });
    return [{ filename: pdfFileName("partner-application", a.name), content: Buffer.from(pdf), contentType: "application/pdf" }];
  } catch (e) {
    console.error("Partner application PDF failed:", (e as Error).message);
    return [];
  }
}

/**
 * Awaited by the caller so the PDF's database reads finish before the request (or a test worker)
 * ends; the sends themselves stay fire-and-forget.
 */
export async function sendApplicationEmails(p: { name: string; contactName: string; email: string; code: string; type: string; affiliateId?: string }) {
  send(p.email, "We received your Vista Chase partner application", [
    `Hi ${escapeHtml(p.contactName)},`,
    `Thank you for applying to the Vista Chase partner program for <strong>${escapeHtml(p.name)}</strong>. We review every application by hand and will email you once your account is approved.`,
    `Your referral code will be <strong>${p.code}</strong>. You can sign in at <a href="${siteUrl()}/partners/login">${siteUrl()}/partners/login</a>.`,
  ]);
  const attachments = p.affiliateId ? await applicationAttachment(p.affiliateId) : [];
  send(
      partnersInbox(),
      `New partner application: ${p.name}`,
      [
        `<strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.type)}) applied to the partner program.`,
        `Contact: ${escapeHtml(p.contactName)}, ${escapeHtml(p.email)}. Code: ${p.code}.`,
        attachments.length ? "The application form is attached as a PDF (bank account numbers masked)." : "",
        `Review it, set the commission and approve it at <a href="${siteUrl()}/admin/partners">${siteUrl()}/admin/partners</a>.`,
      ].filter(Boolean),
      attachments,
    );
}

/** The partner agreement PDF, sent when staff approve a partner or send a new version. */
export function sendContractEmail(p: { to: string; contactName: string; name: string; version: number; pdf: Uint8Array; approved: boolean }) {
  const subject = p.approved ? "Welcome to the Vista Chase partner program: your partner agreement" : `Your updated Vista Chase partner agreement (version ${p.version})`;
  send(
    p.to,
    subject,
    [
      `Hi ${escapeHtml(p.contactName)},`,
      p.approved
        ? `Your partner application for <strong>${escapeHtml(p.name)}</strong> is approved. Your partner agreement is attached as a PDF, with your commission rate and the products it applies to.`
        : `We've updated the partner agreement for <strong>${escapeHtml(p.name)}</strong>. Version ${p.version} is attached as a PDF. It applies to bookings paid from today; commission you've already earned doesn't change.`,
      "Please review it, sign it and reply to this email with the signed copy. You can also download it any time from your partner portal under Settings.",
      `Questions or changes: use the change request form at <a href="${siteUrl()}/affiliate/requests">${siteUrl()}/affiliate/requests</a>.`,
    ],
    [{ filename: pdfFileName(`vista-chase-partner-agreement-v${p.version}`, p.name), content: Buffer.from(p.pdf), contentType: "application/pdf" }],
  );
}

/** A partner sent a change request from the portal: tell the team. */
export function sendChangeRequestEmails(p: { partner: string; code: string; contactName: string; email: string; category: string; subject: string; details: string; bookingReference: string | null }) {
  send(partnersInbox(), `Partner change request: ${p.partner} · ${p.subject}`, [
    `<strong>${escapeHtml(p.partner)}</strong> (${p.code}) sent a change request: <strong>${escapeHtml(p.category)}</strong>.`,
    `<strong>${escapeHtml(p.subject)}</strong>`,
    escapeHtml(p.details).replace(/\n/g, "<br>"),
    p.bookingReference ? `Booking: ${escapeHtml(p.bookingReference)}` : "",
    `From ${escapeHtml(p.contactName)}, ${escapeHtml(p.email)}. Answer it in <a href="${siteUrl()}/admin/partners">Admin → Partners → Change requests</a>.`,
  ].filter(Boolean));
}

/** Staff updated a change request: tell the partner. */
export function sendChangeRequestUpdate(p: { to: string; contactName: string; subject: string; status: string; note: string | null }) {
  const word: Record<string, string> = { IN_PROGRESS: "is being worked on", DONE: "is done", DECLINED: "was declined", OPEN: "is open" };
  send(p.to, `Your change request: ${p.subject}`, [
    `Hi ${escapeHtml(p.contactName)},`,
    `Your change request "<strong>${escapeHtml(p.subject)}</strong>" ${word[p.status] ?? "was updated"}.`,
    p.note ? `Note from Vista Chase: ${escapeHtml(p.note).replace(/\n/g, "<br>")}` : "",
    `See all your requests at <a href="${siteUrl()}/affiliate/requests">${siteUrl()}/affiliate/requests</a>.`,
  ].filter(Boolean));
}

export function sendStatusEmail(p: { name: string; email: string; contactName: string; code: string; status: string }) {
  if (p.status === "ACTIVE") {
    send(p.email, "Your Vista Chase partner account is active", [
      `Hi ${escapeHtml(p.contactName)},`,
      `<strong>${escapeHtml(p.name)}</strong> is now an active Vista Chase partner. Bookings made through your links are credited to you for 30 days after a guest's last click.`,
      `Your links use the code <strong>${p.code}</strong>, for example <a href="${siteUrl()}/?ref=${p.code}">${siteUrl()}/?ref=${p.code}</a>. Your dashboard: <a href="${siteUrl()}/partners/dashboard">${siteUrl()}/partners/dashboard</a>.`,
    ]);
  } else if (p.status === "SUSPENDED") {
    send(p.email, "Your Vista Chase partner account is paused", [
      `Hi ${escapeHtml(p.contactName)},`,
      `The partner account for <strong>${escapeHtml(p.name)}</strong> is paused, so new bookings aren't credited for now. Commission already earned is kept. Reply to this email if you have questions.`,
    ]);
  } else if (p.status === "REJECTED") {
    send(p.email, "Your Vista Chase partner application", [
      `Hi ${escapeHtml(p.contactName)},`,
      `Thank you for your interest in the Vista Chase partner program. We've reviewed the application for <strong>${escapeHtml(p.name)}</strong> and aren't able to approve it at this time.`,
      `If you think we've missed something, reply to this email or write to support@vistachase.com.`,
    ]);
  }
}

export function sendCommissionEarnedEmail(p: { email: string; contactName: string; bookingReference: string; amount: number; currency: string }) {
  send(p.email, `Commission earned on booking ${p.bookingReference}`, [
    `Hi ${escapeHtml(p.contactName)},`,
    `A guest you referred paid for booking <strong>${p.bookingReference}</strong>. Your commission is <strong>$${p.amount.toFixed(2)} ${p.currency}</strong>, payable once the tour has run.`,
    `Details are on your dashboard: <a href="${siteUrl()}/partners/dashboard">${siteUrl()}/partners/dashboard</a>.`,
  ]);
}

export function sendPayoutPaidEmail(p: { email: string; contactName: string; amount: number; currency: string; reference: string }) {
  send(p.email, "Your Vista Chase partner payout was sent", [
    `Hi ${escapeHtml(p.contactName)},`,
    `We sent your payout of <strong>$${p.amount.toFixed(2)} ${p.currency}</strong> (reference ${escapeHtml(p.reference)}).`,
  ]);
}
