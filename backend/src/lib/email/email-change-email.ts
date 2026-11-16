import { renderMasterEmail } from "@/lib/email/email-template";

export interface EmailChangeVerificationInput {
  name: string;
  newEmail: string;
  link: string;
  site?: string;
}

export function renderEmailChangeVerificationEmail({ name, newEmail, link, site }: EmailChangeVerificationInput) {
  const first = name.trim().split(/\s+/)[0] || "there";

  return renderMasterEmail({
    site,
    subject: "Verify your new email address for Vista Chase",
    preheader: "Confirm your new email address to complete your account update. Link expires in 24 hours.",
    title: "Verify New Email Address",
    greeting: `Hi ${first},`,
    paragraphs: [
      `We received a request to change your registered Vista Chase account email address to <strong>${newEmail}</strong>.`,
      "Please click the button below to confirm and activate this email address for your account:",
    ],
    cta: {
      label: "Confirm Email Address",
      url: link,
    },
    fallbackText: "If the button doesn't work, copy and paste this verification link into your browser:",
    fallbackUrl: link,
    disclaimer: "This link expires in 24 hours. If you did not request this change, please ignore this email and your account email will remain unchanged.",
    plainTextLines: [
      "Verify your new email address for Vista Chase",
      "",
      `Hi ${first},`,
      "",
      `We received a request to update your Vista Chase account email to ${newEmail}.`,
      `Confirm your new email address: ${link}`,
      "",
      "This link expires in 24 hours. If you didn't request this change, please ignore this message.",
      "",
      "© Vista Chase | Explore the Canadian Rockies",
      "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456",
    ],
  });
}

export interface EmailChangedNotificationInput {
  name: string;
  newEmail: string;
  site?: string;
}

export function renderEmailChangedConfirmationEmail({ name, newEmail, site }: EmailChangedNotificationInput) {
  const first = name.trim().split(/\s+/)[0] || "there";

  return renderMasterEmail({
    site,
    subject: "Your Vista Chase account email has been updated",
    preheader: "Your account email was successfully updated to your new address.",
    title: "Email Address Updated",
    greeting: `Hi ${first},`,
    paragraphs: [
      `Your Vista Chase account email address has been successfully changed to <strong>${newEmail}</strong>.`,
      "From now on, please use this new email address to sign in and receive booking confirmations and trip updates.",
    ],
    cta: {
      label: "Go to My Account",
      url: `${(site || "https://www.vistachase.com").replace(/\/+$/, "")}/account/trips`,
    },
    disclaimer: "If you did not make this change, please contact our support team immediately at support@vistachase.com or +1 (825) 734-9456.",
    plainTextLines: [
      "Your Vista Chase account email has been updated",
      "",
      `Hi ${first},`,
      "",
      `Your account email address has been successfully updated to: ${newEmail}`,
      "",
      "If you did not make this change, please contact us immediately.",
      "",
      "© Vista Chase | Explore the Canadian Rockies",
      "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456",
    ],
  });
}
