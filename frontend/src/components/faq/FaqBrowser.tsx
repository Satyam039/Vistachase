"use client";

// Help-centre style FAQ (GetYourGuide / Viator / Expedia help pages): search as you type, topic
// chips, and accordions that open with a height transition. Closed answers are inert.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Sparkles } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
  topic: string;
}

export function FaqBrowser({ items, topics, compact = false }: { items: FaqItem[]; topics: string[]; /** List only: no search, chips or hidden heading. */ compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [open, setOpen] = useState<string | null>(items[0]?.q ?? null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (topic === "All" || i.topic === topic) && (!q || `${i.q} ${i.a}`.toLowerCase().includes(q)));
  }, [items, query, topic]);

  return (
    <div>
      {!compact && <h2 className="sr-only">Questions and answers</h2>}
      <div className={compact ? "hidden" : "mb-8 space-y-5"}>
        <label className="relative block">
          <span className="sr-only">Search questions</span>
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: pickup, cancellation, Moraine Lake…"
            className="h-14 w-full rounded-full border border-obsidian-900/15 bg-white pl-14 pr-5 text-base text-obsidian-900 shadow-[0_12px_30px_-20px_rgba(12,31,33,0.4)] placeholder:text-slate-500 focus:border-ocean-600 focus:outline-none focus:ring-2 focus:ring-ocean-600/30"
          />
        </label>
        <div role="group" aria-label="Filter by topic" className="vc-rail -mx-page flex gap-2 overflow-x-auto px-page">
          {["All", ...topics].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-sm transition-colors ${
                topic === t ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/15 bg-white text-obsidian-900 hover:border-obsidian-900/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">
          {shown.length} {shown.length === 1 ? "answer" : "answers"}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[1.75rem] bg-white p-8 text-center ring-1 ring-obsidian-900/[0.07]">
          <p className="text-lg text-obsidian-900">No answers match &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-base text-slate-600">Ask our AI concierge, or send us a message.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/concierge" className="golden-summit-btn inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Ask the concierge
            </Link>
            <Link href="/contact-us" className="inline-flex h-11 items-center rounded-full border border-obsidian-900/15 px-5 text-sm text-obsidian-900 hover:bg-obsidian-50">
              Contact us
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((item, idx) => {
            const isOpen = open === item.q;
            const id = `faq-${idx}`;
            return (
              <li
                key={item.q}
                className={`rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300 ${
                  isOpen ? "border-ocean-600/40 shadow-[0_18px_40px_-28px_rgba(12,31,33,0.45)]" : "border-obsidian-900/10 hover:border-obsidian-900/25"
                }`}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : item.q)}
                    className="group flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left sm:px-6 sm:py-5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ocean-600"
                  >
                    <span>
                      {item.topic && <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-ocean-700">{item.topic}</span>}
                      <span className="block text-base text-obsidian-900 sm:text-lg">{item.q}</span>
                    </span>
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-300 ${
                        isOpen ? "rotate-45 bg-obsidian-900 text-white" : "bg-obsidian-900/[0.05] text-obsidian-900 group-hover:bg-obsidian-900/10"
                      }`}
                      aria-hidden="true"
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                </h3>
                <div
                  id={id}
                  role="region"
                  aria-label={item.q}
                  inert={!isOpen}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="whitespace-pre-line px-5 pb-5 text-base leading-relaxed text-slate-700 sm:px-6 sm:pb-6">{item.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
