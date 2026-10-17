"use client";

// Webflow's "Generate" button for SEO and Open Graph titles and descriptions. Claude reads what the
// editor has on screen (saved or not) and suggests three options; "Use this" puts one in the field,
// and nothing is saved until the editor's own Save. Shown to SEO managers and admins only (the people
// who can change these fields); disabled with a note when the server has no Anthropic API key.

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { errorOf, portalApi } from "@/components/admin/seo/shared";

export type AiField = "seoTitle" | "metaDescription" | "ogTitle" | "ogDescription" | "searchTitle" | "searchDescription";

export interface AiDraft {
  label?: string;
  h1?: string;
  focusKeyword?: string;
  excerpt?: string;
  body?: string;
  seoTitle?: string;
  metaDescription?: string;
}

interface Suggestion {
  text: string;
  length: number;
  fits: boolean;
}

type Access = { show: boolean; configured: boolean };
let access: Promise<Access> | null = null;

/** Who may generate and whether the server is set up, asked once per page load. */
function loadAccess(): Promise<Access> {
  access ??= Promise.all([portalApi<{ seo: { manage: boolean } }>("/me"), portalApi<{ configured: boolean }>("/ai/status")]).then(([me, status]) => ({
    show: me.ok && Boolean(me.data.seo?.manage),
    configured: status.ok && Boolean(status.data.configured),
  }));
  return access;
}

/** Drops empty values and trims long text to what the server accepts. */
function cleanDraft(draft: AiDraft): AiDraft {
  const limits: Record<keyof AiDraft, number> = { label: 200, h1: 200, focusKeyword: 120, excerpt: 2000, body: 100_000, seoTitle: 300, metaDescription: 600 };
  const out: AiDraft = {};
  for (const key of Object.keys(limits) as (keyof AiDraft)[]) {
    const v = draft[key]?.trim();
    if (v) out[key] = v.slice(0, limits[key]);
  }
  return out;
}

export function AiGenerate({ id, pageId, field, label, draft, onUse }: { id: string; pageId: string; field: AiField; label: string; draft: () => AiDraft; onUse: (text: string) => void }) {
  const [state, setState] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<Suggestion[] | null>(null);
  const [used, setUsed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadAccess().then((a) => alive && setState(a));
    return () => {
      alive = false;
    };
  }, []);

  if (!state?.show) return null;

  async function generate() {
    setBusy(true);
    setError("");
    setUsed(null);
    const res = await portalApi<{ suggestions: Suggestion[] }>("/ai/generate", "POST", { pageId, field, draft: cleanDraft(draft()) });
    setBusy(false);
    if (!res.ok) {
      setOptions(null);
      return setError(errorOf(res.data, "Couldn't generate suggestions. Try again."));
    }
    setOptions(res.data.suggestions);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={!state.configured || busy}
        aria-describedby={!state.configured ? `${id}-ai-off` : undefined}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50 disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4 text-ocean-600" aria-hidden="true" />
        {busy ? "Generating…" : options ? "Generate again" : "Generate"}
        <span className="sr-only"> {label}</span>
      </button>
      {!state.configured && (
        <p id={`${id}-ai-off`} className="mt-1.5 text-sm text-slate-600">
          AI Generate needs an Anthropic API key on the server (ANTHROPIC_API_KEY in the backend settings).
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {options && (
        <div className="mt-3 rounded-2xl bg-obsidian-50/70 p-4 ring-1 ring-obsidian-900/[0.06]" aria-live="polite">
          <p className="text-sm text-slate-600">Suggestions from the page&apos;s content. Check the facts, then use one and edit it if needed. Nothing is saved until you save.</p>
          <ul className="mt-2 space-y-2">
            {options.map((o) => (
              <li key={o.text} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-obsidian-900/[0.06]">
                <span className="min-w-0 flex-1 text-base text-obsidian-900">
                  {o.text}
                  <span className={`ml-2 text-sm ${o.fits ? "text-slate-600" : "text-red-700"}`}>
                    {o.length} characters{o.fits ? "" : ", too long"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onUse(o.text);
                    setUsed(o.text);
                  }}
                  className="inline-flex h-9 shrink-0 items-center rounded-full bg-obsidian-900 px-4 text-sm text-white hover:bg-obsidian-800"
                >
                  {used === o.text ? "Used" : "Use this"}
                  <span className="sr-only">: {o.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
