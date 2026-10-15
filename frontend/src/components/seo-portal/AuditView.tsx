"use client";

// Website audit: the existing audit and issues panel, a comparison of two audit runs, and the
// live-site baseline (the Webflow site's URLs and metadata before the move) compared with the new
// site, URL by URL.

import { useCallback, useEffect, useId, useState } from "react";
import { Upload } from "lucide-react";
import { AuditPanel } from "@/components/admin/seo/AuditPanel";
import { Chip, Empty, Grid, Panel, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, seoApi, when, words } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

interface Run {
  id: string;
  status: string;
  startedAt: string;
  summary: { issues?: number };
}

interface Comparison {
  from: { startedAt: string; total: number };
  to: { startedAt: string; total: number };
  added: { type: string; severity: string; path: string | null }[];
  fixed: { type: string; severity: string; path: string | null }[];
  unchanged: number;
  byType: { type: string; before: number; after: number }[];
}

function CompareRuns() {
  const uid = useId();
  const [runs, setRuns] = useState<Run[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    seoApi<{ audits: Run[] }>("/audits").then((r) => {
      if (!r.ok) return;
      const done = r.data.audits.filter((a) => a.status === "COMPLETED");
      setRuns(done);
      if (done.length >= 2) {
        setTo(done[0].id);
        setFrom(done[1].id);
      }
    });
  }, []);

  async function compare() {
    setError("");
    setResult(null);
    const res = await portalApi<{ comparison: Comparison }>(`/audits/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) setResult(res.data.comparison);
    else setError(errorOf(res.data, "Couldn't compare these audits."));
  }

  const options = runs.map((r) => ({ value: r.id, label: `${when(r.startedAt)} · ${r.summary.issues ?? 0} issues` }));
  return (
    <Panel id={`${uid}-compare`} title="Compare audits" description="What changed between two audit runs: new problems, fixed ones, and counts by type.">
      <div className="space-y-4 px-6 py-6">
        {runs.length < 2 ? (
          <p className="text-sm text-slate-600">Run at least two audits to compare them.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Dropdown id={`${uid}-from`} label="Earlier run" options={options} value={from} onChange={setFrom} />
            <Dropdown id={`${uid}-to`} label="Later run" options={options} value={to} onChange={setTo} />
            <button type="button" onClick={() => void compare()} disabled={!from || !to || from === to} className={primaryBtn}>
              Compare
            </button>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {result && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              {result.from.total} findings on {when(result.from.startedAt)} → {result.to.total} on {when(result.to.startedAt)}: {result.added.length} new, {result.fixed.length} fixed, {result.unchanged} unchanged.
            </p>
            <Grid label="Findings by type" head={[["Type"], ["Before", true], ["After", true], ["Change", true]]} minWidth="min-w-[30rem]">
              {result.byType.map((t) => (
                <tr key={t.type}>
                  <td className="px-6 py-2 text-sm">{words(t.type)}</td>
                  <td className="px-6 py-2 text-right text-sm tabular-nums">{t.before}</td>
                  <td className="px-6 py-2 text-right text-sm tabular-nums">{t.after}</td>
                  <td className={`px-6 py-2 text-right text-sm tabular-nums ${t.after > t.before ? "text-red-700" : t.after < t.before ? "text-ocean-700" : ""}`}>
                    {t.after - t.before > 0 ? `+${t.after - t.before}` : t.after - t.before}
                  </td>
                </tr>
              ))}
            </Grid>
            {result.added.length > 0 && (
              <details className="rounded-xl border border-obsidian-900/10 p-4">
                <summary className="cursor-pointer text-sm text-obsidian-900">New findings ({result.added.length})</summary>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {result.added.slice(0, 200).map((a, i) => (
                    <li key={i}>
                      {words(a.type)} · {a.path ?? "site-wide"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

interface BaselineRun {
  id: string;
  source: string;
  status: string;
  fileName: string | null;
  sitemapUrl: string | null;
  createdAt: string;
  preview: { done?: number; total?: number };
  result: { urls?: number; error?: string } | null;
}

interface CompareRow {
  path: string;
  oldStatus: number | null;
  oldTitle: string | null;
  newStatus: number | null;
  state: string;
  differences: string[];
  pageId: string | null;
  redirect: { to: string; active: boolean } | null;
}

const STATE_LABEL: Record<string, [string, string]> = {
  same: ["Same", "bg-ocean-50 text-ocean-800"],
  differs: ["Metadata differs", "bg-summit-100 text-obsidian-900"],
  missing: ["Missing on new site", "bg-red-50 text-red-800"],
  served: ["Served by the new site", "bg-ocean-50 text-ocean-800"],
  redirected: ["Redirected", "bg-ocean-50 text-ocean-800"],
  "redirect-off": ["Redirect saved, off", "bg-summit-100 text-obsidian-900"],
  unpublished: ["Post not published yet", "bg-summit-100 text-obsidian-900"],
  "old-redirect": ["Redirect on old site", "bg-obsidian-100 text-slate-700"],
  "old-error": ["Error on old site", "bg-obsidian-100 text-slate-700"],
};

function Baseline() {
  const { me, notify } = usePortal();
  const uid = useId();
  const [runs, setRuns] = useState<BaselineRun[] | null>(null);
  const [sitemapUrl, setSitemapUrl] = useState("https://www.vistachase.com/sitemap.xml");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState<{ rows: CompareRow[]; counts: Record<string, number> } | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const r = await portalApi<{ runs: BaselineRun[] }>("/baseline");
    if (r.ok) setRuns(r.data.runs);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While a crawl runs, refresh its progress.
  useEffect(() => {
    if (!runs?.some((r) => r.status === "RUNNING")) return;
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [runs, load]);

  async function crawl() {
    setError("");
    setBusy("crawl");
    const res = await portalApi("/baseline/crawl", "POST", { sitemapUrl });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't start the crawl."));
    notify("Crawl started. It reads each URL politely (two at a time), so it can take a few minutes.");
    void load();
  }

  async function upload(file: File) {
    setError("");
    setBusy("upload");
    const res = await portalApi("/baseline/upload", "POST", { csv: await file.text(), fileName: file.name });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't read that crawl file."));
    notify("Crawl file saved as a baseline.");
    void load();
  }

  async function runCompare(check: boolean) {
    setBusy("compare");
    const res = await portalApi<{ rows: CompareRow[]; counts: Record<string, number> }>(`/baseline/compare${check ? "?check=true" : ""}`);
    setBusy(null);
    if (res.ok) setCompare(res.data);
    else setError(errorOf(res.data, "Couldn't compare."));
  }

  const rows = (compare?.rows ?? []).filter((r) => !filter || r.state === filter);

  return (
    <Panel
      id={`${uid}-baseline`}
      title="Live-site baseline"
      description="Capture the Webflow site's URLs, titles, descriptions, canonicals and H1s before the move, then compare them with the new site URL by URL. Nothing on either site is changed."
    >
      <div className="space-y-5 px-6 py-6">
        {me.seo.manage && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-sitemap`} className={labelCls}>
                Crawl the live sitemap
              </label>
              <div className="flex flex-wrap gap-2">
                <input id={`${uid}-sitemap`} value={sitemapUrl} onChange={(e) => setSitemapUrl(e.target.value)} className={`${field} min-w-0 flex-1 font-mono text-sm`} />
                <button type="button" onClick={() => void crawl()} disabled={busy !== null} className={primaryBtn}>
                  {busy === "crawl" ? "Starting…" : "Crawl"}
                </button>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">Only vistachase.com addresses (SEO_BASELINE_HOSTS on the server). Up to 1,000 URLs.</p>
            </div>
            <div>
              <p className={labelCls}>Or upload a crawl export</p>
              <label className={`${quietBtn} cursor-pointer`}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                {busy === "upload" ? "Uploading…" : "Upload CSV (Screaming Frog or similar)"}
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              </label>
              <p className="mt-1.5 text-sm text-slate-600">Columns: Address, Status Code, Title 1, Meta Description 1, Canonical Link Element 1, H1-1.</p>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {runs && runs.length > 0 && (
          <ul className="divide-y divide-obsidian-900/[0.06] rounded-xl border border-obsidian-900/[0.08]">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  {r.source === "CRAWL" ? r.sitemapUrl ?? "Crawl" : r.fileName ?? "Upload"} · {when(r.createdAt)}
                </span>
                <span className="flex items-center gap-2">
                  {r.status === "RUNNING" && (
                    <span className="text-slate-600">
                      {r.preview.done ?? 0}/{r.preview.total ?? "?"}
                    </span>
                  )}
                  {r.result?.urls != null && <span className="text-slate-600">{r.result.urls} URLs</span>}
                  {r.result?.error && <span className="text-red-700">{r.result.error}</span>}
                  <Chip className={r.status === "APPLIED" ? "bg-ocean-50 text-ocean-800" : r.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-obsidian-100 text-slate-700"}>{r.status === "APPLIED" ? "Ready" : words(r.status)}</Chip>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void runCompare(false)} disabled={busy !== null || !runs?.some((r) => r.status === "APPLIED")} className={quietBtn}>
            {busy === "compare" ? "Comparing…" : "Compare with the new site"}
          </button>
          <button type="button" onClick={() => void runCompare(true)} disabled={busy !== null || !runs?.some((r) => r.status === "APPLIED")} className={quietBtn}>
            Compare and check missing URLs live
          </button>
        </div>
      </div>
      {compare && (
        <div className="border-t border-obsidian-900/[0.06]">
          <div className="flex flex-wrap gap-2 px-6 py-4">
            <button type="button" onClick={() => setFilter("")} className={`rounded-full px-3 py-1 text-sm ${filter === "" ? "bg-obsidian-900 text-white" : "bg-obsidian-100 text-slate-700"}`}>
              All {compare.rows.length}
            </button>
            {Object.entries(compare.counts).map(([k, n]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-sm ${filter === k ? "bg-obsidian-900 text-white" : (STATE_LABEL[k]?.[1] ?? "bg-obsidian-100 text-slate-700")}`}>
                {STATE_LABEL[k]?.[0] ?? words(k)} {n}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <Empty>No URLs in this group.</Empty>
          ) : (
            <Grid label="Baseline comparison" head={[["Old URL"], ["Old title"], ["Result"], ["Details"]]} minWidth="min-w-[52rem]">
              {rows.slice(0, 1000).map((r) => (
                <tr key={r.path} className="align-top">
                  <td className="px-6 py-3 font-mono text-sm">{r.path}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{r.oldTitle ?? "–"}</td>
                  <td className="px-6 py-3">
                    <Chip className={STATE_LABEL[r.state]?.[1] ?? "bg-obsidian-100 text-slate-700"}>{STATE_LABEL[r.state]?.[0] ?? words(r.state)}</Chip>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700">
                    {r.differences.length > 0 && <span>{r.differences.join(", ")}</span>}
                    {r.redirect && (
                      <span className="block">
                        → {r.redirect.to} {r.redirect.active ? "" : "(off)"}
                      </span>
                    )}
                    {r.newStatus !== null && <span className="block">New site: HTTP {r.newStatus || "no answer"}</span>}
                  </td>
                </tr>
              ))}
            </Grid>
          )}
        </div>
      )}
    </Panel>
  );
}

export function AuditView() {
  const { notify } = usePortal();
  return (
    <div className="space-y-6">
      <PortalHeading title="Website audit" intro="Crawls this site's pages for missing or duplicate metadata, broken links and images, alt text, structured data, Webflow image links and page weight. Issues stay open until an audit no longer finds them." />
      <AuditPanel notify={notify} />
      <CompareRuns />
      <Baseline />
    </div>
  );
}
