// Next.js server start-up hook: loads server-side error tracking (sentry.server.config.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
