// Nightly database backup, run by cron on the server (docs/BACKUPS.md):
//
//   15 3 * * * cd /home/ubuntu/Vistachase/backend && node scripts/nightly-backup.js >> /home/ubuntu/backups/backup.log 2>&1
//
// pg_dump (custom format) of DATABASE_URL to $BACKUP_DIR/daily-<time>.dump, checked with
// pg_restore --list so a broken file is caught the same night, then the oldest are removed so
// $DAILY_BACKUPS_KEEP (default 14) stay. With BACKUP_S3_BUCKET set (and the aws CLI with access
// to it) each file is also copied to s3://$BACKUP_S3_BUCKET/vistachase-db/, so a lost server
// doesn't take the backups with it. Exits 1 on any failure, so cron mail / the log shows it.
//
// BACKUP_DIR defaults to ~/backups (shared with the deploy's pre-migrate backups, which have their
// own names and are left alone). Restore: pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/** DATABASE_URL without Prisma-only query parameters (schema=, connection_limit=…), which libpq rejects. */
function pgUrl() {
  const url = new URL(process.env.DATABASE_URL);
  for (const key of [...url.searchParams.keys()]) if (!["sslmode", "sslrootcert", "sslcert", "sslkey", "application_name"].includes(key)) url.searchParams.delete(key);
  return url.toString();
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (result.error) throw new Error(`${cmd}: ${result.error.code === "ENOENT" ? "not installed" : result.error.message}`);
  if (result.status !== 0) throw new Error(`${cmd} failed (exit ${result.status}): ${(result.stderr || "").trim().split("\n").slice(-3).join(" ")}`);
  return result.stdout;
}

function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (backend/.env)");
  const dir = process.env.BACKUP_DIR || path.join(os.homedir(), "backups");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `daily-${stamp}.dump`);

  try {
    run("pg_dump", ["--format=custom", "--no-owner", "--file", file, pgUrl()]);
    const tables = run("pg_restore", ["--list", file]).split("\n").filter((l) => / TABLE DATA /.test(l)).length;
    if (tables === 0) throw new Error("the dump has no table data");
    fs.chmodSync(file, 0o600);
    console.log(`[backup] ${new Date().toISOString()} saved ${file} (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB, ${tables} tables)`);
  } catch (e) {
    try {
      fs.unlinkSync(file);
    } catch {}
    throw e;
  }

  const bucket = (process.env.BACKUP_S3_BUCKET || "").trim();
  if (bucket) {
    run("aws", ["s3", "cp", file, `s3://${bucket}/vistachase-db/${path.basename(file)}`, "--only-show-errors"]);
    console.log(`[backup] copied to s3://${bucket}/vistachase-db/`);
  } else {
    console.warn("[backup] BACKUP_S3_BUCKET is not set: the backup is only on this server.");
  }

  const keep = Math.max(1, Number(process.env.DAILY_BACKUPS_KEEP) || 14);
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^daily-.*\.dump$/.test(f))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) fs.unlinkSync(path.join(dir, f));
  if (old.length) console.log(`[backup] removed ${old.length} old backup(s); keeping the newest ${keep}`);
}

try {
  main();
} catch (e) {
  console.error(`[backup] ${new Date().toISOString()} FAILED: ${e.message}`);
  process.exit(1);
}
