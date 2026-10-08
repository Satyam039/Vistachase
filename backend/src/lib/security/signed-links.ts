// Signed links for a booking: the voucher page, staff check-in, reviews and self-service cancel
// are opened with a token only the booking's emails contain, never with the reference alone
// (references are printed on vouchers and easy to share or guess).

import crypto from "node:crypto";

export type BookingLinkPurpose = "voucher" | "checkin" | "review";

function secret(): string {
  const value = process.env.VOUCHER_SECRET || process.env.JWT_SECRET;
  if (!value) throw new Error("VOUCHER_SECRET or JWT_SECRET must be set to sign booking links.");
  return value;
}

export function signBookingLink(reference: string, purpose: BookingLinkPurpose): string {
  return crypto.createHmac("sha256", secret()).update(`${purpose}:${reference}`).digest("hex").slice(0, 32);
}

export function verifyBookingLink(reference: string, purpose: BookingLinkPurpose, token: unknown): boolean {
  if (typeof token !== "string" || token.length !== 32) return false;
  const expected = Buffer.from(signBookingLink(reference, purpose));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function siteUrl(): string {
  return (process.env.FRONTEND_URL || "https://www.vistachase.com").replace(/\/$/, "");
}

/** The guest's voucher page, openable only with this link. */
export function voucherLink(reference: string): string {
  return `${siteUrl()}/booking/${encodeURIComponent(reference)}/voucher?t=${signBookingLink(reference, "voucher")}`;
}

/** What the voucher QR code holds: staff scan it to check the guest in. */
export function checkinLink(reference: string): string {
  return `${siteUrl()}/admin/checkin?ref=${encodeURIComponent(reference)}&sig=${signBookingLink(reference, "checkin")}`;
}

export function reviewLink(reference: string): string {
  return `${siteUrl()}/review/${encodeURIComponent(reference)}?t=${signBookingLink(reference, "review")}`;
}
