import "dotenv/config";
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}

import { createApp } from "./app";
import { startInProcessJobs } from "./jobs/in-process";

// Task F4: Validate configuration at boot
const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  // 'BOKUN_API_URL', 'BOKUN_ACCESS_KEY', 'BOKUN_SECRET_KEY' // Can be checked here if required, though the roadmap says "provider keys"
];

for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`[FATAL] Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  console.error('[FATAL] JWT_SECRET is too short. Must be at least 32 characters for strong security.');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
  console.error('[FATAL] DATABASE_URL must be a PostgreSQL connection string.');
  process.exit(1);
}

const port = parseInt(process.env.PORT || "4000", 10);

createApp().listen(port, () => {
  console.log(`[vistachase-backend] API listening on http://localhost:${port}`);
  if (process.env.RUN_JOBS_IN_API === "true") startInProcessJobs();
});
