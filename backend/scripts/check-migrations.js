// CI guard (ci.yml): migrations must be additive. Fails when a migration.sql drops, renames,
// truncates or deletes, or changes a column's type, unless that file says why on a line
//   -- migration-safety: allow <reason>
// Production applies migrations automatically on API start (scripts/start-production.js), after the
// deploy backs the database up (scripts/backup-before-migrate.js); this keeps a destructive change
// from getting there unreviewed. Applied migrations must never be edited (Prisma checksums them).
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "prisma", "migrations");
const RULES = [
  [/\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|FUNCTION)\b/i, "drops"],
  [/\bALTER\s+TABLE\b[^;]*\bDROP\b(?!\s+(CONSTRAINT|DEFAULT|NOT\s+NULL))/i, "drops a column"],
  [/\bRENAME\b/i, "renames"],
  [/\bTRUNCATE\b/i, "truncates"],
  [/\bDELETE\s+FROM\b/i, "deletes rows"],
  [/\bALTER\s+COLUMN\b[^;]*\b(SET\s+DATA\s+)?TYPE\b/i, "changes a column type"],
  [/\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i, "makes a column required (fails on existing NULLs)"],
];

const problems = [];
for (const name of fs.readdirSync(dir).sort()) {
  const file = path.join(dir, name, "migration.sql");
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  if (/^--\s*migration-safety:\s*allow\s+\S/im.test(raw)) continue;
  // Statements without comments, so a comment that mentions DROP doesn't trip the check.
  const sql = raw.replace(/--[^\n]*/g, "");
  for (const statement of sql.split(";")) {
    for (const [pattern, what] of RULES) {
      if (pattern.test(statement)) problems.push(`${name}: ${what}: ${statement.trim().split("\n")[0].slice(0, 120)}`);
    }
  }
}

if (problems.length) {
  console.error("Destructive migration statements found:\n  " + problems.join("\n  "));
  console.error('\nMake the change additive, or add "-- migration-safety: allow <reason>" to the migration after review and a backup plan.');
  process.exit(1);
}
console.log("Migrations are additive.");
