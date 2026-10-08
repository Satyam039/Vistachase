import { Queue, Worker, QueueEvents, Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { runNightlyReconciliation } from "../../../scripts/nightly-reconciliation";
import { sendPostTripReviewRequests } from "../../../scripts/send-review-requests";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

export const vistaQueue = new Queue("vista-chase-jobs", { connection });

export const vistaQueueEvents = new QueueEvents("vista-chase-jobs", { connection });

const worker = new Worker("vista-chase-jobs", async (job: Job) => {
  console.log(`[JobRunner] Processing ${job.name} (ID: ${job.id})`);
  
  switch (job.name) {
    case "expire-holds":
      await expireHolds();
      break;
    case "bokun-reconciliation":
      await runNightlyReconciliation();
      break;
    case "post-trip-reviews":
      await sendPostTripReviewRequests();
      break;
    default:
      console.warn(`[JobRunner] Unknown job name: ${job.name}`);
  }
}, { connection });

worker.on("completed", (job) => {
  console.log(`[JobRunner] Job ${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`[JobRunner] Job ${job?.id} has failed with ${err.message}`);
});

// Implementation of expiring holds
async function expireHolds() {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  const expired = await prisma.booking.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: fifteenMinsAgo }
    },
    data: { status: "CANCELLED" }
  });
  console.log(`[JobRunner] Expired ${expired.count} held bookings.`);
}

// Function to register recurring jobs
export async function setupRecurringJobs() {
  await vistaQueue.upsertJobScheduler("expire-holds-scheduler", { pattern: "*/5 * * * *" }, { name: "expire-holds" });
  await vistaQueue.upsertJobScheduler("bokun-reconciliation-scheduler", { pattern: "0 2 * * *" }, { name: "bokun-reconciliation" });
  await vistaQueue.upsertJobScheduler("post-trip-reviews-scheduler", { pattern: "0 10 * * *" }, { name: "post-trip-reviews" });

  console.log("[JobRunner] Recurring jobs scheduled successfully.");
}

export async function closeJobs() {
  await worker.close();
  await vistaQueueEvents.close();
  await vistaQueue.close();
  await prisma.$disconnect();
  connection.disconnect();
}
