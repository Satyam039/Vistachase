// Enquiry-form spam protection (owner, 2026-11-11: "fake mails ne spam kar rakha hai"). Fake
// enquiries reached the inbox with a random mixed-case name ("cHXwtVPyDCAWVGSEFGhh"), a trip date
// in 1970, 49 guests and a message that was only a phone number. Layers, cheapest first:
//
// 1. Field rules every real guest meets anyway (routes/enquiries.routes.ts answers 400 with the
//    field): trip dates from today (Mountain Time) up to 3 years ahead, 1 to 28 guests.
// 2. Bot signals, dropped quietly (the bot is told it worked, nothing is saved or emailed, the API
//    log says why): the hidden honeypot field, a random-string name, a message with no words,
//    a form token that is missing, forged, too old, or sent within 3 seconds of the form loading.
// 3. Per-IP rate limit (5 per 10 minutes) and per-email limit (3 per day).
// 4. Optional Cloudflare Turnstile: set TURNSTILE_SECRET_KEY on the API and
//    NEXT_PUBLIC_TURNSTILE_SITE_KEY on the frontend and every enquiry must pass it.

import crypto from "node:crypto";

/** Largest group the contact form takes (owner, 2026-11-11). */
export const MAX_ENQUIRY_GUESTS = 28;
/** How far ahead a trip date may be. */
export const MAX_ENQUIRY_YEARS_AHEAD = 3;
/** A person needs at least this long to fill the form after it loads. */
export const MIN_FILL_MS = 3_000;
/** A form token older than this is stale (the page was left open for a day). */
export const MAX_FORM_AGE_MS = 24 * 60 * 60_000;

/**
 * Form-spam bots fill the name field with a random mixed-case string ("SpvViyvvcPmWsQsxlpooZFKu",
 * "cHXwtVPyDCAWVGSEFGhh"). A real name is never one long word that switches from lower to upper
 * case four or more times, or that is mostly capitals scattered through the word.
 */
export function looksLikeBotName(name: string): boolean {
  const trimmed = name.trim();
  if (/\s/.test(trimmed) || trimmed.length < 10 || !/^[A-Za-z]+$/.test(trimmed)) return false;
  if (trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) return false;
  const switches = trimmed.match(/[a-z][A-Z]/g)?.length ?? 0;
  if (switches >= 4) return true;
  // Capitals after the first letter: "MacKenzieMcLeod" has 3, the bot names 8 and more.
  const innerCapitals = trimmed.slice(1).match(/[A-Z]/g)?.length ?? 0;
  if (innerCapitals >= 5 && innerCapitals / trimmed.length >= 0.3) return true;
  // A name starting with a small letter and then a capital ("cHXw…") is not how anyone types a name.
  return /^[a-z][A-Z]{2}/.test(trimmed);
}

/** A message with no words at all ("8054958299", "!!!!") or one random mixed-case string. */
export function looksLikeBotMessage(message: string): boolean {
  const trimmed = message.trim();
  const letters = trimmed.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 2) return true;
  return looksLikeBotName(trimmed);
}

/** Today's date in Mountain Time plus `years`, YYYY-MM-DD. */
function addYears(day: string, years: number) {
  return `${Number(day.slice(0, 4)) + years}${day.slice(4)}`;
}

/** Field errors for the trip dates, or null. `today` is YYYY-MM-DD in Mountain Time. */
export function enquiryDateErrors(date: string | undefined, toDate: string | undefined, today: string): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  const latest = addYears(today, MAX_ENQUIRY_YEARS_AHEAD);
  for (const [field, value] of [["date", date], ["toDate", toDate]] as const) {
    if (!value) continue;
    if (value < today) errors[field] = ["Choose today or a later date."];
    else if (value > latest) errors[field] = [`Choose a date within the next ${MAX_ENQUIRY_YEARS_AHEAD} years.`];
  }
  if (!errors.toDate && date && toDate && toDate < date) errors.toDate = ["To Date must be on or after From Date."];
  return Object.keys(errors).length > 0 ? errors : null;
}

function formSecret(): string {
  return process.env.ENQUIRY_FORM_SECRET || process.env.VOUCHER_SECRET || process.env.JWT_SECRET || "vista-chase-enquiry-form";
}

const sign = (issuedAt: string) => crypto.createHmac("sha256", formSecret()).update(`enquiry-form:${issuedAt}`).digest("base64url").slice(0, 32);

/** A token the form fetches when it loads: when it was issued, signed. */
export function issueFormToken(now = Date.now()): string {
  const issuedAt = String(now);
  return `${issuedAt}.${sign(issuedAt)}`;
}

/** Why a form token is refused, or null when it's fine. */
export function formTokenProblem(token: unknown, now = Date.now()): string | null {
  if (typeof token !== "string" || token.length > 64) return "missing form token";
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !/^\d{10,16}$/.test(issuedAt) || !signature) return "malformed form token";
  const expected = sign(issuedAt);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return "forged form token";
  const age = now - Number(issuedAt);
  if (age < MIN_FILL_MS) return "form sent too fast";
  if (age > MAX_FORM_AGE_MS) return "stale form token";
  return null;
}

/** Same email address: at most 3 enquiries a day (in memory, per API process). */
const byEmail = new Map<string, number[]>();
export function tooManyFromEmail(email: string, now = Date.now()): boolean {
  const key = email.trim().toLowerCase();
  const recent = (byEmail.get(key) ?? []).filter((t) => now - t < 24 * 60 * 60_000);
  if (recent.length >= 3) {
    byEmail.set(key, recent);
    return true;
  }
  recent.push(now);
  byEmail.set(key, recent);
  if (byEmail.size > 5_000) byEmail.delete(byEmail.keys().next().value as string);
  return false;
}

export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/** Cloudflare Turnstile check; passes when Turnstile isn't configured. */
export async function verifyTurnstile(token: unknown, ip: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (error) {
    // Cloudflare unreachable: let the enquiry through rather than lose a real guest.
    console.warn("[enquiry] Turnstile check failed:", (error as Error).message);
    return true;
  }
}
