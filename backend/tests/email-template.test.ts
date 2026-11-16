import { describe, it, expect } from "vitest";
import { renderMasterEmail } from "@/lib/email/email-template";
import { renderLoginOtpEmail } from "@/lib/email/login-otp-email";
import { renderPasswordResetEmail } from "@/lib/email/password-reset-email";
import { renderVerificationEmail } from "@/lib/email/verification-email";
import { renderEmailChangeVerificationEmail, renderEmailChangedConfirmationEmail } from "@/lib/email/email-change-email";
import { renderPhoneChangedEmail } from "@/lib/email/phone-changed-email";

describe("Master Email Template", () => {
  it("renders consistent header banner, brand colors, and footer", () => {
    const rendered = renderMasterEmail({
      site: "https://www.vistachase.com",
      subject: "Test Email Subject",
      preheader: "Preview text for test email",
      title: "Welcome to Vista Chase!",
      greeting: "Hi Ravinder Singh,",
      paragraphs: [
        "Thank you for creating your Vista Chase account.",
        "Please verify your email address to activate your account.",
      ],
      cta: {
        label: "Verify My Email",
        url: "https://www.vistachase.com/verify-email?token=abcdef123456",
      },
      fallbackText: "If the button doesn't work, use the verification link provided below.",
      fallbackUrl: "https://www.vistachase.com/verify-email?token=abcdef123456",
      disclaimer: "If you didn't create a Vista Chase account, you can safely ignore this email.",
    });

    // Check subject
    expect(rendered.subject).toBe("Test Email Subject");

    // Check preheader
    expect(rendered.html).toContain("Preview text for test email");

    // Check brand dark header (#0c1f21), gold accent line (#f5bf03), and white card
    expect(rendered.html).toContain("#0c1f21");
    expect(rendered.html).toContain("#f5bf03");
    expect(rendered.html).toContain("/media/email/logo-white.png");
    expect(rendered.html).toContain("/media/email/verify-banner.jpg");

    // Check content
    expect(rendered.html).toContain("Welcome to Vista Chase!");
    expect(rendered.html).toContain("Hi Ravinder Singh,");
    expect(rendered.html).toContain("Thank you for creating your Vista Chase account.");

    // Check CTA button styling
    expect(rendered.html).toContain("#14363a");
    expect(rendered.html).toContain("Verify My Email");
    expect(rendered.html).toContain("https://www.vistachase.com/verify-email?token=abcdef123456");

    // Check footer elements
    expect(rendered.html).toContain("&copy; Vista Chase | Explore the Canadian Rockies");
    expect(rendered.html).toContain("www.vistachase.com");
    expect(rendered.html).toContain("support@vistachase.com");
    expect(rendered.html).toContain("+1 (825) 734-9456");

    // Check plain text fallback
    expect(rendered.text).toContain("Welcome to Vista Chase!");
    expect(rendered.text).toContain("Hi Ravinder Singh,");
    expect(rendered.text).toContain("Verify My Email: https://www.vistachase.com/verify-email?token=abcdef123456");
  });

  it("renders login OTP email with 6-digit verification code", () => {
    const rendered = renderLoginOtpEmail({
      name: "John Doe",
      otp: "849201",
      site: "https://www.vistachase.com",
    });

    expect(rendered.subject).toContain("849201");
    expect(rendered.html).toContain("849201");
    expect(rendered.html).toContain("Hi John,");
    expect(rendered.html).toContain("Verification Code");
    expect(rendered.html).toContain("Valid for 10 minutes");
    expect(rendered.text).toContain("849201");
  });

  it("renders password reset email with secure CTA and expiry", () => {
    const rendered = renderPasswordResetEmail({
      name: "Jane Smith",
      link: "https://www.vistachase.com/reset-password?token=12345",
      site: "https://www.vistachase.com",
    });

    expect(rendered.subject).toBe("Reset your Vista Chase password");
    expect(rendered.html).toContain("Reset Your Password");
    expect(rendered.html).toContain("Hi Jane,");
    expect(rendered.html).toContain("Reset Password");
    expect(rendered.html).toContain("expires in 1 hour");
  });

  it("renders email change verification email", () => {
    const rendered = renderEmailChangeVerificationEmail({
      name: "Alice",
      newEmail: "newalice@example.com",
      link: "https://www.vistachase.com/verify-email-change?token=tok123",
      site: "https://www.vistachase.com",
    });

    expect(rendered.subject).toContain("Verify your new email address");
    expect(rendered.html).toContain("newalice@example.com");
    expect(rendered.html).toContain("Confirm Email Address");
  });

  it("renders email changed confirmation notification", () => {
    const rendered = renderEmailChangedConfirmationEmail({
      name: "Alice",
      newEmail: "newalice@example.com",
      site: "https://www.vistachase.com",
    });

    expect(rendered.subject).toContain("Your Vista Chase account email has been updated");
    expect(rendered.html).toContain("newalice@example.com");
    expect(rendered.html).toContain("Go to My Account");
  });

  it("renders phone changed confirmation notification", () => {
    const rendered = renderPhoneChangedEmail({
      name: "Bob",
      phone: "+1 403 555 0123",
      site: "https://www.vistachase.com",
    });

    expect(rendered.subject).toContain("Your Vista Chase phone number has been updated");
    expect(rendered.html).toContain("+1 403 555 0123");
    expect(rendered.html).toContain("View Account Settings");
  });
});
