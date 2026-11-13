// Text fixes for imported blog posts (prisma/catalog/blog-fixes-2026-11.json): exact sentence
// swaps that bring old tour names, prices and group sizes in line with the current tours. Each fix
// only replaces its own "from" text, so a post staff have rewritten in the SEO portal is left alone,
// and running it again changes nothing.

export interface TextFix {
  from: string;
  to: string;
}

/** Text fields of a SeoPage that a fix may touch (the rest are URLs, ids or settings). */
export const BLOG_TEXT_FIELDS = [
  "label",
  "h1",
  "seoTitle",
  "metaDescription",
  "excerpt",
  "ogTitle",
  "ogDescription",
  "twitterTitle",
  "twitterDescription",
  "searchTitle",
  "searchDescription",
  "answerSnippet",
  "citationFact",
  "body",
] as const;

export type BlogTextField = (typeof BLOG_TEXT_FIELDS)[number];

const LINK_TARGET = /\]\([^)\s]+\)/g;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The fix's "from" text as a pattern. A Markdown link target in it matches any target: the public
 * blog API shows links that hit a redirect at the redirect's target (cleanBody in seo.public.ts),
 * while the stored body may still hold the old address (e.g. /shared-tours-heart-of-banff). The
 * replacement uses the current address written in "to".
 */
export function fixPattern(from: string): RegExp {
  const parts = from.split(LINK_TARGET).map(escapeRegExp);
  return new RegExp(parts.join("\\]\\([^)\\s]+\\)"), "g");
}

export function applyTextFixes(text: string, fixes: TextFix[]): { text: string; applied: TextFix[] } {
  let out = text;
  const applied: TextFix[] = [];
  for (const fix of fixes) {
    if (!fix.from) continue;
    const pattern = fixPattern(fix.from);
    if (!pattern.test(out)) continue;
    out = out.replace(fixPattern(fix.from), () => fix.to);
    applied.push(fix);
  }
  return { text: out, applied };
}

/** Applies the fixes to every string inside a JSON value (FAQs, the unpublished draft). */
export function applyTextFixesDeep(value: unknown, fixes: TextFix[], applied: Set<TextFix>): unknown {
  if (typeof value === "string") {
    const r = applyTextFixes(value, fixes);
    r.applied.forEach((f) => applied.add(f));
    return r.text;
  }
  if (Array.isArray(value)) return value.map((v) => applyTextFixesDeep(v, fixes, applied));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applyTextFixesDeep(v, fixes, applied)]));
  }
  return value;
}

export type BlogPageText = Partial<Record<BlogTextField, string | null>> & { faqs?: unknown; draft?: unknown };

/**
 * The update for one post: changed fields only, plus which fixes were applied and which ones
 * found neither their old nor their new text (staff edited that passage: left as it is).
 */
export function planBlogTextFixes(page: BlogPageText, fixes: TextFix[]) {
  const data: Record<string, unknown> = {};
  const applied = new Set<TextFix>();
  for (const field of BLOG_TEXT_FIELDS) {
    const v = page[field];
    if (!v) continue;
    const r = applyTextFixes(v, fixes);
    if (r.text !== v) {
      data[field] = r.text;
      r.applied.forEach((f) => applied.add(f));
    }
  }
  for (const field of ["faqs", "draft"] as const) {
    const v = page[field];
    if (v == null) continue;
    const before = JSON.stringify(v);
    const next = applyTextFixesDeep(v, fixes, applied);
    if (JSON.stringify(next) !== before) data[field] = next;
  }
  const all = [...BLOG_TEXT_FIELDS.map((f) => page[f] ?? ""), JSON.stringify(page.faqs ?? null), JSON.stringify(page.draft ?? null)].join("\n");
  const missing = fixes.filter((f) => !applied.has(f) && !all.includes(f.to));
  return { data, applied: [...applied], missing };
}
