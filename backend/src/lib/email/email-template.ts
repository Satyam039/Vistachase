// Consistent, professional Vista Chase email template.
// Follows the brand design (dark banner with logo and Moraine Lake panorama, gold accent line,
// clean white card container, navy CTA button, and official contact footer).
// Safe for all email clients: table-based layout, inline CSS, high-contrast typography.

import { siteUrl } from "@/lib/security/signed-links";

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface MasterEmailOptions {
  site?: string;
  subject: string;
  preheader?: string;
  title: string;
  greeting?: string;
  paragraphs?: string[];
  customHtml?: string;
  cta?: {
    label: string;
    url: string;
  };
  secondaryButtons?: Array<{
    label: string;
    url: string;
  }>;
  fallbackText?: string;
  fallbackUrl?: string;
  disclaimer?: string;
  plainTextLines?: string[];
}

export function renderMasterEmail(opts: MasterEmailOptions): { subject: string; html: string; text: string } {
  const origin = (opts.site || siteUrl()).replace(/\/+$/, "");
  const host = origin.replace(/^https?:\/\//, "");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
      <!-- Header Banner with Logo & Scenic Image -->
      <tr><td align="center" style="background-color:#0c1f21;padding:24px 20px 18px;">
        <a href="${origin}" style="text-decoration:none;"><img src="${origin}/media/email/logo-white.png" width="115" height="91" alt="Vista Chase" style="display:block;border:0;width:115px;height:auto;"></a>
      </td></tr>
      <tr><td style="background-color:#0c1f21;padding:0;">
        <img src="${origin}/media/email/verify-banner.jpg" width="600" alt="Vista Chase Canadian Rockies" style="display:block;border:0;width:100%;max-width:600px;height:auto;">
      </td></tr>
      <tr><td style="height:3px;line-height:3px;font-size:0;background-color:#f5bf03;">&nbsp;</td></tr>

      <!-- Main Body -->
      <tr><td align="center" style="padding:32px 28px 12px;background-color:#ffffff;">
        <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;color:#1c1f23;text-align:center;">${escapeHtml(opts.title)}</h1>
        ${opts.greeting ? `<p style="margin:16px 0 0;font-size:16px;line-height:1.5;font-weight:600;color:#1c1f23;text-align:center;">${escapeHtml(opts.greeting)}</p>` : ""}
        ${opts.paragraphs ? opts.paragraphs.map((p) => `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#374151;text-align:center;">${p}</p>`).join("") : ""}
        ${opts.customHtml ? `<div style="margin-top:16px;text-align:left;">${opts.customHtml}</div>` : ""}
      </td></tr>

      <!-- CTA Button -->
      ${opts.cta ? `
      <tr><td align="center" style="padding:18px 28px 8px;background-color:#ffffff;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr><td align="center" bgcolor="#14363a" style="background-color:#14363a;border-radius:8px;">
            <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>
          </td></tr>
        </table>
      </td></tr>` : ""}

      <!-- Secondary Buttons (e.g. Calendar links) -->
      ${opts.secondaryButtons && opts.secondaryButtons.length > 0 ? `
      <tr><td align="center" style="padding:10px 28px 8px;background-color:#ffffff;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            ${opts.secondaryButtons.map((btn) => `
            <td style="padding:4px 6px;">
              <a href="${escapeHtml(btn.url)}" style="display:inline-block;padding:8px 16px;font-size:13px;font-weight:600;color:#257780;text-decoration:none;border:1px solid #257780;border-radius:6px;">${escapeHtml(btn.label)}</a>
            </td>`).join("")}
          </tr>
        </table>
      </td></tr>` : ""}

      <!-- Fallback Link & Disclaimers -->
      ${opts.fallbackUrl || opts.disclaimer ? `
      <tr><td align="center" style="padding:16px 28px 0;background-color:#ffffff;">
        ${opts.fallbackUrl ? `
        <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;text-align:center;">
          ${escapeHtml(opts.fallbackText || "If the button doesn't work, use the verification link provided below.")}
        </p>
        <p style="margin:6px 0 0;font-size:13px;line-height:1.5;word-break:break-all;text-align:center;">
          <a href="${escapeHtml(opts.fallbackUrl)}" style="color:#257780;text-decoration:underline;">${escapeHtml(opts.fallbackUrl)}</a>
        </p>` : ""}
        ${opts.disclaimer ? `
        <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
          ${escapeHtml(opts.disclaimer)}
        </p>` : ""}
      </td></tr>` : ""}

      <!-- Divider -->
      <tr><td style="padding:24px 28px 0;background-color:#ffffff;">
        <div style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</div>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:18px 28px 24px;background-color:#ffffff;">
        <p style="margin:0;font-size:13px;font-weight:500;color:#1c1f23;text-align:center;">
          &copy; Vista Chase | Explore the Canadian Rockies
        </p>
        <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#6b7280;text-align:center;">
          <a href="${origin}" style="color:#257780;text-decoration:none;">www.vistachase.com</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:support@vistachase.com" style="color:#257780;text-decoration:none;">support@vistachase.com</a>
          &nbsp;&middot;&nbsp;
          <a href="tel:+18257349456" style="color:#257780;text-decoration:none;">+1 (825) 734-9456</a>
        </p>
        <p style="margin:4px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">
          Lines open 6 a.m. &ndash; 9 p.m. Mountain Time &middot; Canmore, Alberta, Canada
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textLines = opts.plainTextLines ?? [
    opts.title,
    "",
    ...(opts.greeting ? [opts.greeting, ""] : []),
    ...(opts.paragraphs ? opts.paragraphs.map((p) => p.replace(/<[^>]+>/g, "")) : []),
    "",
    ...(opts.cta ? [`${opts.cta.label}: ${opts.cta.url}`, ""] : []),
    ...(opts.fallbackUrl ? [`Link: ${opts.fallbackUrl}`, ""] : []),
    ...(opts.disclaimer ? [opts.disclaimer, ""] : []),
    "© Vista Chase | Explore the Canadian Rockies",
    `${host} · support@vistachase.com · +1 (825) 734-9456`,
  ];

  return {
    subject: opts.subject,
    html,
    text: textLines.join("\n"),
  };
}
