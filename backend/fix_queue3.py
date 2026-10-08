import re

# Fix nightly-reconciliation.ts
with open('scripts/nightly-reconciliation.ts', 'r') as f:
    content = f.read()

content = content.replace('include: { payment: true }', 'include: { payments: true }')
content = content.replace('booking.payment && booking.payment.', 'booking.payments[0] && booking.payments[0].')
content = content.replace('booking.payment?.', 'booking.payments[0]?.')
content = content.replace('booking.payment.', 'booking.payments[0].')

with open('scripts/nightly-reconciliation.ts', 'w') as f:
    f.write(content)

# Fix queue.ts
with open('src/lib/jobs/queue.ts', 'r') as f:
    content = f.read()

schedulers_code = """
// Function to register recurring jobs
export async function setupRecurringJobs() {
  await vistaQueue.upsertJobScheduler("expire-holds-scheduler", { pattern: "*/5 * * * *" }, { name: "expire-holds" });
  await vistaQueue.upsertJobScheduler("bokun-reconciliation-scheduler", { pattern: "0 2 * * *" }, { name: "bokun-reconciliation" });
  await vistaQueue.upsertJobScheduler("post-trip-reviews-scheduler", { pattern: "0 10 * * *" }, { name: "post-trip-reviews" });

  console.log("[JobRunner] Recurring jobs scheduled successfully.");
}
"""

content = re.sub(r'// Function to register recurring jobs[\s\S]*?console\.log\("\[JobRunner\] Recurring jobs scheduled successfully\."\);\n\}', schedulers_code.strip(), content)

with open('src/lib/jobs/queue.ts', 'w') as f:
    f.write(content)

