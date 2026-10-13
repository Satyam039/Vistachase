// Deploy step (deploy-aws.yml), run before the API restarts: when a database migration is waiting
// to be applied, back the database up first. The API applies pending migrations when it starts
// (scripts/start-production.js), so this is the last moment the old schema can be saved.
//
//   No pending migration  → nothing to do.
//   Pending migration     → pg_dump (custom format) to $BACKUP_DIR/pre-migrate-<time>-<names>.dump,
//                           keeping the newest $MIGRATION_BACKUPS_KEEP (default 10) of these files.
//   Backup fails          → exit 1: the deploy stops before restarting anything, so the live
//                           site keeps running the previous release on the old schema.
//                           MIGRATE_WITHOUT_BACKUP=true (backend/.env) skips the backup on purpose.
//
// BACKUP_DIR defaults to ~/backups. pg_dump comes from the postgresql-client package and must be
// the database server's major version or newer. Restore: pg_restore --clean --if-exists -d "$DATABASE_URL" <file>.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const backend = path.join(__dirname, "..");

async function pendingMigrations() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    const applied = new Set(rows.map((r) => r.migration_name));
    return fs
      .readdirSync(path.join(backend, "prisma", "migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(backend, "prisma", "migrations", d.name, "migration.sql")))
      .map((d) => d.name)
      .filter((name) => !applied.has(name))
      .sort();
  } finally {
    await prisma.$disconnect();
  }
}

/** DATABASE_URL without Prisma-only query parameters (schema=, connection_limit=…), which libpq rejects. */
function pgUrl() {
  const url = new URL(process.env.DATABASE_URL);
  for (const key of [...url.searchParams.keys()]) if (!["sslmode", "sslrootcert", "sslcert", "sslkey", "application_name"].includes(key)) url.searchParams.delete(key);
  return url.toString();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (backend/.env)");
  let pending;
  try {
    pending = await pendingMigrations();
  } catch (e) {
    throw new Error(`couldn't read the applied migrations: ${e.message.trim().split("\n").pop()}`);
  }
  if (pending.length === 0) {
    console.log("[backup] No pending database migrations; no backup needed.");
    return;
  }
  console.log(`[backup] Pending migrations: ${pending.join(", ")}`);
  if (process.env.MIGRATE_WITHOUT_BACKUP === "true") {
    console.warn("[backup] MIGRATE_WITHOUT_BACKUP=true: skipping the backup on purpose.");
    return;
  }

  const dir = process.env.BACKUP_DIR || path.join(os.homedir(), "backups");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `pre-migrate-${stamp}-${pending.join("+").replace(/[^A-Za-z0-9_+-]/g, "").slice(0, 80)}.dump`);
  const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--file", file, pgUrl()], { stdio: ["ignore", "inherit", "inherit"] });
  if (result.error || result.status !== 0) {
    try {
      fs.unlinkSync(file);
    } catch {}
    throw new Error(`pg_dump failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`);
  }
  fs.chmodSync(file, 0o600);
  console.log(`[backup] Saved ${file} (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB).`);

  const keep = Math.max(1, Number(process.env.MIGRATION_BACKUPS_KEEP) || 10);
  const old = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("pre-migrate-") && f.endsWith(".dump"))
    .sort()
    .slice(0, -keep);
  for (const f of old) fs.unlinkSync(path.join(dir, f));
  if (old.length) console.log(`[backup] Removed ${old.length} older pre-migrate backup(s); kept the newest ${keep}.`);
}

main().catch((e) => {
  console.error(`[backup] ERROR: ${e.message}`);
  console.error("[backup] Not restarting: the live site keeps the previous release. Fix the backup (sudo apt install postgresql-client),");
  console.error("[backup] or set MIGRATE_WITHOUT_BACKUP=true in backend/.env to deploy without one, then re-run the deploy.");
  process.exit(1);
});
