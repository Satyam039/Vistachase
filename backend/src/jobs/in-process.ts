// Runs the frequent jobs inside the API process when there is no separate worker (Render's free
// plan has none). Turned on with RUN_JOBS_IN_API=true; with a worker running, leave it off so the
// jobs don't run twice. Nightly emails stay with the worker. A run is skipped while the previous one
// of the same job is still going.

import { expireHoldsAndUnpaidBookings, syncBokunDepartures } from "@/jobs/tasks";

const JOBS: { name: string; everyMs: number; run: () => Promise<unknown> }[] = [
  { name: "expire-holds", everyMs: 5 * 60 * 1000, run: () => expireHoldsAndUnpaidBookings() },
  { name: "bokun-availability", everyMs: 15 * 60 * 1000, run: () => syncBokunDepartures() },
];

export function startInProcessJobs() {
  const timers = JOBS.map((job) => {
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
  console.log("[jobs] running in the API process:", JOBS.map((j) => j.name).join(", "));
  return () => timers.forEach(clearInterval);
}
