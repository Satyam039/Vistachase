import { renderMasterEmail } from "@/lib/email/email-template";

export interface PhoneChangedEmailInput {
  name: string;
  phone: string;
  site?: string;
}

export function renderPhoneChangedEmail({ name, phone, site }: PhoneChangedEmailInput) {
  const first = name.trim().split(/\s+/)[0] || "there";

  return renderMasterEmail({
    site,
    subject: "Your Vista Chase phone number has been updated",
    preheader: "Your registered phone number on your Vista Chase account was updated.",
    title: "Phone Number Updated",
    greeting: `Hi ${first},`,
    paragraphs: [
      `Your registered contact phone number for your Vista Chase account has been successfully updated to <strong>${phone}</strong>.`,
      "Our team and guides will use this number if we need to reach you on the day of your tour or shuttle departure.",
    ],
    cta: {
      label: "View Account Settings",
      url: `${(site || "https://www.vistachase.com").replace(/\/+$/, "")}/account/settings`,
    },
    disclaimer: "If you did not make this change, please sign in to review your profile or contact us at support@vistachase.com.",
    plainTextLines: [
      "Your Vista Chase phone number has been updated",
      "",
      `Hi ${first},`,
      "",
      `Your contact phone number has been updated to: ${phone}`,
      "",
      "If you did not make this change, please sign in to review your profile or contact us.",
      "",
      "© Vista Chase | Explore the Canadian Rockies",
      "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456",
    ],
  });
}
