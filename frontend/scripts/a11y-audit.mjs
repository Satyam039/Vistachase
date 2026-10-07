// Accessibility audit of every frontend route against WCAG 2.2 AA.
//
//   node scripts/a11y-audit.mjs [--base http://localhost:3000] [--only /path,/path] [--out a11y-report]
//
// Needs the frontend and backend running, and Google Chrome installed (playwright-core
// drives the installed Chrome, so no browser download). For each route, at a 320px phone
// width (WCAG 1.4.10 reflow) and a 1440px desktop width, it reports:
//   axe       axe-core WCAG 2.0/2.1/2.2 A and AA rules
//   reflow    horizontal page scrolling, and the elements that stick out
//   keyboard  Tab order: focus with no visible indicator (2.4.7), focus hidden behind the
//             sticky header or other content (2.4.11), keyboard traps (2.1.2)
// Writes <out>/report.json and <out>/summary.md; exits 1 when anything fails.

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("--base", "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(arg("--out", "a11y-report"));
const ONLY = arg("--only", "")
  .split(",")
  .filter(Boolean);

const VIEWPORTS = [
  { name: "phone-320", width: 320, height: 720, isMobile: true },
  { name: "desktop-1440", width: 1440, height: 900, isMobile: false },
];
const MAX_TABS = 80;

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function routes() {
  if (ONLY.length) return ONLY;
  const { tours } = await json(`${BASE}/api/tours`);
  const { destinations } = await json(`${BASE}/api/destinations`);
  return [
    "/",
    "/about-us",
    "/contact-us",
    "/faq",
    "/gallery",
    "/shared-tours",
    "/private-tours",
    "/shuttles",
    "/banff-activity-tickets",
    "/partners",
    "/partners/login",
    "/partners/dashboard",
    "/search",
    "/destinations",
    ...destinations.map((d) => `/destinations/${d.slug}`),
    ...tours.map((t) => `/${t.slug}`),
    `/book?departureId=${encodeURIComponent(tours.find((t) => t.departures.length)?.departures[0].id ?? "")}&guests=2`,
    "/concierge",
    "/pickup-finder",
    "/login",
    "/register",
    "/account/trips",
    "/privacy-policy",
    "/privacy-policy-vista-chase",
    "/terms-and-conditions",
    "/booking/VC-2026-98412/voucher",
    "/admin",
    "/admin/dispatch",
    "/admin/operations",
    "/admin/partners",
    "/this-page-does-not-exist",
  ];
}

/** Scroll the whole page in steps so scroll-triggered reveals and lazy images render. */
async function revealAll(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    // Let scroll-triggered fade-ins finish so colours are measured at full opacity.
    await new Promise((r) => setTimeout(r, 1200));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

async function reflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - vw;
    if (overflow <= 1) return { overflow: 0, offenders: [] };
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return true;
      }
      return false;
    };
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1 || clipped(el)) continue;
      const s = getComputedStyle(el);
      if (s.position === "fixed" || s.visibility === "hidden") continue;
      const id = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".") : "");
      offenders.push({ el: id.slice(0, 160), right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 50) });
      if (offenders.length >= 8) break;
    }
    return { overflow, offenders };
  });
}

async function keyboard(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });
  const issues = [];
  const seen = new Set();
  let previous = null;
  let repeats = 0;
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      // Skip the Next.js dev overlay (dev builds only).
      if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
      // The site scrolls smoothly; jump instantly so the measurement sees the final position.
      document.documentElement.style.scrollBehavior = "auto";
      el.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const describe = (n) =>
        n.tagName.toLowerCase() +
        (n.getAttribute("aria-label") ? `[aria-label="${n.getAttribute("aria-label").slice(0, 40)}"]` : "") +
        (n.textContent ? ` "${n.textContent.trim().replace(/\s+/g, " ").slice(0, 40)}"` : "");
      // Visible focus: an outline, a box-shadow ring, or a border/background change from the
      // unfocused look. Compare with the same element after blurring.
      // The indicator may be drawn by a wrapper (Astryx fields ring their container on
      // :focus-within), so look at the element and its two nearest ancestors.
      const looks = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean).map((n) => {
        const t = getComputedStyle(n);
        return [t.outlineStyle, t.outlineWidth, t.boxShadow, t.borderColor, t.backgroundColor, t.textDecorationLine].join("|");
      });
      const focusedLook = looks.join("||");
      const ringOn = (n) => {
        const t = getComputedStyle(n);
        const shadow = t.boxShadow && t.boxShadow !== "none" && !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px/.test(t.boxShadow);
        return (t.outlineStyle !== "none" && parseFloat(t.outlineWidth) > 0) || shadow;
      };
      const hasRing = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean).some(ringOn);
      // Obscured: sample the element's points; it's obscured when none of them hit the element.
      const pts = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 2, r.top + 2],
        [r.right - 2, r.bottom - 2],
      ];
      const inView = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      let visiblePoints = 0;
      let coveredBy = null;
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && (hit === el || el.contains(hit) || hit.contains(el))) visiblePoints++;
        else if (hit) coveredBy = describe(hit).slice(0, 80);
      }
      return {
        key: describe(el) + `@${Math.round(r.left)},${Math.round(r.top + window.scrollY)}`,
        el: describe(el),
        hasRing,
        focusedLook,
        size: [Math.round(r.width), Math.round(r.height)],
        obscured: inView ? visiblePoints === 0 : false,
        offscreen: !inView && r.width > 0,
        coveredBy,
      };
    });
    if (!info) continue;
    // Compare with the unfocused look to catch indicators made from border/background changes.
    let changed = info.hasRing;
    if (!changed) {
      const unfocused = await page.evaluate(() => {
        const el = document.activeElement;
        el.blur();
        const look = [el, el.parentElement, el.parentElement?.parentElement]
          .filter(Boolean)
          .map((n) => {
            const t = getComputedStyle(n);
            return [t.outlineStyle, t.outlineWidth, t.boxShadow, t.borderColor, t.backgroundColor, t.textDecorationLine].join("|");
          })
          .join("||");
        el.focus({ focusVisible: true });
        return look;
      });
      changed = unfocused !== info.focusedLook;
    }
    if (!changed) issues.push({ type: "no-visible-focus", el: info.el });
    if (info.obscured) issues.push({ type: "focus-obscured", el: info.el, coveredBy: info.coveredBy });
    if (info.offscreen) issues.push({ type: "focus-offscreen", el: info.el });
    if (info.key === previous) {
      if (++repeats >= 3) {
        issues.push({ type: "keyboard-trap", el: info.el });
        break;
      }
    } else repeats = 0;
    previous = info.key;
    if (seen.has(info.key) && i > 5) break; // wrapped around
    seen.add(info.key);
  }
  // Deduplicate identical findings.
  const unique = new Map(issues.map((x) => [`${x.type}|${x.el}`, x]));
  return [...unique.values()];
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
const list = await routes();
for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    reducedMotion: "no-preference",
  });
  for (const route of list) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
    const entry = { route, viewport: viewport.name };
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      entry.status = res?.status();
      await revealAll(page);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
        .analyze();
      entry.axe = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        tags: v.tags.filter((t) => t.startsWith("wcag")),
        nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(" "), summary: n.failureSummary?.split("\n").slice(0, 3).join(" ").slice(0, 300) })),
        count: v.nodes.length,
      }));
      // Best practices (headings, landmarks): reported as warnings, not WCAG failures.
      const bp = await new AxeBuilder({ page }).withTags(["best-practice"]).analyze();
      entry.bestPractice = bp.violations.map((v) => ({ id: v.id, help: v.help, count: v.nodes.length, target: v.nodes[0]?.target.join(" ") }));
      entry.incomplete = axe.incomplete.filter((v) => v.id === "color-contrast").reduce((n, v) => n + v.nodes.length, 0);
      entry.reflow = viewport.width <= 400 ? await reflow(page) : { overflow: 0, offenders: [] };
      entry.keyboard = await keyboard(page);
      entry.consoleErrors = consoleErrors.slice(0, 5);
    } catch (error) {
      entry.error = String(error).slice(0, 300);
    }
    report.push(entry);
    const n = (entry.axe?.reduce((s, v) => s + v.count, 0) ?? 0) + (entry.keyboard?.length ?? 0) + (entry.reflow?.overflow ? 1 : 0);
    console.log(`${viewport.name.padEnd(13)} ${String(entry.status ?? "ERR").padEnd(4)} ${route.slice(0, 60).padEnd(60)} ${n ? `${n} issue(s)` : "ok"}${entry.error ? " " + entry.error : ""}`);
    await page.close();
  }
  await context.close();
}
await browser.close();

// Summary grouped by rule across pages.
const byRule = new Map();
const add = (key, label, entry, detail) => {
  const r = byRule.get(key) ?? { label, pages: new Set(), count: 0, examples: [] };
  r.pages.add(`${entry.route} (${entry.viewport})`);
  r.count++;
  if (r.examples.length < 4) r.examples.push(detail);
  byRule.set(key, r);
};
for (const e of report) {
  for (const v of e.axe ?? []) add(`axe:${v.id}`, `${v.help} [${v.impact}; ${v.tags.join(", ")}]`, e, `${e.route}: ${v.nodes[0]?.target}`);
  for (const k of e.keyboard ?? []) add(`kbd:${k.type}`, k.type, e, `${e.route}: ${k.el}${k.coveredBy ? ` (under ${k.coveredBy})` : ""}`);
  if (e.reflow?.overflow) add("reflow", "Horizontal scrolling at 320px (WCAG 1.4.10)", e, `${e.route}: +${e.reflow.overflow}px ${e.reflow.offenders[0]?.el ?? ""}`);
  if (e.error) add("error", "Page failed to load", e, `${e.route}: ${e.error}`);
}
const warnings = new Map();
for (const e of report)
  for (const v of e.bestPractice ?? []) {
    const w = warnings.get(v.id) ?? { help: v.help, pages: [] };
    w.pages.push(`${e.route} (${e.viewport}): ${v.target}`);
    warnings.set(v.id, w);
  }
let md = `# Accessibility audit (WCAG 2.2 AA)\n\nBase: ${BASE} · ${list.length} routes × ${VIEWPORTS.length} viewports\n\n`;
if (byRule.size === 0) md += "No issues found.\n";
for (const [key, r] of [...byRule.entries()].sort((a, b) => b[1].count - a[1].count)) {
  md += `## ${key}: ${r.label}\n\n${r.count} finding(s) on ${r.pages.size} page/viewport(s)\n\n${r.examples.map((x) => `- ${x}`).join("\n")}\n\n`;
}
if (warnings.size) {
  md += `\n# Best-practice warnings (not WCAG failures)\n\n`;
  for (const [id, w] of warnings) md += `## ${id}: ${w.help}\n\n${w.pages.length} page/viewport(s)\n\n${w.pages.slice(0, 4).map((x) => `- ${x}`).join("\n")}\n\n`;
}
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
await fs.writeFile(path.join(OUT, "summary.md"), md);
console.log(`\n${byRule.size} rule(s) with findings → ${path.relative(process.cwd(), OUT)}/summary.md`);
process.exit(byRule.size ? 1 : 0);
