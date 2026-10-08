import { execSync } from "node:child_process";
import path from "node:path";
import { testDatabaseUrl } from "./test-database-url";

// Resets and seeds the test database once per run. Fails the run with the real error if the
// database can't be prepared, instead of letting every test fail on its own.
export default function setup() {
  const cwd = path.resolve(__dirname, "..");
  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url };

  console.log(`Setting up test database ${new URL(url).host}${new URL(url).pathname}…`);
  // Same migrations production applies (prisma migrate deploy), so a missing migration fails here.
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { cwd, env, stdio: "inherit" });
  execSync("node prisma/seed.js", { cwd, env, stdio: "inherit" });
}
