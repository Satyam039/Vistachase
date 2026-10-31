import "dotenv/config";
import { getEmailProvider, emailDeliveryConfigured } from "../src/lib/email/email.provider";

async function main() {
  const recipient = process.argv[2] || process.env.ENQUIRIES_TO || process.env.ADMIN_EMAIL || "test@example.com";
  const providerType = (process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "console")).toLowerCase();

  console.log("\n=======================================================");
  console.log("       Vista Chase Email Delivery Diagnostic");
  console.log("=======================================================");
  console.log(`Active Provider Setting: ${process.env.EMAIL_PROVIDER || "(not set, auto-detected)"}`);
  console.log(`Effective Provider:      ${providerType}`);
  console.log(`EMAIL_FROM:              ${process.env.EMAIL_FROM || "bookings@vistachase.com"}`);
  console.log(`Test Recipient:          ${recipient}`);
  console.log(`Delivery Configured:     ${emailDeliveryConfigured() ? "YES (live sending)" : "NO (console only)"}`);

  if (providerType === "resend") {
    const key = process.env.RESEND_API_KEY || "";
    console.log(`RESEND_API_KEY:          ${key ? `${key.slice(0, 7)}...${key.slice(-4)}` : "MISSING!"}`);
  } else if (providerType === "smtp") {
    console.log(`SMTP Host:               ${process.env.SMTP_HOST || "MISSING"}`);
    console.log(`SMTP Port:               ${process.env.SMTP_PORT || "587"}`);
    console.log(`SMTP User:               ${process.env.SMTP_USER || "MISSING"}`);
  }
  console.log("-------------------------------------------------------\n");

  const provider = getEmailProvider();
  console.log(`Initiating test send via ${provider.constructor.name}...`);

  const result = await provider.sendEmail({
    to: recipient,
    subject: `Vista Chase Test Email (${new Date().toLocaleString()})`,
    text: `This is a test email sent from Vista Chase backend on ${new Date().toISOString()}.\nIf you received this, your email integration is working properly!`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #257780; margin-top: 0;">Vista Chase Email Test</h2>
        <p>This is a verification email from your Vista Chase server.</p>
        <p><strong>Status:</strong> ✅ Delivery Working</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Provider:</strong> ${providerType.toUpperCase()}</p>
      </div>
    `,
  });

  if (result.success) {
    console.log("\n✅ SUCCESS: Email dispatched successfully!");
    console.log(`Message ID: ${result.messageId}`);
    if (providerType === "console") {
      console.log("\n⚠️ Note: The email was sent to CONSOLE (mock mode). To send to real inboxes, configure RESEND_API_KEY or SMTP credentials in your .env.");
    } else {
      console.log(`Check inbox at: ${recipient} (also check Spam/Junk folder if not received in 1-2 minutes).`);
    }
  } else {
    console.error("\n❌ FAILED: Email dispatch failed.");
    console.error(`Error details: ${result.error}`);
    console.log("\nTroubleshooting tips:");
    if (providerType === "resend") {
      console.log("1. If the error mentions 'domain is not verified':");
      console.log("   - In Resend, go to https://resend.com/domains and verify vistachase.com.");
      console.log("   - OR temporarily set EMAIL_FROM='onboarding@resend.dev' in .env and send ONLY to your Resend account email.");
      console.log("2. If the error mentions 'API key': ensure RESEND_API_KEY starts with 're_'.");
    } else if (providerType === "smtp") {
      console.log("1. Verify your SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
      console.log("2. For Gmail, generate an 'App Password' from Google Account Security.");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
