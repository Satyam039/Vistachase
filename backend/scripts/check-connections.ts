// Checks every outside connection the live site needs, from the server, and says in plain words
// which work. Never prints a key or password. Run it after changing backend/.env:
//
//   cd /home/ubuntu/Vistachase/backend && npx tsx scripts/check-connections.ts
//
// Database, Redis, Stripe (key mode, webhook secret and that Stripe accepts the key), email
// (SMTP / Resend sign-in), Bókun (keys, live or test account, products found), the site URLs, and
// the latest database backup. Exits 1 when something the live site needs is broken.

import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import prisma from "../src/lib/db/prisma";
import { configWarnings } from "../src/lib/config/startup-checks";
import { bokunConfigured, bokunIsTestAccount } from "../src/modules/bokun/config";
import { checkBokunProducts } from "../src/modules/bokun/bokun-products";

type Level = "ok" | "warn" | "fail";
const results: { name: string; level: Level; note: string }[] = [];
const add = (name: string, level: Level, note: string) => results.push({ name, level, note });
const short = (e: unknown) => {
  const lines = (e instanceof Error ? e.message : String(e)).split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /can't|cannot|refused|denied|invalid|failed|error|timeout/i.test(l) && !/invocation/.test(l)) ?? lines[0] ?? "unknown error").slice(0, 160);
};

async function database() {
  try {
    const [bookings, tours] = await Promise.all([prisma.booking.count(), prisma.tour.count()]);
    add("Database", "ok", `connected (${tours} tours, ${bookings} bookings)`);
  } catch (e) {
    add("Database", "fail", short(e));
  }
}

async function redis() {
  if (!process.env.REDIS_URL) return add("Redis", "warn", "REDIS_URL not set: rate limits and cache use memory (fine on one server)");
  const { default: Redis } = await import("ioredis");
  const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 4000, retryStrategy: () => null });
  client.on("error", () => undefined); // reported below
  try {
    await client.connect();
    add("Redis", (await client.ping()) === "PONG" ? "ok" : "warn", "connected");
  } catch (e) {
    add("Redis", "fail", short(e));
  } finally {
    client.disconnect();
  }
}

async function stripe() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return add("Stripe", "fail", "STRIPE_SECRET_KEY not set: card payments are off");
  const mode = key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "TEST" : "unknown";
  try {
    const { default: Stripe } = await import("stripe");
    await new Stripe(key).balance.retrieve();
    add("Stripe", mode === "LIVE" ? "ok" : "warn", `key accepted, ${mode} mode${mode === "TEST" ? " (no real money; switch to live for launch)" : ""}`);
  } catch (e) {
    add("Stripe", "fail", `Stripe refused the key: ${short(e)}`);
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  add("Stripe webhook secret", secret.startsWith("whsec_") ? "ok" : "fail", secret ? (secret.startsWith("whsec_") ? "set (whsec_…); must be the secret of the endpoint for this site's URL and mode" : "set but doesn't start with whsec_") : "STRIPE_WEBHOOK_SECRET not set: paid bookings won't confirm from Stripe");
  const pk = readFrontendEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  if (pk) {
    const pkMode = pk.startsWith("pk_live_") ? "LIVE" : pk.startsWith("pk_test_") ? "TEST" : "unknown";
    add("Stripe publishable key (frontend)", pkMode === mode ? "ok" : "fail", pkMode === mode ? `${pkMode}, matches the backend` : `${pkMode} but the backend key is ${mode}: payments will fail`);
  }
}

async function email() {
  const provider = (process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "console")).toLowerCase();
  if (provider === "smtp") {
    try {
      const { default: nodemailer } = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT || 465);
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: process.env.SMTP_SECURE === "true" || port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await transport.verify();
      add("Email (SMTP)", "ok", `signed in to ${process.env.SMTP_HOST} as ${process.env.SMTP_USER}`);
    } catch (e) {
      add("Email (SMTP)", "fail", `couldn't sign in: ${short(e)}`);
    }
  } else if (provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
      add("Email (Resend)", res.ok ? "ok" : "fail", res.ok ? "API key accepted" : `Resend answered ${res.status}`);
    } catch (e) {
      add("Email (Resend)", "fail", short(e));
    }
  } else {
    add("Email", "fail", `EMAIL_PROVIDER=${provider}: emails only go to the log`);
  }
}

async function bokun() {
  if (!bokunConfigured()) return add("Bókun", "warn", "keys not set: bookings are not sent to Bókun");
  try {
    const check = await checkBokunProducts();
    const missing = check?.products.filter((p) => !p.found) ?? [];
    const account = bokunIsTestAccount() ? "TEST account (api.bokuntest.com)" : "LIVE account";
    add(
      "Bókun",
      bokunIsTestAccount() ? "warn" : missing.length ? "warn" : "ok",
      `keys accepted, ${account}, ${check?.activities.length ?? 0} products; ${missing.length ? `${missing.length} website product(s) not found: ${missing.map((p) => p.slug).join(", ")}` : "every website product found"}${process.env.BOKUN_PRODUCT_OVERRIDES ? "; BOKUN_PRODUCT_OVERRIDES is set (remove it with live keys)" : ""}`,
    );
  } catch (e) {
    add("Bókun", "fail", `Bókun refused: ${short(e)}`);
  }
}

function urls() {
  const front = process.env.FRONTEND_URL || "";
  const level: Level = !front ? "warn" : /localhost|\d+\.\d+\.\d+\.\d+/.test(front) ? "fail" : front.startsWith("https://") ? "ok" : "warn";
  add("Site URL (FRONTEND_URL)", level, front || "not set (emails link to https://www.vistachase.com)");
  add("Google indexing", process.env.SEO_BLOCK_INDEXING === "true" ? "warn" : "ok", process.env.SEO_BLOCK_INDEXING === "true" ? "blocked (SEO_BLOCK_INDEXING=true): right for new.vistachase.com, remove on www" : "allowed");
}

function backups() {
  const dir = process.env.BACKUP_DIR || path.join(os.homedir(), "backups");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^daily-.*\.dump$/.test(f)).sort() : [];
  const last = files[files.length - 1];
  if (!last) return add("Nightly backup", "fail", `no daily-*.dump in ${dir}: set up the cron (docs/BACKUPS.md)`);
  const age = (Date.now() - fs.statSync(path.join(dir, last)).mtimeMs) / 3_600_000;
  add("Nightly backup", age < 26 ? "ok" : "fail", `latest ${last}, ${age.toFixed(0)} h old, ${files.length} kept${process.env.BACKUP_S3_BUCKET ? `, copied to s3://${process.env.BACKUP_S3_BUCKET}` : ", only on this server"}`);
}

function readFrontendEnv(name: string): string | null {
  for (const file of ["../frontend/.env.production.local", "../frontend/.env.production", "../frontend/.env.local", "../frontend/.env"]) {
    try {
      const line = fs.readFileSync(path.join(__dirname, file), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
      if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
    } catch {
      // not there
    }
  }
  return null;
}

async function main() {
  await database();
  await redis();
  await stripe();
  await email();
  await bokun();
  urls();
  backups();
  for (const w of configWarnings()) if (!/Stripe|STRIPE|Email|FRONTEND_URL/.test(w)) add("Setting", /^(JWT_SECRET|FEATURE_MOCK_PAYMENT|NODE_ENV)/.test(w) ? "fail" : "warn", w);

  const icon = { ok: "OK  ", warn: "WARN", fail: "FAIL" };
  console.log("\nVista Chase connections\n");
  for (const r of results) console.log(`${icon[r.level]}  ${r.name}: ${r.note}`);
  const failed = results.filter((r) => r.level === "fail").length;
  console.log(`\n${failed ? `${failed} problem(s) to fix before real customers.` : "Nothing broken."} WARN lines are fine on the test site.\n`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

void main();
