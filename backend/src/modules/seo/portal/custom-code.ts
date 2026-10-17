// Page-level custom code, like Webflow's "Inside <head> tag" and "Before </body> tag" boxes. Only an
// admin can save it (the route checks), and only a short list of tags is accepted: <script> (inline,
// or an https src), <noscript>, <meta> (name/property + content; no http-equiv), <link> (a few safe
// rel values, https href) and <style>. Anything else is refused with a reason, so a paste can't put
// arbitrary markup on the site. The public site renders the parsed elements, never the raw string.

import prisma from "@/lib/db/prisma";
import { SeoError } from "@/modules/seo/seo.errors";
import { publishedPageSchema } from "@/modules/seo/portal/schema";
import { liveOf } from "@/modules/seo/seo.pages";

export const CUSTOM_CODE_MAX = 20_000;

export type CodeElement =
  | { tag: "script"; attrs: Record<string, string | true>; content: string }
  | { tag: "noscript"; content: string }
  | { tag: "style"; content: string }
  | { tag: "meta"; attrs: Record<string, string> }
  | { tag: "link"; attrs: Record<string, string> };

const LINK_RELS = new Set(["preconnect", "dns-prefetch", "preload", "prefetch", "stylesheet", "alternate", "me", "author", "manifest"]);
const SCRIPT_TYPES = new Set(["text/javascript", "application/javascript", "module", "application/ld+json", "text/partytown"]);

function attrsOf(raw: string): { attrs: Record<string, string | true>; error?: string } {
  const attrs: Record<string, string | true> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (name.startsWith("on")) return { attrs, error: `event handler attributes like ${name} aren't allowed` };
    attrs[name] = m[2] ?? m[3] ?? m[4] ?? true;
  }
  // Whatever no attribute pattern matched (one pass, so long input stays linear).
  const rest = raw.replace(re, "");
  if (rest.replace(/\/\s*$/, "").trim()) return { attrs, error: `couldn't read the attributes "${rest.trim().slice(0, 40)}"` };
  return { attrs };
}

const httpsUrl = (v: string | true | undefined) => typeof v === "string" && /^https:\/\/[^\s"'<>]+$/i.test(v);

/** Parses custom code into allowed elements, or lists what's wrong. */
export function parseCustomCode(code: string, where: "head" | "body"): { elements: CodeElement[]; errors: string[] } {
  const elements: CodeElement[] = [];
  const errors: string[] = [];
  if (code.length > CUSTOM_CODE_MAX) return { elements, errors: [`Keep it under ${CUSTOM_CODE_MAX.toLocaleString("en-CA")} characters.`] };
  const src = code.replace(/<!--[\s\S]*?-->/g, "");
  const re = /<(script|noscript|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<(meta|link)\b([^>]*?)\/?>|<\s*([a-zA-Z][\w-]*)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(src))) {
    const between = src.slice(last, m.index);
    if (between.trim()) errors.push(`Text outside a tag isn't allowed: "${between.trim().slice(0, 40)}".`);
    last = m.index + m[0].length;
    n++;
    if (m[6] && /^(script|noscript|style)$/i.test(m[6])) {
      errors.push(`<${m[6].toLowerCase()}> is missing its closing </${m[6].toLowerCase()}> tag.`);
      last = src.length;
      break;
    }
    if (m[6]) {
      errors.push(`<${m[6].toLowerCase()}> isn't allowed here. Use <script>, <noscript>, <style>, <meta> or <link>.`);
      // Skip past this element (to its closing tag when it has one) so its contents aren't reported again.
      const open = src.indexOf(">", last);
      const closeTag = new RegExp(`</${m[6]}\\s*>`, "i").exec(src.slice(open === -1 ? src.length : open));
      last = open === -1 ? src.length : closeTag ? open + closeTag.index + closeTag[0].length : open + 1;
      re.lastIndex = last;
      continue;
    }
    const tag = (m[1] ?? m[4]).toLowerCase() as "script" | "noscript" | "style" | "meta" | "link";
    const { attrs, error } = attrsOf(m[2] ?? m[5] ?? "");
    if (error) {
      errors.push(`<${tag}>: ${error}.`);
      continue;
    }
    if (tag === "script") {
      const content = m[3] ?? "";
      const type = typeof attrs.type === "string" ? attrs.type.toLowerCase() : null;
      if (type && !SCRIPT_TYPES.has(type)) errors.push(`<script type="${type}"> isn't allowed.`);
      else if (attrs.src !== undefined && !httpsUrl(attrs.src)) errors.push("A script src must be a full https:// address.");
      else if (attrs.src !== undefined && content.trim()) errors.push("A script with a src can't also have code inside it.");
      else if (/<\/script/i.test(content)) errors.push("A script can't contain </script>.");
      else if (type === "application/ld+json") {
        try {
          JSON.parse(content);
          elements.push({ tag, attrs, content });
        } catch {
          errors.push("A JSON-LD script isn't valid JSON. Use the Schema markup box for structured data.");
        }
      } else elements.push({ tag, attrs, content });
    } else if (tag === "noscript" || tag === "style") {
      const content = m[3] ?? "";
      if (/<\s*(script|iframe|object|embed|form)\b/i.test(content) && tag === "noscript") errors.push("<noscript> can hold images and text only.");
      else if (tag === "style" && /<\//.test(content)) errors.push("<style> can't contain other tags.");
      else elements.push({ tag, content });
    } else if (tag === "meta") {
      if (attrs["http-equiv"] !== undefined) errors.push("<meta http-equiv> isn't allowed (it can redirect the page or set cookies).");
      else if (attrs.charset !== undefined) errors.push("<meta charset> is already set by the site.");
      else if (typeof attrs.content !== "string" || (typeof attrs.name !== "string" && typeof attrs.property !== "string")) errors.push("<meta> needs a name (or property) and a content.");
      else elements.push({ tag, attrs: Object.fromEntries(Object.entries(attrs).filter(([k]) => ["name", "property", "content"].includes(k))) as Record<string, string> });
    } else {
      const rel = typeof attrs.rel === "string" ? attrs.rel.toLowerCase() : "";
      if (!LINK_RELS.has(rel)) errors.push(`<link rel="${rel || "?"}"> isn't allowed.`);
      else if (!httpsUrl(attrs.href)) errors.push("A <link> href must be a full https:// address.");
      else elements.push({ tag, attrs: Object.fromEntries(Object.entries(attrs).filter(([k, v]) => typeof v === "string" && ["rel", "href", "as", "type", "crossorigin", "hreflang", "media", "title", "sizes"].includes(k))) as Record<string, string> });
    }
  }
  const tail = src.slice(last);
  if (tail.trim()) errors.push(`Text outside a tag isn't allowed: "${tail.trim().slice(0, 40)}".`);
  if (where === "body" && elements.some((e) => e.tag === "meta" || e.tag === "link")) errors.push("<meta> and <link> belong in the head box.");
  if (n > 40) errors.push("Keep it to 40 tags or fewer.");
  return { elements, errors };
}

/** Admin only (the route checks): saves both boxes after validating them. Empty text clears a box. */
export async function saveCustomCode(pageId: string, input: { head: string; body: string }, userId: string) {
  const page = await prisma.seoPage.findUnique({ where: { id: pageId }, select: { id: true, path: true, customHeadCode: true, customBodyCode: true } });
  if (!page) throw new SeoError(404, "Page not found.");
  const head = input.head.trim();
  const body = input.body.trim();
  const errors = [...parseCustomCode(head, "head").errors.map((e) => `Head: ${e}`), ...parseCustomCode(body, "body").errors.map((e) => `Before </body>: ${e}`)];
  if (errors.length) throw new SeoError(400, errors.join(" "));
  const next = { customHeadCode: head || null, customBodyCode: body || null };
  if (next.customHeadCode === page.customHeadCode && next.customBodyCode === page.customBodyCode) return { changed: false, ...next };
  await prisma.$transaction([
    prisma.seoPage.update({ where: { id: pageId }, data: { ...next, updatedById: userId } }),
    prisma.seoPageRevision.create({ data: { pageId, userId, action: "UPDATED", changes: { customHeadCode: { from: page.customHeadCode ? `${page.customHeadCode.length} characters` : null, to: head ? `${head.length} characters` : null }, customBodyCode: { from: page.customBodyCode ? `${page.customBodyCode.length} characters` : null, to: body ? `${body.length} characters` : null } } } }),
    prisma.auditLog.create({ data: { userId, action: "SEO_CUSTOM_CODE_UPDATED", entityType: "SeoPage", entityId: pageId, details: { path: page.path, headChars: head.length, bodyChars: body.length } } }),
  ]);
  return { changed: true, ...next };
}

/** For the public site: a published page's JSON-LD blocks and parsed custom code. */
export async function publicPageExtras(path: string) {
  const page = await prisma.seoPage.findFirst({ where: { path, status: "PUBLISHED" }, select: { id: true, customHeadCode: true, customBodyCode: true } });
  if (!page) return null;
  const schema = (await publishedPageSchema(page.id)) as Record<string, unknown>[];
  return {
    schema,
    head: page.customHeadCode ? parseCustomCode(page.customHeadCode, "head").elements : [],
    body: page.customBodyCode ? parseCustomCode(page.customBodyCode, "body").elements : [],
  };
}

/** Pages for an on-site search: search title/description/image fall back to the SEO fields, then to what the last audit read on the live page. */
export async function siteSearchIndex() {
  const pages = await prisma.seoPage.findMany({
    where: { status: "PUBLISHED", searchExclude: false, robotsIndex: true },
    select: { path: true, label: true, seoTitle: true, metaDescription: true, ogImage: true, featuredImage: true, searchTitle: true, searchDescription: true, searchImage: true, excerpt: true, lastCrawl: true },
    orderBy: { path: "asc" },
  });
  return pages.map((p) => {
    const live = liveOf(p);
    return {
      path: p.path,
      title: p.searchTitle ?? p.seoTitle ?? live?.title ?? p.label,
      description: p.searchDescription ?? p.metaDescription ?? p.excerpt ?? live?.description ?? null,
      image: p.searchImage ?? p.ogImage ?? p.featuredImage ?? live?.ogImage ?? null,
    };
  });
}
