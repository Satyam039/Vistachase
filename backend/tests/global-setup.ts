import { execSync } from "node:child_process";
import path from "node:path";

export default function setup() {
  const cwd = path.resolve(__dirname, "..");
  // Use CI postgres URL or default local postgres URL for tests
  const testDbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/vistachase_test?schema=public";
  const env = { ...process.env, DATABASE_URL: testDbUrl };
  
  console.log(`Setting up test database at ${testDbUrl}...`);
  try {
    execSync("npx prisma db push --skip-generate --force-reset --accept-data-loss", { cwd, env, stdio: "ignore" });
    execSync("node prisma/seed.js", { cwd, env, stdio: "ignore" });
  } catch (e) {
    console.warn("⚠️ Warning: Could not setup test database. If running locally without Postgres, tests that rely on DB will fail. In CI, this should succeed.");
  }
}
