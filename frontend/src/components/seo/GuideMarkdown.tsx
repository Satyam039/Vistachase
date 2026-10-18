// Renders a guide's or blog post's body, written in the SEO editor, as React elements. Only a small
// Markdown subset is understood ("## ", "### " and "#### " headings, paragraphs, "- " and "1. "
// lists, "> " quotes, **strong**, *emphasis*, [links](/path), ![alt](src) images and pipe tables
// ("| a | b |" rows, the first one the header, then "| --- | --- |"); everything else is plain text. No HTML from the
// database is ever injected, so a guide can't carry scripts or styles.

import Link from "next/link";
import type { ReactNode } from "react";

type Block =
  | { kind: "h2" | "h3" | "h4" | "p" | "quote"; text: string }
  | { kind: "img"; src: string; alt: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const isRow = (line: string) => /^\|.*\|$/.test(line);
const isDivider = (line: string) => /^\|(\s*:?-{3,}:?\s*\|)+$/.test(line);
const cells = (line: string) => line.slice(1, -1).split("|").map((c) => c.trim());

export function headingId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

export function parseGuide(body: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    if (list) blocks.push(list);
    para = [];
    list = null;
  };
  const lines = body.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if (isRow(line) && isDivider((lines[i + 1] ?? "").trim())) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      i += 1;
      while (i + 1 < lines.length && isRow(lines[i + 1].trim())) {
        i += 1;
        const row = cells(lines[i].trim());
        rows.push(head.map((_, c) => row[c] ?? ""));
      }
      blocks.push({ kind: "table", head, rows });
    } else if ((m = line.match(/^(#{2,6})\s+(.+)$/))) {
      flush();
      blocks.push({ kind: m[1].length === 2 ? "h2" : m[1].length === 3 ? "h3" : "h4", text: m[2] });
    } else if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
      flush();
      const src = imageSrc(m[2]);
      if (src) blocks.push({ kind: "img", src, alt: m[1] });
    } else if ((m = line.match(/^[-*]\s+(.+)$/)) || (m = line.match(/^\d+[.)]\s+(.+)$/))) {
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (para.length) {
        blocks.push({ kind: "p", text: para.join(" ") });
        para = [];
      }
      if (!list || list.kind !== kind) {
        if (list) blocks.push(list);
        list = { kind, items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush();
      blocks.push({ kind: "quote", text: m[1] });
    } else {
      if (list) {
        blocks.push(list);
        list = null;
      }
      // A "# " heading is treated as h2: the page title is the only h1.
      para.push(line.replace(/^#\s+/, ""));
    }
  }
  flush();
  return blocks;
}

/** Same-site paths, https links, mailto and tel only. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^\/(?!\/)[^\s\\]*$/.test(h)) return h;
  if (/^https:\/\/[^\s\\]+$/i.test(h)) return h;
  if (/^(mailto|tel):[^\s\\]+$/i.test(h)) return h;
  return null;
}

/** Images: site media (/media/…) or https addresses only. */
export function imageSrc(src: string): string | null {
  const s = src.trim();
  if (/^\/media\/[^\s\\]+$/.test(s)) return s;
  if (/^https:\/\/[^\s\\]+$/i.test(s)) return s;
  return null;
}

function BodyImage({ src, alt }: { src: string; alt: string }) {
  // Plain <img>: body images come in any size, so next/image (which needs dimensions) isn't used.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl bg-obsidian-100" />;
}

/** Inline markup: [text](href), **strong**, *em*. */
export function inline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      if (!href) out.push(m[1]);
      else if (href.startsWith("/"))
        out.push(
          <Link key={key} href={href} className="text-ocean-600 underline underline-offset-2 hover:text-obsidian-900">
            {m[1]}
          </Link>,
        );
      else
        out.push(
          <a key={key} href={href} rel="noopener" className="text-ocean-600 underline underline-offset-2 hover:text-obsidian-900">
            {m[1]}
          </a>,
        );
    } else if (m[3] !== undefined) out.push(<strong key={key}>{m[3]}</strong>);
    else out.push(<em key={key}>{m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// "article" is the blog's magazine reading layout (larger type, more air); guides keep "guide".
const STYLES = {
  guide: {
    root: "space-y-4 text-base leading-relaxed text-slate-700",
    h2: "scroll-mt-28 pt-4 text-2xl font-light text-obsidian-900",
    h3: "pt-2 text-lg text-obsidian-900",
    quote: "border-l-2 border-ocean-600 pl-4 text-slate-700",
  },
  article: {
    root: "space-y-6 text-lg font-light leading-[1.8] text-slate-700",
    h2: "scroll-mt-28 pt-8 text-balance text-3xl font-light tracking-tight text-obsidian-900",
    h3: "pt-3 text-xl font-normal text-obsidian-900",
    quote: "border-l-2 border-summit-500 py-1 pl-6 text-2xl font-light leading-snug text-obsidian-900",
  },
} as const;

export function GuideMarkdown({ body, variant = "guide" }: { body: string; variant?: keyof typeof STYLES }) {
  const blocks = parseGuide(body);
  const css = STYLES[variant];
  return (
    <div className={css.root}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2 key={i} id={headingId(b.text)} className={css.h2}>
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className={css.h3}>
                {b.text}
              </h3>
            );
          case "h4":
            return (
              <h4 key={i} className="pt-1 text-base text-obsidian-900">
                {b.text}
              </h4>
            );
          case "img":
            return (
              <figure key={i}>
                <BodyImage src={b.src} alt={b.alt} />
              </figure>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-2xl border border-obsidian-900/[0.08] bg-white">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead className="bg-obsidian-50 text-obsidian-900">
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} scope="col" className="border-b border-obsidian-900/[0.08] px-4 py-3 font-medium">
                          {inline(c, `t${i}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r} className="border-b border-obsidian-900/[0.06] last:border-0">
                        {row.map((c, j) => (
                          <td key={j} className="px-4 py-3 align-top">
                            {inline(c, `t${i}-${r}-${j}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote key={i} className={css.quote}>
                {inline(b.text, `q${i}`)}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Tag = b.kind;
            return (
              <Tag key={i} className={`${b.kind === "ul" ? "list-disc" : "list-decimal"} space-y-1.5 pl-6 marker:text-ocean-600`}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item, `l${i}-${j}`)}</li>
                ))}
              </Tag>
            );
          }
          default:
            return <p key={i}>{inline(b.text, `p${i}`)}</p>;
        }
      })}
    </div>
  );
}
