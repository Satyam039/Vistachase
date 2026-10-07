import { execSync } from "node:child_process";
import path from "node:path";

// Tests write bookings, holds, reviews and departures, so they run against their own SQLite
// file (prisma/test.db), created and seeded fresh for every run. The dev database the site
// reads (prisma/dev.db) is never touched.
export default function setup() {
  const cwd = path.resolve(__dirname, "..");
  const env = { ...process.env, DATABASE_URL: "file:./test.db" };
  execSync("npx prisma db push --skip-generate --force-reset --accept-data-loss", { cwd, env, stdio: "ignore" });
  execSync("node prisma/seed.js", { cwd, env, stdio: "ignore" });
}
