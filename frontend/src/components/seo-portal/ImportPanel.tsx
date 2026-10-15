"use client";

// Imports in the SEO portal: Webflow API (server-side token), CSV or JSON upload, or the live-site
// baseline crawl → a preview of every row (create, draft, skip, conflict, error) → apply. Nothing is
// written before "Apply", existing pages only ever get drafts, redirects are saved switched off
// unless "switch on now" is ticked, and the original file is kept with the import as the migration
// record (Recent imports).

import { useCallback, useEffect, useId, useState } from "react";
import { Upload } from "lucide-react";
import { Chip, Empty, Grid, Panel, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, when, words } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { usePortal } from "@/components/seo-portal/PortalShell";

export type ImportKind = "BLOG_POSTS" | "PAGE_METADATA" | "REDIRECTS";
type Source = "WEBFLOW_API" | "CSV" | "JSON" | "BASELINE";

interface Row {
  ref: string;
  action: string;
  errors?: string[];
  notes?: string[];
  warnings?: string[];
  note?: string;
  // posts
  name?: string | null;
  slug?: string | null;
  path?: string | null;
  state?: string;
  words?: number;
  images?: number;
  titleSource?: string;
  datePublished?: string | null;
  // metadata
  label?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  // redirects
  from?: string | null;
  to?: string | null;
  rawFrom?: string;
  rawTo?: string;
  status?: number;
}

interface Batch {
  id: string;
  kind: string;
  source: string;
  status: string;
  fileName?: string | null;
  createdAt: string;
  appliedAt?: string | null;
  preview?: { rows: Row[]; counts: Record<string, number> };
  counts?: Record<string, number> | null;
  result?: Record<string, unknown> | null;
}

const ACTION_STYLE: Record<string, string> = {
  create: "bg-ocean-50 text-ocean-800",
  "update-draft": "bg-summit-100 text-obsidian-900",
  draft: "bg-summit-100 text-obsidian-900",
  same: "bg-obsidian-100 text-slate-700",
  skip: "bg-obsidian-100 text-slate-700",
  "no-page": "bg-summit-100 text-obsidian-900",
  conflict: "bg-red-50 text-red-800",
  error: "bg-red-50 text-red-800",
};

const ACTION_LABEL: Record<string, string> = {
  create: "Create",
  "update-draft": "Draft on existing",
  draft: "Draft changes",
  same: "Already the same",
  skip: "Skip",
  "no-page": "No page here",
  conflict: "Conflict",
  error: "Can't import",
};

const COPY: Record<ImportKind, { title: string; description: string; sources: { value: Source; label: string }[]; csvHint: string }> = {
  BLOG_POSTS: {
    title: "Import blog posts",
    description: "From the Webflow Blog Posts collection: published posts only, exact slugs at /blog-post/<slug>, original dates, SEO fields copied as they are. Drafts and archived posts are listed but never migrated.",
    sources: [
      { value: "WEBFLOW_API", label: "Webflow API (server token)" },
      { value: "CSV", label: "CSV export from Webflow" },
      { value: "JSON", label: "JSON (Webflow API items)" },
    ],
    csvHint: "Webflow → CMS → Blog Posts → Export. Columns such as Name, Slug, Post Body, Post Summary, Main Image, Thumbnail image, SEO Title, Meta Description, Created On, Updated On, Published On, Draft, Archived are recognised.",
  },
  PAGE_METADATA: {
    title: "Import page metadata",
    description: "Titles, descriptions, canonicals and Open Graph fields for the static pages, copied exactly. They become drafts on each page to review and publish; nothing goes live here.",
    sources: [
      { value: "WEBFLOW_API", label: "Webflow API (server token)" },
      { value: "BASELINE", label: "Live-site baseline crawl" },
      { value: "CSV", label: "CSV" },
      { value: "JSON", label: "JSON" },
    ],
    csvHint: "Columns: url (or path), title, description, canonical, og title, og description, og image.",
  },
  REDIRECTS: {
    title: "Import redirects",
    description: "Webflow's 301 redirects (Site settings → Publishing → 301 redirects). Webflow's API doesn't expose them, so paste or upload them. They are saved switched off; switch them on after review.",
    sources: [
      { value: "CSV", label: "CSV or pasted list" },
      { value: "JSON", label: "JSON" },
    ],
    csvHint: "Two columns, old path then new path (a header row such as from,to is optional). Wildcard rules are flagged: they need a server rule.",
  },
};

export function ImportPanel({ kind }: { kind: ImportKind }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const copy = COPY[kind];
  const [source, setSource] = useState<Source>(copy.sources[0].value);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dateSource, setDateSource] = useState<"created" | "published">("created");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [publish, setPublish] = useState(false);
  const [activate, setActivate] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<Batch[] | null>(null);
  const [webflow, setWebflow] = useState<{ configured: boolean; note: string } | null>(null);
  const canManage = me.seo.manage;

  const loadHistory = useCallback(async () => {
    const [h, w] = await Promise.all([portalApi<{ imports: Batch[] }>("/imports"), portalApi<{ webflow: { configured: boolean; note: string } }>("/webflow")]);
    if (h.ok) setHistory(h.data.imports.filter((b) => b.kind === kind));
    if (w.ok) setWebflow(w.data.webflow);
  }, [kind]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function readFile(file: File) {
    if (file.size > 9_500_000) return setError("That file is larger than about 9 MB. Split it into smaller files.");
    setText(await file.text());
    setFileName(file.name);
    setSource(file.name.toLowerCase().endsWith(".json") ? "JSON" : "CSV");
  }

  async function preview() {
    setError("");
    setBatch(null);
    setConfirmed(false);
    setBusy("preview");
    const res = await portalApi<{ batch: Batch }>("/imports/preview", "POST", {
      kind,
      source,
      ...(source === "CSV" || source === "JSON" ? { text, fileName } : {}),
      ...(kind === "BLOG_POSTS" ? { options: { dateSource } } : {}),
    });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't read that import."));
    setBatch(res.data.batch);
    void loadHistory();
  }

  async function apply() {
    if (!batch) return;
    setBusy("apply");
    const res = await portalApi<{ result: { result: Record<string, unknown> } }>(`/imports/${batch.id}/apply`, "POST", { confirm: true, ...(kind === "BLOG_POSTS" ? { publish } : {}), ...(kind === "REDIRECTS" ? { activate } : {}) });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't apply the import."));
    const r = (res.data.result?.result ?? {}) as { created?: number; drafted?: number; skipped?: number; failed?: unknown[]; activated?: number };
    notify(`Import applied: ${r.created ?? 0} created, ${r.drafted ?? 0} drafted, ${r.skipped ?? 0} skipped, ${r.failed?.length ?? 0} failed${r.activated !== undefined ? `, ${r.activated} switched on` : ""}.`);
    setBatch(null);
    setText("");
    setFileName(null);
    void loadHistory();
  }

  async function discard() {
    if (!batch) return;
    setBusy("discard");
    await portalApi(`/imports/${batch.id}/discard`, "POST", {});
    setBusy(null);
    setBatch(null);
    void loadHistory();
  }

  const rows = batch?.preview?.rows ?? [];
  const counts = batch?.preview?.counts ?? {};
  const actionable = (counts.create ?? 0) + (counts["update-draft"] ?? 0) + (counts.draft ?? 0);

  return (
    <Panel id={`${uid}-import`} title={copy.title} description={copy.description}>
      <div className="space-y-5 px-6 py-6">
        {!canManage && <p className="text-sm text-slate-600">Only an SEO manager or admin can import. You can see past imports below.</p>}
        {canManage && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Dropdown id={`${uid}-source`} label="Source" options={copy.sources} value={source} onChange={(v) => setSource(v as Source)} />
              {kind === "BLOG_POSTS" && (
                <Dropdown
                  id={`${uid}-date`}
                  label="Original publish date"
                  options={[
                    { value: "created", label: "Created On (recommended)", description: "Webflow's Published On is the last re-publish, not the original date." },
                    { value: "published", label: "Published On" },
                  ]}
                  value={dateSource}
                  onChange={(v) => setDateSource(v as "created" | "published")}
                />
              )}
            </div>
            {source === "WEBFLOW_API" && webflow && (
              <p className={`rounded-2xl px-5 py-3 text-sm ${webflow.configured ? "bg-ocean-50 text-ocean-800" : "bg-summit-100 text-obsidian-900"}`}>
                {webflow.configured
                  ? "A Webflow API token is set on the server. The import reads Webflow with it; the token never reaches the browser."
                  : "Not connected: no Webflow API token on the server (WEBFLOW_API_TOKEN). Use a CSV or JSON export instead, or ask an admin to add the token (docs/SEO_PORTAL.md)."}
              </p>
            )}
            {source === "BASELINE" && <p className="text-sm text-slate-600">Uses the latest live-site baseline (Website audit → Baseline): the titles and descriptions the live pages serve today.</p>}
            {(source === "CSV" || source === "JSON") && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{copy.csvHint}</p>
                <label className={`${quietBtn} cursor-pointer`}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Choose a file
                  <input type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
                </label>
                {fileName && <span className="ml-3 text-sm text-slate-700">{fileName}</span>}
                <div>
                  <label htmlFor={`${uid}-text`} className={labelCls}>
                    Or paste it here
                  </label>
                  <textarea id={`${uid}-text`} rows={5} value={text} onChange={(e) => setText(e.target.value)} className={`${field} font-mono text-sm`} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void preview()} disabled={busy !== null || ((source === "CSV" || source === "JSON") && !text.trim()) || (source === "WEBFLOW_API" && webflow?.configured === false)} className={primaryBtn}>
                {busy === "preview" ? "Reading…" : "Preview import"}
              </button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>

      {batch && (
        <div className="border-t border-obsidian-900/[0.06]">
          <div className="flex flex-wrap gap-2 px-6 py-4">
            {Object.entries(counts).map(([k, n]) => (
              <Chip key={k} className={ACTION_STYLE[k] ?? "bg-obsidian-100 text-slate-700"}>
                {ACTION_LABEL[k] ?? words(k)}: {n}
              </Chip>
            ))}
          </div>
          <Grid label="Import preview" head={kind === "REDIRECTS" ? [["Row"], ["From"], ["To"], ["Result"], ["Details"]] : kind === "PAGE_METADATA" ? [["Row"], ["Page"], ["Result"], ["Changes"]] : [["Post"], ["Address"], ["Result"], ["Details"]]} minWidth="min-w-[52rem]">
            {rows.slice(0, 500).map((r, i) => (
              <tr key={`${r.ref}-${i}`} className="align-top">
                {kind === "REDIRECTS" ? (
                  <>
                    <td className="px-6 py-3 text-sm text-slate-600">{r.ref}</td>
                    <td className="px-6 py-3 font-mono text-sm">{r.from ?? r.rawFrom}</td>
                    <td className="px-6 py-3 font-mono text-sm">
                      {r.to ?? r.rawTo} <span className="text-slate-500">({r.status})</span>
                    </td>
                  </>
                ) : kind === "PAGE_METADATA" ? (
                  <>
                    <td className="px-6 py-3 text-sm text-slate-600">{r.ref}</td>
                    <td className="px-6 py-3">
                      <span className="block text-sm text-obsidian-900">{r.label ?? ""}</span>
                      <span className="font-mono text-sm text-slate-600">{r.path}</span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-3">
                      <span className="block text-sm text-obsidian-900">{r.name ?? "(no name)"}</span>
                      <span className="text-sm text-slate-600">
                        {r.state ? words(r.state) : ""}
                        {r.datePublished ? ` · ${r.datePublished.slice(0, 10)}` : ""}
                        {r.words ? ` · ${r.words} words` : ""}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-sm">{r.path ?? "–"}</td>
                  </>
                )}
                <td className="px-6 py-3">
                  <Chip className={ACTION_STYLE[r.action] ?? "bg-obsidian-100 text-slate-700"}>{ACTION_LABEL[r.action] ?? words(r.action)}</Chip>
                </td>
                <td className="px-6 py-3 text-sm text-slate-700">
                  <ul className="space-y-1">
                    {(r.errors ?? []).map((e, j) => (
                      <li key={`e${j}`} className="text-red-700">
                        {e}
                      </li>
                    ))}
                    {(r.warnings ?? []).map((e, j) => (
                      <li key={`w${j}`}>{e}</li>
                    ))}
                    {(r.notes ?? []).slice(0, 4).map((e, j) => (
                      <li key={`n${j}`}>{e}</li>
                    ))}
                    {r.note && <li>{r.note}</li>}
                    {r.changes &&
                      Object.entries(r.changes).map(([k, c]) => (
                        <li key={k} className="break-words">
                          <span className="text-obsidian-900">{k}</span>: {String(c.from ?? "(empty)")} → {String(c.to ?? "(empty)")}
                        </li>
                      ))}
                  </ul>
                </td>
              </tr>
            ))}
          </Grid>
          {rows.length > 500 && <p className="px-6 py-3 text-sm text-slate-600">Showing the first 500 of {rows.length} rows.</p>}
          {canManage && (
            <div className="space-y-4 border-t border-obsidian-900/[0.06] px-6 py-5">
              {kind === "BLOG_POSTS" && (
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
                  <span className="text-base text-obsidian-900">
                    Publish the posts Webflow has published
                    <span className="block text-sm text-slate-600">Otherwise new posts are created as drafts to review first. Existing posts only ever get a draft.</span>
                  </span>
                </label>
              )}
              {kind === "REDIRECTS" && (
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
                  <span className="text-base text-obsidian-900">
                    Switch them on now
                    <span className="block text-sm text-slate-600">Otherwise they are saved off. Switching one off again is the rollback.</span>
                  </span>
                </label>
              )}
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
                <span className="text-base text-obsidian-900">I reviewed this preview</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void apply()} disabled={!confirmed || busy !== null || actionable === 0} className={primaryBtn}>
                  {busy === "apply" ? "Applying…" : `Apply ${actionable} row${actionable === 1 ? "" : "s"}`}
                </button>
                <button type="button" onClick={() => void discard()} disabled={busy !== null} className={quietBtn}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-obsidian-900/[0.06]">
        <h3 className="px-6 pt-5 text-base text-obsidian-900">Recent imports</h3>
        {history === null ? null : history.length === 0 ? (
          <Empty>No imports yet.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {history.slice(0, 10).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                <span>
                  {words(b.source)}
                  {b.fileName ? ` · ${b.fileName}` : ""} · {when(b.createdAt)}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Chip className={b.status === "APPLIED" ? "bg-ocean-50 text-ocean-800" : b.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-obsidian-100 text-slate-700"}>{words(b.status)}</Chip>
                  {b.counts && <span className="text-slate-600">{Object.entries(b.counts).map(([k, n]) => `${ACTION_LABEL[k] ?? k}: ${n}`).join(" · ")}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
