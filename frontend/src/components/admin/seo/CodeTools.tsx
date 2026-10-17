"use client";

// Webflow's code-box helpers for the page editor's JSON-LD and custom code boxes: "Prettify" (lays
// the code out tidily without changing what it does) and "Find" (jumps to each match in the box).
// Both work in the browser only; nothing is saved until the panel's own save button.

import { useState, type RefObject } from "react";
import { ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { quietBtn } from "@/components/admin/seo/shared";

/** JSON laid out with two-space indents; null when it isn't valid JSON. */
export function prettifyJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

const RAW = new Set(["script", "style", "noscript"]);

/**
 * One tag or comment per line. The insides of <script>, <style> and <noscript> are kept exactly
 * (only blank lines around them are trimmed), except JSON-LD, which is laid out like JSON.
 */
export function prettifyHtml(code: string): string {
  const out: string[] = [];
  const token = /<!--[\s\S]*?-->|<(script|style|noscript)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<[^>]+>|[^<]+/gi;
  for (const m of Array.from(code.matchAll(token))) {
    const [whole, tag, attrs, inner] = m;
    if (tag && RAW.has(tag.toLowerCase())) {
      const open = `<${tag}${attrs}>`;
      const close = `</${tag}>`;
      const isJson = /type\s*=\s*["']?application\/ld\+json/i.test(attrs);
      const json = isJson ? prettifyJson(inner) : null;
      const body = json ?? inner.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
      if (!body.trim()) out.push(`${open}${close}`);
      else if (!json && !body.includes("\n") && body.length < 100) out.push(`${open}${body.trim()}${close}`);
      else out.push(open, json ? json.replace(/^/gm, "  ") : body, close);
      continue;
    }
    const text = whole.trim();
    if (text) out.push(text);
  }
  return out.join("\n");
}

/** Prettify button and find field shown above a code box. */
export function CodeToolbar({ id, target, value, onChange, kind }: { id: string; target: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void; kind: "json" | "html" }) {
  const [term, setTerm] = useState("");
  const [at, setAt] = useState(-1);
  const [note, setNote] = useState("");

  const matches: number[] = [];
  if (term) {
    const hay = value.toLowerCase();
    const needle = term.toLowerCase();
    for (let i = hay.indexOf(needle); i !== -1 && matches.length < 1000; i = hay.indexOf(needle, i + needle.length)) matches.push(i);
  }

  const go = (step: 1 | -1) => {
    const el = target.current;
    if (!el || matches.length === 0) return;
    const next = (at + step + matches.length) % matches.length;
    setAt(next);
    el.focus();
    el.setSelectionRange(matches[next], matches[next] + term.length);
    // Bring the match into view: put the caret line near the top of the box.
    const line = value.slice(0, matches[next]).split("\n").length - 1;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, line * lineHeight - lineHeight * 2);
  };

  const prettify = () => {
    if (!value.trim()) return;
    if (kind === "json") {
      const json = prettifyJson(value);
      if (json === null) return setNote("This isn't valid JSON yet, so it can't be tidied. Validate shows what's wrong.");
      onChange(json);
    } else onChange(prettifyHtml(value));
    setNote("Tidied. Nothing is saved until you save.");
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button type="button" onClick={prettify} disabled={!value.trim()} className={`${quietBtn} h-9`}>
        <Wand2 className="h-4 w-4" aria-hidden="true" />
        Prettify
      </button>
      <label htmlFor={`${id}-find`} className="sr-only">
        Find in this code
      </label>
      <input
        id={`${id}-find`}
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setAt(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go(e.shiftKey ? -1 : 1);
          }
        }}
        placeholder="Find"
        className="h-9 w-40 rounded-full border border-obsidian-900/15 bg-white px-4 text-sm text-obsidian-900 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
      />
      {term && (
        <>
          <span className="text-sm text-slate-600" aria-live="polite">
            {matches.length === 0 ? "No matches" : at >= 0 ? `${at + 1} of ${matches.length}` : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
          </span>
          <button type="button" onClick={() => go(-1)} disabled={matches.length === 0} aria-label="Previous match" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-40">
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => go(1)} disabled={matches.length === 0} aria-label="Next match" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-40">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
      <span className={note ? "text-sm text-slate-600" : "sr-only"} aria-live="polite">
        {note}
      </span>
    </div>
  );
}
