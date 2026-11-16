import { renderMasterEmail } from "@/lib/email/email-template";

export interface LoginOtpEmailInput {
  name: string;
  otp: string;
  site?: string;
}

export function renderLoginOtpEmail({ name, otp, site }: LoginOtpEmailInput) {
  const first = name.trim() || "there";

  const customHtml = `
    <div style="margin:20px 0 16px;text-align:center;">
      <div style="display:inline-block;padding:14px 36px;font-size:32px;font-weight:700;letter-spacing:8px;color:#14363a;background-color:#f0f9fa;border:2px dashed #257780;border-radius:8px;font-family:'Courier New',Courier,monospace;">
        ${otp}
      </div>
    </div>
  `;

  return renderMasterEmail({
    site,
    subject: `Your Vista Chase verification code: ${otp}`,
    preheader: `Your 6-digit login verification code is ${otp}. Valid for 10 minutes.`,
    title: "Verification Code",
    greeting: `Hi ${first},`,
    paragraphs: [
      "We received a request to sign in to your Vista Chase account.",
      "Enter the 6-digit verification code below to complete your login:",
    ],
    customHtml,
    disclaimer: "This code is valid for 10 minutes. Never share this code with anyone. If you didn't attempt to sign in, please ignore this email or update your password.",
    plainTextLines: [
      "Your Vista Chase Verification Code",
      "",
      `Hi ${first},`,
      "",
      `Your 6-digit login code is: ${otp}`,
      "",
      "This code is valid for 10 minutes. If you did not attempt to sign in, please ignore this message.",
      "",
      "© Vista Chase | Explore the Canadian Rockies",
      "www.vistachase.com · support@vistachase.com · +1 (825) 734-9456",
    ],
  });
}
