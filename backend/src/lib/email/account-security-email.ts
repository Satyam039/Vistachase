import { renderMasterEmail } from "@/lib/email/email-template";

// Notices for My Account (account.routes.ts): the password was changed, the account was deleted.
// Neither carries a link that signs anyone in.

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const origin = (site?: string) => (site || "https://www.vistachase.com").replace(/\/+$/, "");
const FOOTER = ["", "© Vista Chase | Explore the Canadian Rockies", "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456"];

export function renderPasswordChangedEmail({ name, site }: { name: string; site?: string }) {
  const first = firstName(name);
  return renderMasterEmail({
    site,
    subject: "Your Vista Chase password was changed",
    preheader: "The password for your Vista Chase account was just changed.",
    title: "Password Changed",
    greeting: `Hi ${first},`,
    paragraphs: [
      "The password for your Vista Chase account was just changed, and every other device signed in to your account has been signed out.",
    ],
    cta: { label: "Forgot password? Reset it", url: `${origin(site)}/forgot-password` },
    disclaimer: "If you did not make this change, reset your password straight away with the button above and contact us at support@vistachase.com.",
    plainTextLines: [
      "Your Vista Chase password was changed",
      "",
      `Hi ${first},`,
      "",
      "The password for your Vista Chase account was just changed, and every other device was signed out.",
      `If this wasn't you, reset your password now: ${origin(site)}/forgot-password`,
      ...FOOTER,
    ],
  });
}

export function renderAccountDeletedEmail({ name, site }: { name: string; site?: string }) {
  const first = firstName(name);
  return renderMasterEmail({
    site,
    subject: "Your Vista Chase account has been deleted",
    preheader: "Your Vista Chase account and sign-in have been permanently deleted.",
    title: "Account Deleted",
    greeting: `Hi ${first},`,
    paragraphs: [
      "Your Vista Chase account has been permanently deleted, and you can no longer sign in with it.",
      "Records of trips you booked with us are kept for tax, refund and safety purposes, as described in our Privacy Policy. Your vouchers still work from the links in your booking emails.",
      "You're always welcome back: you can book as a guest or create a new account at any time.",
    ],
    disclaimer: "If you did not ask for this, contact us at support@vistachase.com.",
    plainTextLines: [
      "Your Vista Chase account has been deleted",
      "",
      `Hi ${first},`,
      "",
      "Your Vista Chase account has been permanently deleted, and you can no longer sign in with it.",
      "Records of trips you booked are kept for tax, refund and safety purposes. Your vouchers still work from the links in your booking emails.",
      ...FOOTER,
    ],
  });
}
