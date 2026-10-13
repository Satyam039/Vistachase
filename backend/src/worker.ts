// Background worker: a separate process from the API (render.yaml "vistachase-worker",
// docker-compose "worker"). It schedules and runs the recurring jobs in src/jobs/tasks.ts on a
// BullMQ queue in Redis, so only one worker runs each job even with several instances.
//
//   every 5 minutes   expire holds and unpaid bookings (frees their seats)
//   02:00 Mountain    reconcile bookings and email staff anything that needs a person
//   10:00 Mountain    ask yesterday's guests for a review (once each)
//   03:00 Mountain    partner commission for tours that ran becomes payable; old clicks deleted
//   every 5 minutes   SEO pages scheduled to publish go live
//   04:00 Mountain    SEO audit of the live pages (docs/SEO.md)

import "dotenv/config";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import prisma from "@/lib/db/prisma";
import { expireHoldsAndUnpaidBookings, maturePartnerCommissions, publishScheduledSeoPages, reconcileBookings, runNightlySeoAudit, sendReviewRequests } from "@/jobs/tasks";

const QUEUE = "vista-chase-jobs";
const TZ = "America/Edmonton";

const JOBS: Record<string, () => Promise<unknown>> = {
  "expire-holds": () => expireHoldsAndUnpaidBookings(),
  "reconcile-bookings": () => reconcileBookings(),
  "review-requests": () => sendReviewRequests(),
  "partner-commissions": () => maturePartnerCommissions(),
  "seo-scheduled-publish": () => publishScheduledSeoPages(),
  "seo-audit": () => runNightlySeoAudit(),
};

async function main() {
  if (!process.env.REDIS_URL) throw new Error("The worker needs REDIS_URL.");
  const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });

  await queue.upsertJobScheduler("expire-holds", { every: 5 * 60 * 1000 }, { name: "expire-holds" });
  await queue.removeJobScheduler("bokun-availability"); // retired Bókun sync, scheduled by older releases
  await queue.upsertJobScheduler("reconcile-bookings", { pattern: "0 2 * * *", tz: TZ }, { name: "reconcile-bookings" });
  await queue.upsertJobScheduler("review-requests", { pattern: "0 10 * * *", tz: TZ }, { name: "review-requests" });
  await queue.upsertJobScheduler("partner-commissions", { pattern: "0 3 * * *", tz: TZ }, { name: "partner-commissions" });
  await queue.upsertJobScheduler("seo-scheduled-publish", { every: 5 * 60 * 1000 }, { name: "seo-scheduled-publish" });
  await queue.upsertJobScheduler("seo-audit", { pattern: "0 4 * * *", tz: TZ }, { name: "seo-audit" });

  const worker = new Worker(
    QUEUE,
    async (job) => {
      const run = JOBS[job.name];
      if (!run) throw new Error(`Unknown job ${job.name}`);
      const result = await run();
      console.log(`[worker] ${job.name} done`, JSON.stringify(result));
      return result;
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} failed: ${err.message}`));
  console.log("[worker] started; jobs scheduled:", Object.keys(JOBS).join(", "));

  const stop = async () => {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    connection.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error) => {
  console.error("[worker] failed to start:", error);
  process.exit(1);
});
