// "Welcome to Vista Chase!" account verification email (owner's "VistaChase Website" PDF,
// 2026-11-14, Fix #004): the Vista Chase logo on a dark band over a Moraine Lake banner, the
// heading, a short message, a prominent "Verify My Email" button, the link written out as a
// fallback, and a footer with the website and contact details.
//
// Email-safe: table layout, inline styles, PNG/JPG images (no SVG or WebP, which Gmail and Outlook
// drop), a bulletproof button (a padded link inside a coloured cell) and a plain-text version.
// Images are absolute URLs on the site (backend/media/email, served at /media/email).

const OBSIDIAN = "#1c1f23";
const TEAL = "#257780"; // Ocean Teal, AA on white (the brand's #3A9CA6 is too light for text)
const GOLD = "#f5bf03";
const FROST = "#f9f9f7";
const BODY = "#3f4650";
const MUTED = "#6b7280";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface VerificationEmailInput {
  name: string;
  /** The one-time verification link (`<site>/verify-email?token=…`). */
  link: string;
  /** Site origin for images and the footer link, e.g. https://www.vistachase.com. */
  site: string;
}

export function renderVerificationEmail({ name, link, site }: VerificationEmailInput) {
  const origin = site.replace(/\/+$/, "");
  const first = name.trim().split(/\s+/)[0] || "there";
  const host = origin.replace(/^https?:\/\//, "");
  const safeLink = escapeHtml(link);
  const subject = "Welcome to Vista Chase! Please verify your email";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#e9ebe7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Verify your email to activate your Vista Chase account and see your bookings under My Trips.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9ebe7;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;font-family:'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif;">
      <tr><td align="center" style="background:${OBSIDIAN};padding:28px 24px 22px;">
        <a href="${origin}" style="text-decoration:none;"><img src="${origin}/media/email/logo-white.png" width="120" height="95" alt="Vista Chase" style="display:block;border:0;width:120px;height:auto;"></a>
      </td></tr>
      <tr><td style="background:${OBSIDIAN};padding:0;">
        <img src="${origin}/media/email/verify-banner.jpg" width="600" alt="Moraine Lake in Banff National Park" style="display:block;border:0;width:100%;max-width:600px;height:auto;">
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:${GOLD};">&nbsp;</td></tr>
      <tr><td align="center" style="background:${FROST};padding:36px 32px 8px;">
        <h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:500;color:${OBSIDIAN};">Welcome to Vista Chase!</h1>
        <p style="margin:18px 0 0;font-size:17px;line-height:1.5;color:${OBSIDIAN};">Hi ${escapeHtml(first)},</p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.65;color:${BODY};">Thank you for creating your Vista Chase account. Please verify your email address to activate your account and see all your bookings under My Trips.</p>
      </td></tr>
      <tr><td align="center" style="background:${FROST};padding:26px 32px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:420px;">
          <tr><td align="center" bgcolor="${TEAL}" style="background:${TEAL};border-radius:6px;">
            <a href="${safeLink}" style="display:block;padding:15px 24px;font-size:17px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;">Verify My Email</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="background:${FROST};padding:18px 32px 0;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="margin:6px 0 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeLink}" style="color:${TEAL};">${safeLink}</a></p>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">This link works once. If you didn't create a Vista Chase account, you can safely ignore this email.</p>
      </td></tr>
      <tr><td style="background:${FROST};padding:28px 32px 0;"><div style="border-top:1px solid #dcded8;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td align="center" style="background:${FROST};padding:18px 32px 30px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:${OBSIDIAN};">Vista Chase · Explore the Canadian Rockies</p>
        <p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:${MUTED};">
          <a href="${origin}" style="color:${TEAL};text-decoration:none;">${escapeHtml(host)}</a>
          &nbsp;·&nbsp; <a href="mailto:support@vistachase.com" style="color:${TEAL};text-decoration:none;">support@vistachase.com</a>
          &nbsp;·&nbsp; <a href="tel:+18257349456" style="color:${TEAL};text-decoration:none;">+1 (825) 734-9456</a>
        </p>
        <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">Lines open 6 a.m. – 9 p.m. Mountain Time · Canmore, Alberta, Canada</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    "Welcome to Vista Chase!",
    "",
    `Hi ${first},`,
    "",
    "Thank you for creating your Vista Chase account. Please verify your email address to activate your account and see all your bookings under My Trips.",
    "",
    `Verify my email: ${link}`,
    "",
    "This link works once. If you didn't create a Vista Chase account, you can safely ignore this email.",
    "",
    "Vista Chase · Explore the Canadian Rockies",
    `${host} · support@vistachase.com · +1 (825) 734-9456`,
  ].join("\n");

  return { subject, html, text };
}
