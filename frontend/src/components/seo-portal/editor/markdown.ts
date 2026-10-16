// The blog body is stored in the small Markdown subset that GuideMarkdown renders (headings, paragraphs,
// lists, quotes, images, tables, bold, italic and links). The rich text editor works on TipTap's JSON
// document, so these two functions translate between them. Anything the public renderer can't show
// (nested lists, marks inside links, images inside table cells) is flattened here, so what the editor
// saves is exactly what the post shows.

import type { JSONContent } from "@tiptap/react";
import { imageSrc, parseGuide, safeHref } from "@/components/seo/GuideMarkdown";

// ---------------------------------------------------------------------------------------------
// Markdown → editor document

function inlineNodes(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string, marks?: JSONContent["marks"]) => {
    if (t) out.push(marks?.length ? { type: "text", text: t, marks } : { type: "text", text: t });
  };
  while ((m = re.exec(text))) {
    if (m.index > last) push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      push(m[1], href ? [{ type: "link", attrs: { href } }] : undefined);
    } else if (m[3] !== undefined) push(m[3], [{ type: "bold" }]);
    else push(m[4], [{ type: "italic" }]);
    last = m.index + m[0].length;
  }
  if (last < text.length) push(text.slice(last));
  return out;
}

const para = (text: string): JSONContent => {
  const content = inlineNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

export function markdownToDoc(body: string | null | undefined): JSONContent {
  const content: JSONContent[] = [];
  for (const b of parseGuide(body ?? "")) {
    switch (b.kind) {
      case "h2":
      case "h3":
      case "h4":
        content.push({ type: "heading", attrs: { level: Number(b.kind[1]) }, content: inlineNodes(b.text) });
        break;
      case "img":
        content.push({ type: "image", attrs: { src: b.src, alt: b.alt || null } });
        break;
      case "quote": {
        const prev = content[content.length - 1];
        // Consecutive "> " lines are one quote with several paragraphs.
        if (prev?.type === "blockquote") prev.content!.push(para(b.text));
        else content.push({ type: "blockquote", content: [para(b.text)] });
        break;
      }
      case "ul":
      case "ol":
        content.push({
          type: b.kind === "ul" ? "bulletList" : "orderedList",
          content: b.items.map((item) => ({ type: "listItem", content: [para(item)] })),
        });
        break;
      case "table":
        content.push({
          type: "table",
          content: [
            { type: "tableRow", content: b.head.map((c) => ({ type: "tableHeader", content: [para(c)] })) },
            ...b.rows.map((row) => ({ type: "tableRow", content: row.map((c) => ({ type: "tableCell", content: [para(c)] })) })),
          ],
        });
        break;
      default:
        content.push(para(b.text));
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

// ---------------------------------------------------------------------------------------------
// Editor document → Markdown

const hasMark = (n: JSONContent, type: string) => n.marks?.some((m) => m.type === type) ?? false;
const linkOf = (n: JSONContent) => {
  const href = n.marks?.find((m) => m.type === "link")?.attrs?.href;
  return typeof href === "string" ? safeHref(href) : null;
};
// The body format has no escapes: brackets would start a link and newlines a new block.
const plain = (s: string) => s.replace(/[\r\n]+/g, " ");

/** Wraps text in a marker, keeping surrounding spaces outside it ("** bold **" wouldn't render). */
function wrap(text: string, marker: string) {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return m[2] ? `${m[1]}${marker}${m[2]}${marker}${m[3]}` : text;
}

export function inlineMarkdown(nodes: JSONContent[] | undefined): string {
  // Text nodes become runs: neighbours with the same link (or the same bold/italic) are joined first,
  // so "**Lake** **Louise**" comes out as one "**Lake Louise**".
  type Run = { text: string; href: string | null; bold: boolean; italic: boolean };
  const runs: Run[] = [];
  for (const n of nodes ?? []) {
    const text = n.type === "hardBreak" ? " " : n.type === "text" ? plain(n.text ?? "") : "";
    if (!text) continue;
    const run = { text, href: linkOf(n), bold: hasMark(n, "bold"), italic: hasMark(n, "italic") };
    const prev = runs[runs.length - 1];
    if (prev && prev.href === run.href && (run.href || (prev.bold === run.bold && prev.italic === run.italic))) prev.text += run.text;
    else runs.push(run);
  }
  return runs
    .map((r) => {
      if (r.href) {
        const label = r.text.replace(/[[\]]/g, "").trim();
        return label ? `${r.text.match(/^\s*/)![0]}[${label}](${r.href.replace(/[()\s]/g, encodeURIComponent)})${r.text.match(/\s*$/)![0]}` : r.text;
      }
      const t = r.text.replace(/\*/g, "");
      // Bold and italic together: the renderer shows one mark per run, bold wins.
      return r.bold ? wrap(t, "**") : r.italic ? wrap(t, "*") : r.text;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** All the text of a block (several paragraphs, nested lists) as one line. */
const blockText = (n: JSONContent): string =>
  (n.content ?? [])
    .map((c) => (c.type === "paragraph" || c.type === "heading" ? inlineMarkdown(c.content) : blockText(c)))
    .filter(Boolean)
    .join(" ");

function listItems(list: JSONContent): string[] {
  const items: string[] = [];
  for (const item of list.content ?? []) {
    const own = (item.content ?? []).filter((c) => c.type !== "bulletList" && c.type !== "orderedList");
    const text = own.map((c) => (c.type === "paragraph" ? inlineMarkdown(c.content) : blockText(c))).filter(Boolean).join(" ");
    if (text) items.push(text);
    // Nested lists can't be shown, so their items join the outer list.
    for (const nested of (item.content ?? []).filter((c) => c.type === "bulletList" || c.type === "orderedList")) items.push(...listItems(nested));
  }
  return items;
}

export function docToMarkdown(doc: JSONContent | null | undefined): string {
  const blocks: string[] = [];
  for (const n of doc?.content ?? []) {
    switch (n.type) {
      case "heading": {
        const text = inlineMarkdown(n.content);
        const level = Math.min(Math.max(Number(n.attrs?.level) || 2, 2), 4);
        if (text) blocks.push(`${"#".repeat(level)} ${text}`);
        break;
      }
      case "paragraph": {
        const text = inlineMarkdown(n.content);
        if (text) blocks.push(text);
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = listItems(n);
        if (items.length) blocks.push(items.map((t, i) => (n.type === "bulletList" ? `- ${t}` : `${i + 1}. ${t}`)).join("\n"));
        break;
      }
      case "blockquote": {
        const lines = (n.content ?? []).map((c) => (c.type === "paragraph" ? inlineMarkdown(c.content) : blockText(c))).filter(Boolean);
        if (lines.length) blocks.push(lines.map((l) => `> ${l}`).join("\n"));
        break;
      }
      case "image": {
        const src = typeof n.attrs?.src === "string" ? imageSrc(n.attrs.src) : null;
        if (src) blocks.push(`![${plain(String(n.attrs?.alt ?? "")).replace(/[[\]]/g, "").trim()}](${src.replace(/[()\s]/g, encodeURIComponent)})`);
        break;
      }
      case "table": {
        // Empty body rows (left over from the 3×3 starter table) are dropped; the header row stays.
        const rows = (n.content ?? []).map((row) => (row.content ?? []).map((cell) => blockText(cell).replace(/\|/g, "/"))).filter((r, i) => i === 0 || r.some(Boolean));
        const cols = Math.max(0, ...rows.map((r) => r.length));
        if (!cols || !rows.some((r) => r.some(Boolean))) break;
        const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] || " ").join(" | ")} |`;
        blocks.push([line(rows[0]), `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n"));
        break;
      }
      default: {
        const text = blockText(n);
        if (text) blocks.push(text);
      }
    }
  }
  return blocks.join("\n\n");
}
