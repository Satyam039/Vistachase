// Webflow rich text (HTML) → the guide body format (frontend/src/components/seo/GuideMarkdown.tsx):
// ## / ### / #### headings, paragraphs, - and 1. lists, > quotes, **strong**, *em*, [links](href),
// ![alt](src) images and | pipe | tables | (cells keep their text, links and emphasis). Nothing else survives: scripts, iframes, styles and embeds are dropped and
// reported, so imported posts can never carry markup or code into the site.

export interface ConvertResult {
  markdown: string;
  notes: string[];
  stats: { headings: Record<string, number>; h1InBody: number; images: { src: string; alt: string | null }[]; links: string[]; embedsRemoved: number; words: number };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

/** Same-site absolute links become paths, so they work on any host and never chain through the old domain. */
export function localiseHref(href: string, siteHosts: string[]): string | null {
  const h = href.trim();
  if (/^(javascript|data|vbscript):/i.test(h)) return null;
  if (/^(mailto|tel):/i.test(h)) return h;
  if (h.startsWith("#")) return null;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  try {
    const url = new URL(h.startsWith("//") ? `https:${h}` : h);
    if (siteHosts.includes(url.host.toLowerCase())) return `${url.pathname.replace(/\/+$/, "") || "/"}${url.search}${url.hash}`;
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().replace(/^http:/, "https:") : null;
  } catch {
    return null;
  }
}

// The body format has no escapes, so brackets inside link text and alt text are dropped.
const escapeInline = (s: string) => s.replace(/[[\]]/g, "");
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

const BLOCKS = new Set(["p", "div", "section", "article", "figure", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "table", "tr", "hr", "pre"]);
const DROP_WITH_CONTENT = /<(script|style|iframe|noscript|object|embed|video|audio|form|svg|template|canvas)\b[\s\S]*?<\/\1\s*>/gi;

/** Rows of cell text → a pipe table; the first row is the header (the body format needs one). */
export function pipeTable(rows: string[][]): string[] {
  const filled = rows.filter((r) => r.some((c) => c));
  if (!filled.length) return [];
  const cols = Math.max(...filled.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? "").join(" | ")} |`;
  return [line(filled[0]), `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`, ...filled.slice(1).map(line), ""];
}

export function htmlToMarkdown(html: string, opts: { siteHosts?: string[]; mapImage?: (src: string) => string | null } = {}): ConvertResult {
  const siteHosts = (opts.siteHosts ?? ["www.vistachase.com", "vistachase.com"]).map((h) => h.toLowerCase());
  const notes: string[] = [];
  const stats: ConvertResult["stats"] = { headings: {}, h1InBody: 0, images: [], links: [], embedsRemoved: 0, words: 0 };

  let src = html.replace(/<!--[\s\S]*?-->/g, "");
  // Webflow embeds: <div class="w-embed ...">…</div> (often raw HTML or widgets).
  src = src.replace(/<div\b[^>]*class=["'][^"']*\bw-embed\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, () => {
    stats.embedsRemoved++;
    return "";
  });
  src = src.replace(DROP_WITH_CONTENT, () => {
    stats.embedsRemoved++;
    return "";
  });

  const lines: string[] = [];
  let buf = "";
  let prefix = "";
  const listStack: ("ul" | "ol")[] = [];
  const olCounters: number[] = [];
  const inline: { tag: string; start: number; href?: string | null }[] = [];
  let table: { rows: string[][] } | null = null;

  const flush = () => {
    const text = clean(buf);
    if (text) lines.push(prefix + text);
    buf = "";
    prefix = "";
  };
  const blank = () => {
    flush();
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
  };

  const tokens = src.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g);
  for (const t of tokens) {
    if (t[4] !== undefined) {
      buf += decodeEntities(t[4]);
      continue;
    }
    const closing = t[1] === "/";
    const tag = t[2].toLowerCase();
    const rawTag = t[0];

    if (tag === "br") {
      buf += " ";
      continue;
    }
    if (tag === "table") {
      if (!closing) {
        blank();
        table = { rows: [] };
      } else if (table) {
        lines.push(...pipeTable(table.rows));
        table = null;
        buf = "";
        blank();
      }
      continue;
    }
    if (table) {
      // Inside a table only rows, cells and inline markup count; images and blocks in cells are dropped.
      if (tag === "tr" && !closing) table.rows.push([]);
      else if (tag === "td" || tag === "th") {
        if (!closing) buf = "";
        else {
          if (!table.rows.length) table.rows.push([]);
          table.rows[table.rows.length - 1].push(clean(buf).replace(/\|/g, "/"));
          buf = "";
        }
        continue;
      }
      if (!["a", "strong", "b", "em", "i"].includes(tag)) continue;
    }
    if (tag === "img" && !closing) {
      const original = attr(rawTag, "src");
      if (!original) continue;
      const mapped = opts.mapImage?.(original) ?? original;
      const href = localiseHref(mapped, siteHosts);
      if (!href) continue;
      const alt = attr(rawTag, "alt");
      stats.images.push({ src: href, alt });
      blank();
      lines.push(`![${escapeInline(clean(alt ?? ""))}](${href.replace(/[()\s]/g, encodeURIComponent)})`);
      lines.push("");
      continue;
    }
    if (tag === "hr") {
      blank();
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      if (!closing) {
        blank();
        const level = Number(tag[1]);
        if (level === 1) stats.h1InBody++;
        const md = level <= 2 ? "##" : level === 3 ? "###" : "####";
        stats.headings[tag] = (stats.headings[tag] ?? 0) + 1;
        prefix = `${md} `;
      } else blank();
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      if (!closing) {
        blank();
        listStack.push(tag);
        olCounters.push(0);
      } else {
        flush();
        listStack.pop();
        olCounters.pop();
        if (listStack.length === 0) blank();
      }
      continue;
    }
    if (tag === "li") {
      if (!closing) {
        flush();
        const kind = listStack[listStack.length - 1] ?? "ul";
        if (kind === "ol") olCounters[olCounters.length - 1]++;
        prefix = kind === "ol" ? `${olCounters[olCounters.length - 1] || 1}. ` : "- ";
      } else flush();
      continue;
    }
    if (tag === "blockquote") {
      if (!closing) {
        blank();
        prefix = "> ";
      } else blank();
      continue;
    }
    if (tag === "strong" || tag === "b" || tag === "em" || tag === "i") {
      const mark = tag === "strong" || tag === "b" ? "**" : "*";
      if (!closing) {
        inline.push({ tag, start: buf.length });
        buf += mark;
      } else {
        const open = inline.map((x) => x.tag).lastIndexOf(tag);
        if (open >= 0) {
          const { start } = inline.splice(open, 1)[0];
          const inner = buf.slice(start + mark.length);
          // Empty or whitespace-only emphasis would print stray asterisks.
          if (!inner.trim()) buf = buf.slice(0, start) + inner;
          else buf = buf.slice(0, start) + mark + inner.trim() + mark + (/\s$/.test(inner) ? " " : "");
        }
      }
      continue;
    }
    if (tag === "a") {
      if (!closing) {
        const href = attr(rawTag, "href");
        inline.push({ tag, start: buf.length, href: href ? localiseHref(href, siteHosts) : null });
      } else {
        const open = inline.map((x) => x.tag).lastIndexOf("a");
        if (open >= 0) {
          const { start, href } = inline.splice(open, 1)[0];
          const text = clean(buf.slice(start));
          if (href && text) {
            stats.links.push(href);
            buf = `${buf.slice(0, start)}[${escapeInline(text)}](${href.replace(/[()\s]/g, encodeURIComponent)}) `;
          }
        }
      }
      continue;
    }
    if (BLOCKS.has(tag)) {
      if (tag === "figcaption" && !closing) {
        blank();
        continue;
      }
      // A block inside a list item stays on the item's line.
      if (listStack.length && (tag === "p" || tag === "div")) continue;
      blank();
    }
    // Anything else (span, td, sup…): keep its text, drop the tag.
  }
  flush();

  let markdown = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  markdown = markdown.replace(/^(#{2,4}) \*\*(.+)\*\*$/gm, "$1 $2");
  stats.words = markdown.replace(/[#>*|\-[\]()!]/g, " ").split(/\s+/).filter(Boolean).length;

  if (stats.h1InBody) notes.push(`${stats.h1InBody} H1 heading${stats.h1InBody === 1 ? "" : "s"} in the body became H2, so the post name stays the only H1.`);
  if (stats.headings.h5 || stats.headings.h6) notes.push("H5/H6 headings became H4 (the deepest level the blog template shows).");
  if (stats.embedsRemoved) notes.push(`${stats.embedsRemoved} embed${stats.embedsRemoved === 1 ? "" : "s"} (video, iframe or custom code) removed; add them back by hand if they matter.`);
  return { markdown, notes, stats };
}
