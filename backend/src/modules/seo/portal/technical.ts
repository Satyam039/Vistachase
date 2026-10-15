// Technical SEO checks for the SEO portal: robots.txt, crawler access (search and AI bots),
// sitemap.xml, llms.txt, canonical domain, site verification, the Google tag, real 404s and the
// HTTPS / www redirects. All read-only: they fetch what the site serves and report it. The only
// setting changed from here is the per-crawler rule list, and only with an explicit confirmation.

import prisma from "@/lib/db/prisma";
import { configuredSiteUrl } from "@/modules/seo/paths";
import { auditBaseUrl, readSitemapPaths } from "@/modules/seo/seo.audit";
import { blockedCrawlers } from "@/modules/seo/seo.public";
import { SeoError } from "@/modules/seo/seo.errors";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** The address the handoff fixes for launch (Webflow's global canonical URL). */
export function canonicalOrigin(): string {
  const raw = process.env.SEO_CANONICAL_ORIGIN || "https://www.vistachase.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://www.vistachase.com";
  }
}

/** The Google site verification ID shown in Webflow → Site settings → SEO (screenshot in the handoff). */
export const HANDOFF_VERIFICATION_ID = "isQ3svDyWBUc7wL57wZAC-aZ5_yT-QXBS0eMwJU9jvk";
export const HANDOFF_TRACKING = { ga4Id: "G-KH1432E703", adsId: "AW-16675422535", adsConversionLabel: "nzlDCJ7BJoYcEMeCu48-", conversionValue: 50, currency: "CAD" };

/** Crawlers the handoff names. Search engines must never be blocked; AI bots stay allowed by default. */
export const CRAWLERS = [
  { agent: "Googlebot", kind: "search" as const, note: "Google Search" },
  { agent: "Bingbot", kind: "search" as const, note: "Bing (also feeds several AI assistants)" },
  { agent: "GPTBot", kind: "ai" as const, note: "OpenAI" },
  { agent: "ClaudeBot", kind: "ai" as const, note: "Anthropic" },
  { agent: "PerplexityBot", kind: "ai" as const, note: "Perplexity" },
  { agent: "Google-Extended", kind: "ai" as const, note: "Google Gemini training and grounding (not Google Search)" },
];
const SEARCH_AGENTS = new Set(CRAWLERS.filter((c) => c.kind === "search").map((c) => c.agent));

export type CheckStatus = "pass" | "warn" | "fail" | "info" | "not_checked";
export interface TechCheck {
  id: string;
  group: string;
  label: string;
  status: CheckStatus;
  message: string;
  detail?: unknown;
}

// ---------------------------------------------------------------------------------------------
// robots.txt

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") sitemaps.push(value);
    else if ((key === "allow" || key === "disallow") && current) current.rules.push({ allow: key === "allow", path: value });
  }
  return { groups, sitemaps };
}

/** Whether `agent` may fetch `path` (most specific group, longest matching rule; ties go to Allow). */
export function robotsAllows(parsed: ReturnType<typeof parseRobots>, agent: string, path = "/"): boolean {
  const name = agent.toLowerCase();
  const group = parsed.groups.find((g) => g.agents.includes(name)) ?? parsed.groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (rule.path === "") continue; // "Disallow:" with no path allows everything
    const prefix = rule.path.replace(/\*.*$/, "").replace(/\$$/, "");
    if (!path.startsWith(prefix)) continue;
    if (!best || prefix.length > best.length || (prefix.length === best.length && rule.allow)) best = { allow: rule.allow, length: prefix.length };
  }
  return best ? best.allow : true;
}

/** robots.txt as the site will serve it with these crawler rules (mirrors frontend/src/app/robots.ts). */
export function robotsPreview(blocked: string[], origin: string, blockAll = false): string {
  if (blockAll) return "User-Agent: *\nDisallow: /\n";
  const lines = ["User-Agent: *", "Allow: /", "Disallow: /admin", "Disallow: /account", "Disallow: /booking", "Disallow: /partners/dashboard", "Disallow: /seo", ""];
  for (const agent of blocked) lines.push(`User-Agent: ${agent}`, "Disallow: /", "");
  lines.push(`Sitemap: ${origin}/sitemap.xml`, "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Running the checks

async function get(fetchImpl: FetchLike, url: string, redirect: "manual" | "follow" = "manual") {
  const started = Date.now();
  try {
    const res = await fetchImpl(url, { redirect, signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "VistaChaseSEOAudit/1.0" } });
    const type = res.headers.get("content-type") ?? "";
    const text = res.status === 200 && /text|xml|html/.test(type) ? (await res.text()).slice(0, 2_000_000) : null;
    if (text === null) await res.body?.cancel().catch(() => undefined);
    return { status: res.status, type, text, location: res.headers.get("location"), ms: Date.now() - started };
  } catch (error) {
    return { status: 0, type: "", text: null, location: null, ms: Date.now() - started, error: (error as Error).message };
  }
}

export async function runTechnicalChecks(opts: { fetchImpl?: FetchLike; baseUrl?: string; checkDomain?: boolean } = {}) {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const base = (opts.baseUrl ?? auditBaseUrl()).replace(/\/+$/, "");
  const canonical = canonicalOrigin();
  const site = configuredSiteUrl();
  const siteIsCanonical = site?.origin === canonical;
  const settings = await prisma.seoSiteSettings.findUnique({ where: { id: "site" } });
  const checks: TechCheck[] = [];
  const add = (c: TechCheck) => checks.push(c);

  // robots.txt
  const robots = await get(fetchImpl, `${base}/robots.txt`);
  let blockAll = false;
  if (robots.status !== 200 || robots.text === null) {
    add({ id: "robots.reachable", group: "robots.txt", label: "robots.txt is served", status: "fail", message: robots.status ? `/robots.txt answered ${robots.status}.` : `/robots.txt couldn't be loaded (${robots.error ?? "no response"}).` });
  } else {
    const parsed = parseRobots(robots.text);
    add({ id: "robots.reachable", group: "robots.txt", label: "robots.txt is served", status: "pass", message: "/robots.txt answers 200.", detail: { text: robots.text.slice(0, 4000) } });
    blockAll = !robotsAllows(parsed, "*", "/");
    if (blockAll) {
      add({
        id: "robots.blockAll",
        group: "robots.txt",
        label: "Indexing not blocked on production",
        status: siteIsCanonical ? "fail" : "warn",
        message: siteIsCanonical
          ? "robots.txt says Disallow: / on the production domain. Search engines will drop the site. Remove SEO_BLOCK_INDEXING from the frontend environment."
          : `robots.txt blocks every crawler (SEO_BLOCK_INDEXING=true). Correct for staging and for the current address (${site?.host ?? "not configured"}); it must be off on ${new URL(canonical).host} at launch.`,
      });
    } else {
      add({
        id: "robots.blockAll",
        group: "robots.txt",
        label: "Staging and preview addresses are not indexable",
        status: siteIsCanonical ? "pass" : "fail",
        message: siteIsCanonical
          ? "robots.txt lets crawlers in on the production domain."
          : `This site is served at ${site?.host ?? "an unconfigured address"}, not ${new URL(canonical).host}, and robots.txt lets crawlers in. Set SEO_BLOCK_INDEXING=true in the frontend environment until launch, so this copy isn't indexed.`,
      });
    }
    const expectedSitemap = `${canonical}/sitemap.xml`;
    const sitemapLine = parsed.sitemaps[0] ?? null;
    add({
      id: "robots.sitemap",
      group: "robots.txt",
      label: "robots.txt lists the sitemap",
      status: blockAll ? "info" : sitemapLine === expectedSitemap ? "pass" : sitemapLine ? "warn" : "fail",
      message: blockAll
        ? "Not listed while every crawler is blocked."
        : sitemapLine === expectedSitemap
          ? `Sitemap: ${expectedSitemap}`
          : sitemapLine
            ? `Lists ${sitemapLine}; at launch it must be ${expectedSitemap} (it follows SITE_URL).`
            : `No Sitemap line. Expected ${expectedSitemap}.`,
    });
    for (const c of CRAWLERS) {
      const allowed = robotsAllows(parsed, c.agent, "/");
      add({
        id: `crawler.${c.agent}`,
        group: "Crawler access",
        label: `${c.agent} (${c.note})`,
        status: allowed ? "pass" : c.kind === "search" && !blockAll ? "fail" : "warn",
        message: allowed ? "Allowed." : blockAll ? "Blocked, because every crawler is blocked on this address." : c.kind === "search" ? "Blocked. Search engines must never be blocked." : "Blocked by a crawler rule. The handoff asks to keep AI crawlers allowed.",
      });
    }
  }

  // sitemap.xml
  const sitemap = await readSitemapPaths(fetchImpl, `${base}/sitemap.xml`);
  if (!sitemap) {
    add({ id: "sitemap.reachable", group: "sitemap.xml", label: "sitemap.xml is served", status: "fail", message: "/sitemap.xml couldn't be read." });
  } else {
    const blogCount = sitemap.paths.filter((p) => p.startsWith("/blog-post/")).length;
    add({ id: "sitemap.reachable", group: "sitemap.xml", label: "sitemap.xml is served", status: sitemap.paths.length ? "pass" : "fail", message: `${sitemap.paths.length} URLs, ${blogCount} blog posts.`, detail: { hosts: sitemap.hosts } });
    const wrongHost = sitemap.hosts.filter((h) => h !== new URL(canonical).host);
    add({
      id: "sitemap.host",
      group: "sitemap.xml",
      label: "Sitemap URLs use the canonical domain",
      status: wrongHost.length === 0 ? "pass" : siteIsCanonical ? "fail" : "warn",
      message: wrongHost.length === 0 ? `Every URL is on ${new URL(canonical).host}.` : `URLs use ${wrongHost.join(", ")}. They follow SITE_URL, so this fixes itself when SITE_URL is ${canonical}.`,
    });
  }

  // llms.txt
  const llms = await get(fetchImpl, `${base}/llms.txt`);
  add({
    id: "llms",
    group: "llms.txt",
    label: "llms.txt is served",
    status: llms.status === 200 ? "pass" : llms.status === 404 ? "warn" : "fail",
    message:
      llms.status === 200
        ? "/llms.txt answers 200."
        : llms.status === 404
          ? `Switched off (404). The handoff asks for /llms.txt at launch; ask Nishika for the current Webflow file, then turn it on under Settings.`
          : `/llms.txt answered ${llms.status || llms.error}.`,
  });

  // Home page head
  const home = await get(fetchImpl, `${base}/`);
  if (home.text) {
    const head = home.text.slice(0, 200_000);
    const meta = (name: string) => head.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ?? head.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${name}["']`, "i"))?.[1] ?? null;
    const canonicalHref = head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? head.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ?? null;
    const expectedHome = [canonical, `${canonical}/`];
    add({
      id: "canonical.home",
      group: "Canonical domain",
      label: "Home page canonical is on the canonical domain",
      status: canonicalHref && expectedHome.includes(canonicalHref) ? "pass" : canonicalHref ? (siteIsCanonical ? "fail" : "warn") : "fail",
      message: canonicalHref ? `Canonical: ${canonicalHref}${expectedHome.includes(canonicalHref) ? "" : ` (expected ${canonical}; canonicals follow NEXT_PUBLIC_APP_URL / SITE_URL)`}` : "The home page has no canonical link.",
    });
    const found = meta("google-site-verification");
    const configured = settings?.googleSiteVerification ?? null;
    add({
      id: "verification",
      group: "Search Console",
      label: "Google site verification meta on the home page",
      status: found && found === HANDOFF_VERIFICATION_ID ? "pass" : found ? "warn" : "fail",
      message: found
        ? found === HANDOFF_VERIFICATION_ID
          ? "Present and matches the ID in Webflow."
          : `Present (${found}) but differs from the ID in Webflow (${HANDOFF_VERIFICATION_ID}).`
        : configured
          ? "Saved in settings but not on the page yet (the site reads settings once a minute)."
          : `Missing. Webflow's ID is ${HANDOFF_VERIFICATION_ID}; set it under Analytics & Search Console (admin approval).`,
    });
    const gtags = [...home.text.matchAll(/googletagmanager\.com\/gtag\/js\?id=([A-Z]{1,3}-[A-Z0-9]+)/gi)].map((m) => m[1].toUpperCase());
    const configs = [...home.text.matchAll(/gtag\(\s*['"]config['"]\s*,\s*['"]([A-Z]{1,3}-[A-Z0-9]+)['"]/gi)].map((m) => m[1].toUpperCase());
    const missing = [HANDOFF_TRACKING.adsId, HANDOFF_TRACKING.ga4Id].filter((id) => !configs.includes(id));
    add({
      id: "tracking.gtag",
      group: "Tracking",
      label: "Google tag (GA4 + Google Ads) on every page",
      status: gtags.length > 1 ? "fail" : missing.length === 0 ? "pass" : "fail",
      message:
        gtags.length > 1
          ? `gtag.js loads ${gtags.length} times; it must load once.`
          : missing.length === 0
            ? `One gtag.js loader configures ${configs.join(" and ")}.`
            : gtags.length === 0
              ? "No Google tag on the home page. Turn it on under Analytics & Search Console (admin approval)."
              : `The tag loads but doesn't configure ${missing.join(" and ")}.`,
      detail: { loaders: gtags, configs },
    });
    add({ id: "mobile.viewport", group: "Performance & mobile", label: "Viewport meta tag", status: meta("viewport") ? "pass" : "fail", message: meta("viewport") ? "Present." : "Missing: phones get the desktop layout." });
    add({ id: "perf.home", group: "Performance & mobile", label: "Home page response from this server", status: home.ms < 1500 ? "pass" : home.ms < 3000 ? "warn" : "fail", message: `${home.ms} ms, ${Math.round(home.text.length / 1024)} KB of HTML. Core Web Vitals need field data from Search Console or PageSpeed Insights; this is a server-side timing only.` });
  } else {
    add({ id: "canonical.home", group: "Canonical domain", label: "Home page is reachable", status: "fail", message: `The home page answered ${home.status || home.error}.` });
  }

  // Real 404s
  const missingPath = `/seo-check-missing-${Date.now().toString(36)}`;
  const notFound = await get(fetchImpl, `${base}${missingPath}`);
  add({
    id: "http.404",
    group: "Status codes",
    label: "Missing pages return a real 404",
    status: notFound.status === 404 ? "pass" : "fail",
    message: notFound.status === 404 ? `${missingPath} answers 404 with the custom page.` : `${missingPath} answered ${notFound.status || notFound.error}; it should be 404 (a "soft 404" can be indexed).`,
  });

  // HTTPS and www on the public domain (today still Webflow's until DNS moves).
  if (opts.checkDomain !== false && process.env.SEO_CHECK_DOMAIN !== "false") {
    const host = new URL(canonical).host;
    const apex = host.replace(/^www\./, "");
    const variants = [`http://${apex}/`, `http://${host}/`, `https://${apex}/`];
    const results = await Promise.all(variants.map(async (url) => ({ url, res: await get(fetchImpl, url) })));
    for (const { url, res } of results) {
      const location = res.location ? new URL(res.location, url).toString() : null;
      const ok = (res.status === 301 || res.status === 308) && location?.startsWith(`${canonical}/`);
      add({
        id: `domain.${url}`,
        group: "HTTPS & www",
        label: `${url} → ${canonical}/`,
        status: res.status === 0 ? "not_checked" : ok ? "pass" : "fail",
        message: res.status === 0 ? `Couldn't reach ${url} from the server (${res.error ?? "no response"}).` : ok ? `${res.status} to ${location}.` : `Answered ${res.status}${location ? ` to ${location}` : ""}; expected a 301 to ${canonical}/.`,
      });
    }
    add({ id: "domain.note", group: "HTTPS & www", label: "Who serves the domain", status: "info", message: `${host} still points at Webflow until DNS moves, so these results describe the live Webflow site. After the move, nginx must send http:// and ${apex} to ${canonical} with a 301 (docs/SEO_PORTAL.md).` });
  }

  const counts = { pass: 0, warn: 0, fail: 0, info: 0, not_checked: 0 } as Record<CheckStatus, number>;
  for (const c of checks) counts[c.status]++;
  const result = { checkedAt: new Date().toISOString(), baseUrl: base, canonicalOrigin: canonical, siteUrl: site?.origin ?? null, blockAll, counts, checks };
  await prisma.auditLog.create({ data: { action: "SEO_TECHNICAL_CHECK", entityType: "SeoSiteSettings", entityId: "site", details: JSON.parse(JSON.stringify(result)) } }).catch(() => undefined);
  latestTechnical = result;
  return result;
}

/** The last result in this process (the checklist reads it as evidence). */
export let latestTechnical: Awaited<ReturnType<typeof runTechnicalChecks>> | null = null;

/** The last result, from this process or (after a restart) from the audit log. */
export async function getLatestTechnical(): Promise<Awaited<ReturnType<typeof runTechnicalChecks>> | null> {
  if (latestTechnical) return latestTechnical;
  const row = await prisma.auditLog.findFirst({ where: { action: "SEO_TECHNICAL_CHECK" }, orderBy: { createdAt: "desc" }, select: { details: true } });
  const details = row?.details as { checks?: unknown } | null;
  return details && Array.isArray(details.checks) ? (details as unknown as Awaited<ReturnType<typeof runTechnicalChecks>>) : null;
}

// ---------------------------------------------------------------------------------------------
// Crawler rules (the one setting changed from here)

export async function getCrawlerRules() {
  const settings = await prisma.seoSiteSettings.findUnique({ where: { id: "site" }, select: { crawlerRules: true } });
  const blocked = blockedCrawlers(settings?.crawlerRules);
  return {
    crawlers: CRAWLERS.map((c) => ({ ...c, rule: blocked.includes(c.agent) ? "block" : "allow" })),
    blocked,
    preview: robotsPreview(blocked, canonicalOrigin()),
  };
}

/** Saves per-crawler rules. Search engines can't be blocked; any block needs `confirm`. */
export async function saveCrawlerRules(rules: Record<string, "allow" | "block">, confirm: boolean, userId: string) {
  const known = new Set(CRAWLERS.map((c) => c.agent));
  for (const agent of Object.keys(rules)) if (!known.has(agent)) throw new SeoError(400, `Unknown crawler ${agent}.`);
  const searchBlocked = Object.entries(rules).filter(([a, v]) => v === "block" && SEARCH_AGENTS.has(a)).map(([a]) => a);
  if (searchBlocked.length) throw new SeoError(400, `${searchBlocked.join(", ")} can't be blocked: search engines must always reach the site.`);
  const before = await getCrawlerRules();
  const blocked = Object.entries(rules).filter(([, v]) => v === "block").map(([a]) => a);
  const newlyBlocked = blocked.filter((a) => !before.blocked.includes(a));
  if (newlyBlocked.length && !confirm) throw new SeoError(409, `Blocking ${newlyBlocked.join(", ")} removes the site from those AI services. Confirm to continue.`);
  const stored = Object.fromEntries(blocked.map((a) => [a, "block"]));
  await prisma.$transaction(async (tx) => {
    await tx.seoSiteSettings.upsert({ where: { id: "site" }, create: { id: "site", crawlerRules: stored, updatedById: userId }, update: { crawlerRules: stored, updatedById: userId } });
    await tx.auditLog.create({ data: { userId, action: "SEO_CRAWLER_RULES_UPDATED", entityType: "SeoSiteSettings", entityId: "site", details: { before: before.blocked, after: blocked } } });
  });
  return getCrawlerRules();
}
