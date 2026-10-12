// Partner notifications. Sent fire-and-forget: a failed email never blocks an application or an
// admin action. Bodies carry no guest details.

import { getEmailProvider } from "@/lib/email/email.provider";
import { siteUrl } from "@/lib/security/signed-links";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function send(to: string, subject: string, lines: string[]) {
  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1f23;">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
  const text = lines.map((l) => l.replace(/<[^>]*>/g, "")).join("\n\n");
  getEmailProvider()
    .sendEmail({ to, subject, html, text })
    .catch((e) => console.error(`Partner email "${subject}" failed:`, (e as Error).message));
}

const staffInbox = () => process.env.PARTNERS_TO || process.env.ENQUIRIES_TO || "info@vistachase.com";

export function sendApplicationEmails(p: { name: string; contactName: string; email: string; code: string; type: string }) {
  send(p.email, "We received your Vista Chase partner application", [
    `Hi ${escapeHtml(p.contactName)},`,
    `Thank you for applying to the Vista Chase partner program for <strong>${escapeHtml(p.name)}</strong>. We review every application by hand and will email you once your account is approved.`,
    `Your referral code will be <strong>${p.code}</strong>. You can sign in at <a href="${siteUrl()}/partners/login">${siteUrl()}/partners/login</a>.`,
  ]);
  send(staffInbox(), `New partner application: ${p.name}`, [
    `<strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.type)}) applied to the partner program.`,
    `Contact: ${escapeHtml(p.contactName)}, ${escapeHtml(p.email)}. Code: ${p.code}.`,
    `Review it at <a href="${siteUrl()}/admin/partners">${siteUrl()}/admin/partners</a>.`,
  ]);
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
