// Configuration warnings printed when the API starts. Only DATABASE_URL and JWT_SECRET stop the
// boot (server.ts); everything here is a loud warning instead, so a missing key never takes the
// live site down, but nobody can miss it in the PM2 log either.

const EXAMPLE_JWT_SECRETS = ["super-secret-jwt-token-vista-chase-rockies-2026-development-only", "super-secret-test-key-must-be-32-chars!"];

export function configWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  const warnings: string[] = [];
  const production = env.NODE_ENV === "production";

  if (env.JWT_SECRET && EXAMPLE_JWT_SECRETS.includes(env.JWT_SECRET)) {
    warnings.push("JWT_SECRET is the example value from .env.example: anyone can forge sign-ins. Set a long random secret.");
  }
  if (!production) {
    warnings.push(`NODE_ENV is "${env.NODE_ENV ?? ""}", not "production": test-only features (mock payments, test promo codes) may be on.`);
  }
  if (!env.VOUCHER_SECRET) {
    warnings.push("VOUCHER_SECRET is not set: voucher, check-in and review links are signed with JWT_SECRET.");
  }

  const stripeKey = env.STRIPE_SECRET_KEY ?? "";
  if (!stripeKey) warnings.push("STRIPE_SECRET_KEY is not set: card payments are off.");
  else if (stripeKey.startsWith("sk_test_")) warnings.push("Stripe is in TEST mode (sk_test_…): no real money is taken; anyone can book with a test card.");
  if (stripeKey && !env.STRIPE_WEBHOOK_SECRET) {
    warnings.push("STRIPE_WEBHOOK_SECRET is not set: paid bookings won't confirm from Stripe and refunds won't be recorded.");
  }
  if (env.FEATURE_MOCK_PAYMENT === "true") {
    warnings.push("FEATURE_MOCK_PAYMENT=true: bookings are confirmed without any payment. Never on the live site.");
  }

  const emailProvider = env.EMAIL_PROVIDER || "console";
  const smtpReady = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  if (!((emailProvider === "resend" && env.RESEND_API_KEY) || (emailProvider === "smtp" && smtpReady))) {
    const missing = emailProvider === "resend" ? " without RESEND_API_KEY" : emailProvider === "smtp" ? " without SMTP_HOST, SMTP_USER and SMTP_PASS" : "";
    warnings.push(`Email is not being sent (EMAIL_PROVIDER=${emailProvider}${missing}): confirmations, password resets and email confirmation links only go to the log.`);
  }
  const whatsapp = (env.WHATSAPP_PROVIDER || "console").toLowerCase();
  if (whatsapp !== "twilio" && whatsapp !== "meta") {
    warnings.push("WHATSAPP_PROVIDER is not twilio or meta: T-60 pickup messages are not sent.");
  }
  if (!env.FRONTEND_URL) {
    warnings.push("FRONTEND_URL is not set: links in emails use https://www.vistachase.com, which must serve this site.");
  } else if (production && /localhost|127\.0\.0\.1/.test(env.FRONTEND_URL)) {
    warnings.push("FRONTEND_URL points at localhost: links in emails won't open for guests.");
  }
  return warnings;
}

export function logConfigWarnings() {
  const warnings = configWarnings();
  if (warnings.length === 0) return;
  console.warn(`[config] ${warnings.length} warning(s):\n  - ${warnings.join("\n  - ")}`);
}
