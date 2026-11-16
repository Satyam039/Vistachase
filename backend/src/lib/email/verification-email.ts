// "Welcome to Vista Chase!" account verification email.
// Matches the official template in media/user_uploaded screenshot:
// dark header with logo + panoramic Lake Louise/Moraine banner,
// clean white container, "Welcome to Vista Chase!", "Verify My Email" button,
// fallback link, security disclaimer, and official footer.

import { renderMasterEmail } from "@/lib/email/email-template";

export interface VerificationEmailInput {
  name: string;
  link: string;
  site?: string;
}

export function renderVerificationEmail({ name, link, site }: VerificationEmailInput) {
  const first = name.trim().split(/\s+/)[0] || "there";

  return renderMasterEmail({
    site,
    subject: "Welcome to Vista Chase! Please verify your email",
    preheader: "Verify your email to activate your Vista Chase account and see your bookings under My Trips.",
    title: "Welcome to Vista Chase!",
    greeting: `Hi ${first},`,
    paragraphs: [
      "Thank you for creating your Vista Chase account. Please verify your email address to activate your account and access all your bookings under My Trips.",
    ],
    cta: {
      label: "Verify My Email",
      url: link,
    },
    fallbackText: "If the button doesn't work, use the verification link provided below.",
    fallbackUrl: link,
    disclaimer: "If you didn't create a Vista Chase account, you can safely ignore this email.",
  });
}
