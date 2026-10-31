// Runs the frequent jobs inside the API process when there is no separate worker (Render's free
// plan has none). Turned on with RUN_JOBS_IN_API=true; with a worker running, leave it off so the
// jobs don't run twice. Nightly emails stay with the worker. A run is skipped while the previous one
// of the same job is still going.

import { expireHoldsAndUnpaidBookings, maturePartnerCommissions, sendBookingsToBokun, syncSeatsFromBokun, publishScheduledSeoPages, remindUnpaidBalances, retryConfirmationEmails, runNightlySeoAudit, sendT60WhatsApp, syncWebflowBlogPosts, whatsAppDeliveryConfigured } from "@/jobs/tasks";
import { isWebflowSyncEnabled, webflowSyncMinutes } from "@/modules/seo/portal/webflow-sync";

type Job = { name: string; everyMs: number; run: () => Promise<unknown> };

/**
 * Bókun jobs (docs/BOKUN.md). They run in the API whenever Bókun is connected, even without
 * RUN_JOBS_IN_API, so bookings reach Bókun with no worker; both are safe to run twice.
 */
export const BOKUN_JOBS: Job[] = [
  { name: "bokun-bookings", everyMs: 2 * 60 * 1000, run: () => sendBookingsToBokun() },
  { name: "bokun-seats", everyMs: 15 * 60 * 1000, run: () => syncSeatsFromBokun() },
];

const JOBS: Job[] = [
  { name: "expire-holds", everyMs: 5 * 60 * 1000, run: () => expireHoldsAndUnpaidBookings() },
  // Idempotent and cheap, so hourly is fine where there is no worker for the 03:00 run.
  { name: "partner-commissions", everyMs: 60 * 60 * 1000, run: () => maturePartnerCommissions() },
  { name: "seo-scheduled-publish", everyMs: 5 * 60 * 1000, run: () => publishScheduledSeoPages() },
  { name: "balance-reminders", everyMs: 60 * 60 * 1000, run: () => remindUnpaidBalances() },
  { name: "confirmation-email-retry", everyMs: 15 * 60 * 1000, run: () => retryConfirmationEmails() },
  // Reads every public page once a day; the audit itself skips a run while one is in progress.
  { name: "seo-audit", everyMs: 24 * 60 * 60 * 1000, run: () => runNightlySeoAudit() },
  // Only when switched on (WEBFLOW_SYNC_ENABLED=true and WEBFLOW_API_TOKEN), every WEBFLOW_SYNC_MINUTES.
  ...(isWebflowSyncEnabled() ? [{ name: "webflow-blog-sync", everyMs: webflowSyncMinutes() * 60 * 1000, run: () => syncWebflowBlogPosts() }] : []),
  // Only with a real WhatsApp provider (tasks.ts sendT60WhatsApp).
  ...(whatsAppDeliveryConfigured() ? [{ name: "whatsapp-t60", everyMs: 5 * 60 * 1000, run: () => sendT60WhatsApp() }] : []),
];

export function startInProcessJobs(jobs: Job[] = [...JOBS, ...BOKUN_JOBS]) {
  const timers = jobs.map((job) => {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        console.log(`[jobs] ${job.name} done`, JSON.stringify(await job.run()));
      } catch (error) {
        console.error(`[jobs] ${job.name} failed: ${(error as Error).message}`);
      } finally {
        running = false;
      }
    };
    setTimeout(tick, 10_000).unref(); // shortly after start-up, then on schedule
    return setInterval(tick, job.everyMs).unref();
  });
  console.log("[jobs] running in the API process:", jobs.map((j) => j.name).join(", "));
  return () => timers.forEach(clearInterval);
}
