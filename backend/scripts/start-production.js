// Production start: apply pending migrations (safe to run on every start; Prisma takes a lock),
// then start the API. The Prisma client is generated at build time. The catalog is loaded once
// with `npm run prisma:seed` on an empty database; demo data never runs in production.
const { execSync } = require("child_process");
const path = require("path");

try {
  execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: path.join(__dirname, "..") });
} catch (err) {
  console.error("[start] Database migrations failed:", err.message);
  process.exit(1);
}
require("../dist/server.js");
