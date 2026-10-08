import * as Sentry from "@sentry/nextjs";

// Error tracking, on only when NEXT_PUBLIC_SENTRY_DSN is set. Loaded by instrumentation*.ts.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
