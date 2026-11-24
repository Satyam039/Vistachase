// Admin → Security (owner, 2026-11-15: "kaise pta chalega ki koi person ki IP yeh hai aur usko
// location yeh hai ... kon spammers fir usko easily blocked kar sakun"):
//
// - recordSubmission(): one SecurityEvent row per public form (enquiry, signup, partner
//   application, chat start), with the sender's IP, whether it went through or was caught as spam,
//   and the city/country looked up from the IP afterwards (never slows the form down).
// - Blocklist: admins block an IP or an email; blockedSenderGuard refuses that sender's public
//   writes (forms, signups, chat, bookings). Staff sign-in and /api/admin are never blocked.
//
// Security notes:
// - The IP comes from clientIp(), which only believes X-Forwarded-For when the request arrived
//   from a local proxy (nginx / the Next.js server), and then takes the right-most public address:
//   the one our own proxy added. Anything a visitor writes into the header sits to the left of it,
//   so a spammer can't pretend to be someone else's IP (or dodge a block) by sending the header.
// - Stored text is trimmed and capped; nothing from these rows is ever run or rendered as HTML.
// - Location lookups use Cloudflare's headers when the site is behind Cloudflare, else
//   ipinfo.io when IPINFO_TOKEN is set, else ipwho.is. Results are cached for a day per IP.

import net from "node:net";
import type { NextFunction, Request, Response } from "express";
import prisma from "@/lib/db/prisma";

export type FormKind = "ENQUIRY" | "SIGNUP" | "PARTNER_APPLY" | "BANFF_ELITE" | "CHAT" | "LIVE_CHAT" | "CHAT_HANDOFF" | "BLOCKED_REQUEST";
export type Outcome = "ACCEPTED" | "SPAM" | "REFUSED" | "BLOCKED";

const RETENTION_DAYS = 180;

// ---------------------------------------------------------------------------------------------
// Client IP

const stripV4Mapped = (ip: string) => (ip.startsWith("::ffff:") && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip);

/** Loopback, private, link-local, CGNAT and unique-local addresses: never a visitor's own. */
export function isPrivateAddress(raw: string): boolean {
  const ip = stripV4Mapped(raw.trim());
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
  }
  return true; // not an address at all
}

/** The visitor's IP address (see the security note at the top). */
export function clientIp(req: Request): string {
  const socket = stripV4Mapped(req.socket?.remoteAddress ?? "");
  const header = req.headers["x-forwarded-for"];
  if (socket && isPrivateAddress(socket) && typeof header === "string") {
    const hops = header.split(",").map((h) => stripV4Mapped(h.trim())).filter((h) => net.isIP(h));
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isPrivateAddress(hops[i])) return hops[i];
    }
    if (hops.length) return hops[hops.length - 1];
  }
  return socket || stripV4Mapped(req.ip ?? "") || "unknown";
}

// ---------------------------------------------------------------------------------------------
// Location

export interface IpLocation {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
}

const locationCache = new Map<string, { at: number; loc: IpLocation | null }>();
const DAY_MS = 24 * 60 * 60_000;
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);

function cloudflareLocation(req: Request): IpLocation | null {
  const code = req.headers["cf-ipcountry"];
  if (typeof code !== "string" || !/^[A-Z]{2}$/.test(code) || code === "XX") return null;
  const decode = (v: unknown) => {
    if (typeof v !== "string") return undefined;
    try {
      return clip(decodeURIComponent(v), 80);
    } catch {
      return clip(v, 80);
    }
  };
  return { countryCode: code, country: code, city: decode(req.headers["cf-ipcity"]), region: decode(req.headers["cf-region"]) };
}

async function lookupLocation(ip: string): Promise<IpLocation | null> {
  if (process.env.NODE_ENV === "test" || isPrivateAddress(ip) || !net.isIP(ip)) return null;
  const cached = locationCache.get(ip);
  if (cached && Date.now() - cached.at < DAY_MS) return cached.loc;
  let loc: IpLocation | null = null;
  try {
    const token = process.env.IPINFO_TOKEN;
    const url = token
      ? `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`
      : `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000), headers: { Accept: "application/json" } });
    if (res.ok) {
      const d = (await res.json()) as Record<string, unknown>;
      if (token) {
        loc = { countryCode: clip(d.country, 2), country: clip(d.country, 80), region: clip(d.region, 80), city: clip(d.city, 80) };
      } else if (d.success !== false) {
        loc = { countryCode: clip(d.country_code, 2), country: clip(d.country, 80), region: clip(d.region, 80), city: clip(d.city, 80) };
      }
    }
  } catch {
    // lookup failed or timed out: the row keeps its IP without a place
  }
  locationCache.set(ip, { at: Date.now(), loc });
  if (locationCache.size > 10_000) locationCache.delete(locationCache.keys().next().value as string);
  return loc;
}

// ---------------------------------------------------------------------------------------------
// Recording

let lastPrune = 0;
async function pruneOldEvents() {
  if (Date.now() - lastPrune < 6 * 60 * 60_000) return;
  lastPrune = Date.now();
  await prisma.securityEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * DAY_MS) } } });
}

export interface SubmissionInput {
  form: FormKind;
  outcome: Outcome;
  reason?: string;
  email?: unknown;
  name?: unknown;
}

/**
 * Records who sent a public form. Never throws and never delays the response: the row is written
 * and its location filled in the background.
 */
export function recordSubmission(req: Request, input: SubmissionInput): Promise<void> {
  const ip = clientIp(req);
  const cf = cloudflareLocation(req);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 200) || null : null;
  const task = (async () => {
    const row = await prisma.securityEvent.create({
      data: {
        form: input.form,
        outcome: input.outcome,
        reason: input.reason?.slice(0, 200) ?? null,
        ip: ip.slice(0, 64),
        email,
        name: clip(input.name, 120) ?? null,
        userAgent: clip(req.headers["user-agent"], 300) ?? null,
        path: clip(req.originalUrl?.split("?")[0], 200) ?? null,
        ...(cf ?? {}),
      },
    });
    if (!cf) {
      const loc = await lookupLocation(ip);
      if (loc) await prisma.securityEvent.update({ where: { id: row.id }, data: loc });
    }
    await pruneOldEvents();
  })().catch((e) => console.warn("[security] couldn't record submission:", (e as Error).message));
  return task;
}

/** Records at most one CHAT row per IP per 30 minutes (a chat is many messages). */
const chatSeen = new Map<string, number>();
export function recordChatStart(req: Request, form: FormKind = "CHAT") {
  const key = `${form}:${clientIp(req)}`;
  const now = Date.now();
  if (now - (chatSeen.get(key) ?? 0) < 30 * 60_000) return;
  chatSeen.set(key, now);
  if (chatSeen.size > 10_000) chatSeen.delete(chatSeen.keys().next().value as string);
  void recordSubmission(req, { form, outcome: "ACCEPTED" });
}

// ---------------------------------------------------------------------------------------------
// Blocklist

export type BlockKind = "IP" | "EMAIL";
let blockCache: { at: number; ips: Set<string>; emails: Set<string> } | null = null;
const BLOCK_TTL_MS = 30_000;

/** Call after any change to BlockedSender so this process sees it at once. */
export function forgetBlocklist() {
  blockCache = null;
}

async function blocklist() {
  if (blockCache && Date.now() - blockCache.at < BLOCK_TTL_MS) return blockCache;
  const rows = await prisma.blockedSender.findMany({ select: { kind: true, value: true } });
  blockCache = {
    at: Date.now(),
    ips: new Set(rows.filter((r) => r.kind === "IP").map((r) => r.value)),
    emails: new Set(rows.filter((r) => r.kind === "EMAIL").map((r) => r.value)),
  };
  return blockCache;
}

/** Why this sender is blocked ("ip" / "email"), or null. Fails open if the database is down. */
export async function blockedBecause(ip: string, email: unknown): Promise<"ip" | "email" | null> {
  try {
    const list = await blocklist();
    if (list.ips.has(ip)) return "ip";
    if (typeof email === "string" && list.emails.has(email.trim().toLowerCase())) return "email";
  } catch (e) {
    console.warn("[security] blocklist unavailable:", (e as Error).message);
  }
  return null;
}

// Paths under /api a blocked sender may still use: staff sign-in and the staff areas, so an admin
// can never block themself out, and Stripe's webhooks.
const NEVER_BLOCKED = [/^\/admin(\/|$)/, /^\/auth\/(login|logout|me)$/, /^\/seo(\/|$)/, /^\/operations(\/|$)/, /^\/webhooks(\/|$)/, /^\/health(\/|$)/];

/** Mounted on /api: refuses a blocked IP's or email's public writes (POST/PUT/PATCH/DELETE). */
export async function blockedSenderGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || NEVER_BLOCKED.some((re) => re.test(req.path))) return next();
  const ip = clientIp(req);
  const email = (req.body as Record<string, unknown> | undefined)?.email ?? (req.body as Record<string, unknown> | undefined)?.customerEmail;
  const why = await blockedBecause(ip, email);
  if (!why) return next();
  console.warn(`[security] blocked ${why} ${why === "ip" ? ip : "(email)"} on ${req.method} ${req.path}`);
  recordBlockedOnce(req, why, email);
  return res.status(403).json({ success: false, error: "We couldn't accept this request. If you think this is a mistake, email support@vistachase.com." });
}

/** One BLOCKED row per sender per 10 minutes, so a bot hammering the site can't flood the table. */
const blockedSeen = new Map<string, number>();
function recordBlockedOnce(req: Request, why: string, email: unknown) {
  const key = `${clientIp(req)}:${typeof email === "string" ? email.toLowerCase() : ""}`;
  const now = Date.now();
  if (now - (blockedSeen.get(key) ?? 0) < 10 * 60_000) return;
  blockedSeen.set(key, now);
  if (blockedSeen.size > 10_000) blockedSeen.delete(blockedSeen.keys().next().value as string);
  void recordSubmission(req, { form: "BLOCKED_REQUEST", outcome: "BLOCKED", reason: `blocked ${why}`, email });
}
