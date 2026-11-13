// Exact-phrase text corrections for saved pages (prisma/catalog/blog-content-fixes-2026-11.json,
// applied on deploy by scripts/apply-seo-fixes.ts). A phrase is matched the way the page reads,
// not byte for byte: any run of spaces or line breaks matches any other, Webflow's stray zero-width
// joiners are ignored, and a link written "](/path" also matches "](https://www.vistachase.com/path".
// A phrase staff have already reworded no longer matches, so their text is left as it is.

export interface TextFix {
  from: string;
  to: string;
}

const INVISIBLE = "[\\u200b\\u200d]*";
const SPACE = "[\\s\\u200b\\u200d]+";
const escape = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** The pattern that finds `from` in a saved text (global). */
export function phrasePattern(from: string): RegExp {
  let out = "";
  const text = from.trim();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!out.endsWith(SPACE)) out += SPACE;
      continue;
    }
    if (ch === "]" && text[i + 1] === "(" && text[i + 2] === "/") {
      out += `\\]${INVISIBLE}\\((?:https?:\\/\\/(?:www\\.)?vistachase\\.com)?\\/${INVISIBLE}`;
      i += 2;
      continue;
    }
    out += escape(ch) + INVISIBLE;
  }
  return new RegExp(out, "g");
}

/** `text` with every fix applied, and how many phrases were replaced. */
export function applyTextFixes(text: string, fixes: TextFix[]): { text: string; replaced: number } {
  let out = text;
  let replaced = 0;
  for (const fix of fixes) {
    out = out.replace(phrasePattern(fix.from), () => {
      replaced++;
      return fix.to;
    });
  }
  return { text: out, replaced };
}

/** Applies the fixes to every string inside a JSON value (FAQs, an unpublished draft). */
export function applyTextFixesDeep<T>(value: T, fixes: TextFix[]): { value: T; replaced: number } {
  let replaced = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = applyTextFixes(v, fixes);
      replaced += r.replaced;
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { value: walk(value) as T, replaced };
}
