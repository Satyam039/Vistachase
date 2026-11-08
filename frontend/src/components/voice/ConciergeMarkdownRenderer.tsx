"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";

interface ConciergeMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Strips raw internal system artifacts, tool JSON dumps, or thinking leaks if any occur
 */
function cleanRawArtifacts(raw: string): string {
  if (!raw) return "";

  let cleaned = raw
    // Remove thinking tags if present
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    // Remove any raw internal tool JSON dump leaked into text
    .replace(/```(?:json)?\s*\{\s*"(?:status|toolName|result|hold_id|trip_id)"[\s\S]*?\}\s*```/gi, "")
    // Clean up excessive newlines
    .replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

/**
 * Safe link target checker
 */
function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Parses inline formatting: [link](url), **bold**, *italic*, `code`, and bare URLs
 */
function renderInlineMarkup(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex matching: markdown links [text](url), bold **text**, italic *text*, inline code `text`, and bare URLs
  const re =
    /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|(https?:\/\/[^\s<>)"]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${idx++}`;

    if (match[1] !== undefined && match[2] !== undefined) {
      // Markdown link [text](url)
      const label = match[1];
      const href = match[2];
      const external = isExternalHref(href);

      if (external) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-ocean-700 font-medium underline underline-offset-2 hover:text-ocean-900 transition-colors"
          >
            <span>{label}</span>
            <ExternalLink className="h-3 w-3 inline shrink-0 opacity-70" />
          </a>
        );
      } else {
        nodes.push(
          <Link
            key={key}
            href={href}
            className="text-ocean-700 font-medium underline underline-offset-2 hover:text-ocean-900 transition-colors"
          >
            {label}
          </Link>
        );
      }
    } else if (match[3] !== undefined) {
      // Bold **text**
      nodes.push(
        <strong key={key} className="font-semibold text-obsidian-950">
          {match[3]}
        </strong>
      );
    } else if (match[4] !== undefined) {
      // Italic *text*
      nodes.push(
        <em key={key} className="italic text-slate-800">
          {match[4]}
        </em>
      );
    } else if (match[5] !== undefined) {
      // Inline code `text`
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-obsidian-100/90 px-1.5 py-0.5 font-mono text-[13px] text-obsidian-800 font-normal"
        >
          {match[5]}
        </code>
      );
    } else if (match[6] !== undefined) {
      // Bare URL
      const url = match[6];
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-ocean-700 font-medium underline underline-offset-2 hover:text-ocean-900 transition-colors"
        >
          {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 45)}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Interactive Code Block with Copy Button
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-obsidian-900/15 bg-obsidian-950 text-white shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-1.5 text-xs text-white/60">
        <span className="font-mono text-[11px] uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[13px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Pipe Table Renderer
 */
function MarkdownTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-obsidian-900/10 bg-white shadow-xs">
      <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
        <thead className="bg-obsidian-50 text-obsidian-900 border-b border-obsidian-900/10">
          <tr>
            {head.map((col, idx) => (
              <th key={idx} className="px-3.5 py-2.5 font-semibold text-xs tracking-wide">
                {renderInlineMarkup(col, `th-${idx}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-obsidian-900/[0.06]">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-obsidian-50/50 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2.5 text-[13px] text-obsidian-800 align-top">
                  {renderInlineMarkup(cell, `td-${rIdx}-${cIdx}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Main Concierge Markdown Renderer
 */
export function ConciergeMarkdownRenderer({
  content,
  className = "",
}: ConciergeMarkdownRendererProps) {
  const cleanedText = cleanRawArtifacts(content);
  if (!cleanedText) return null;

  // Split into lines for block-level parsing
  const lines = cleanedText.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = "";

  let listItems: string[] = [];
  let isNumberedList = false;

  let tableHead: string[] | null = null;
  let tableRows: string[][] = [];

  const flushList = (keySuffix: number) => {
    if (listItems.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={`ol-${keySuffix}`} className="my-2 space-y-1.5 pl-5 list-decimal marker:text-amber-600 marker:font-medium text-[15px] leading-relaxed text-obsidian-900">
            {listItems.map((item, idx) => (
              <li key={idx} className="pl-1">
                {renderInlineMarkup(item, `ol-item-${keySuffix}-${idx}`)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${keySuffix}`} className="my-2 space-y-1.5 pl-4 text-[15px] leading-relaxed text-obsidian-900">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                <span className="flex-1">{renderInlineMarkup(item, `ul-item-${keySuffix}-${idx}`)}</span>
              </li>
            ))}
          </ul>
        );
      }
      listItems = [];
      isNumberedList = false;
    }
  };

  const flushTable = (keySuffix: number) => {
    if (tableHead) {
      elements.push(
        <MarkdownTable key={`table-${keySuffix}`} head={tableHead} rows={tableRows} />
      );
      tableHead = null;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Code block toggles ```
    if (line.startsWith("```")) {
      flushList(i);
      flushTable(i);
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            code={codeBuffer.join("\n")}
            language={codeLanguage}
          />
        );
        codeBuffer = [];
        codeLanguage = "";
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // 2. Empty lines flush lists and tables
    if (!line) {
      flushList(i);
      flushTable(i);
      continue;
    }

    // 3. Pipe table lines
    if (line.startsWith("|") && line.endsWith("|")) {
      flushList(i);
      // Divider line check
      if (/^\|(?:\s*:?-+:?\s*\|)+$/.test(line)) {
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!tableHead) {
        tableHead = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable(i);
    }

    // 4. Heading lines
    const h3Match = line.match(/^###\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h1Match = line.match(/^#\s+(.+)$/);

    if (h3Match || h2Match || h1Match) {
      flushList(i);
      const titleText = (h3Match || h2Match || h1Match)![1];
      const isMajor = Boolean(h1Match || h2Match);

      elements.push(
        <div key={`h-${i}`} className={`mt-3 mb-1.5 ${isMajor ? "pt-1" : ""}`}>
          <h4
            className={`font-semibold tracking-tight text-obsidian-950 ${
              isMajor ? "text-base sm:text-lg" : "text-[15px]"
            } flex items-center gap-2`}
          >
            <span className="w-1.5 h-3.5 bg-amber-500 rounded-xs shrink-0" aria-hidden="true"></span>
            <span>{renderInlineMarkup(titleText, `htext-${i}`)}</span>
          </h4>
        </div>
      );
      continue;
    }

    // 5. Blockquote lines (> text)
    if (line.startsWith(">")) {
      flushList(i);
      const quoteText = line.replace(/^>\s?/, "");
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 border-l-2 border-amber-500 bg-amber-50/50 pl-3.5 py-1.5 text-[14px] italic text-slate-800 rounded-r-lg"
        >
          {renderInlineMarkup(quoteText, `quote-text-${i}`)}
        </blockquote>
      );
      continue;
    }

    // 6. List lines (- item, * item, • item, or 1. item)
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const numberMatch = line.match(/^(\d+)[.)]\s+(.+)$/);

    if (bulletMatch) {
      if (isNumberedList) flushList(i);
      isNumberedList = false;
      listItems.push(bulletMatch[1]);
      continue;
    }

    if (numberMatch) {
      if (!isNumberedList && listItems.length > 0) flushList(i);
      isNumberedList = true;
      listItems.push(numberMatch[2]);
      continue;
    }

    // 7. Regular paragraph
    flushList(i);
    elements.push(
      <p
        key={`p-${i}`}
        className="my-1.5 text-[15px] leading-relaxed text-obsidian-900 break-words"
      >
        {renderInlineMarkup(line, `p-text-${i}`)}
      </p>
    );
  }

  // Final flush
  flushList(lines.length);
  flushTable(lines.length);

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-final"
        code={codeBuffer.join("\n")}
        language={codeLanguage}
      />
    );
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}
