import { renderMasterEmail } from "@/lib/email/email-template";

export interface PasswordResetEmailInput {
  name: string;
  link: string;
  site?: string;
}

export function renderPasswordResetEmail({ name, link, site }: PasswordResetEmailInput) {
  const first = name.trim() || "there";

  return renderMasterEmail({
    site,
    subject: "Reset your Vista Chase password",
    preheader: "Reset your password for your Vista Chase account. Link expires in 1 hour.",
    title: "Reset Your Password",
    greeting: `Hi ${first},`,
    paragraphs: [
      "We received a request to reset the password for your Vista Chase account.",
      "Click the button below to choose a new secure password:",
    ],
    cta: {
      label: "Reset Password",
      url: link,
    },
    fallbackText: "If the button doesn't work, copy and paste this link into your browser:",
    fallbackUrl: link,
    disclaimer: "This link works once and expires in 1 hour. If you didn't ask for this, you can safely ignore this email.",
    plainTextLines: [
      "Reset your Vista Chase password",
      "",
      `Hi ${first},`,
      "",
      `Choose a new password: ${link}`,
      "",
      "This link works once and expires in 1 hour. If you didn't ask for this, ignore this email.",
      "",
      "© Vista Chase | Explore the Canadian Rockies",
      "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456",
    ],
  });
}
