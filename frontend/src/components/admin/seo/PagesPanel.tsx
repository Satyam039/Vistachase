"use client";

// SEO pages: every public page, tour, destination and guide with its title, focus keyword,
// completeness and open issues. Opens the page editor; creates new guide drafts.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, STATUS_STYLE, errorOf, field, labelCls, primaryBtn, quietBtn, seoApi, when, words, type PageRow } from "@/components/admin/seo/shared";

const TYPES = ["HOME", "TOUR", "DESTINATION", "LANDING", "GUIDE", "STATIC", "LEGAL"];
const STATUSES = ["PUBLISHED", "DRAFT", "SCHEDULED", "ARCHIVED"];
const MISSING = [
  ["title", "Title"],
  ["description", "Meta description"],
  ["h1", "H1"],
  ["canonical", "Canonical"],
  ["focusKeyword", "Focus keyword"],
] as const;

export function PagesPanel({ notify }: { notify: (m: string) => void }) {
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [pageType, setPageType] = useState("");
  const [status, setStatus] = useState("");
  const [missing, setMissing] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (pageType) params.set("pageType", pageType);
    if (status) params.set("status", status);
    if (missing) params.set("missing", missing);
    const res = await seoApi<{ pages: PageRow[] }>(`/pages?${params}`);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load pages."));
    setError("");
    setPages(res.data.pages);
  }, [q, pageType, status, missing]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function sync() {
    setBusy(true);
    const res = await seoApi<{ result: { added: number } }>("/pages/sync", "POST", {});
    setBusy(false);
    notify(res.ok ? `Pages synced: ${res.data.result?.added ?? 0} new. Existing pages were not changed.` : errorOf(res.data, "Couldn't sync pages."));
    await load();
  }

  return (
    <Panel
      id="seo-pages"
      title="Pages"
      description="Overrides apply on the live site only while a page is published; empty fields keep the page's own title and description."
      actions={
        <>
          <button type="button" className={quietBtn} onClick={sync} disabled={busy}>
            {busy ? "Syncing…" : "Sync pages"}
          </button>
          <button type="button" className={primaryBtn} aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
            {adding ? "Close" : "New guide"}
          </button>
        </>
      }
    >
      {adding && <NewGuideForm notify={notify} onCreated={(id) => router.push(`/admin/seo/pages/${id}`)} />}

      <div className="grid gap-3 border-b border-obsidian-900/[0.06] px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="seo-pages-q" className={labelCls}>
            Search
          </label>
          <input id="seo-pages-q" type="search" className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Path, name or keyword" />
        </div>
        <Dropdown id="seo-pages-type" label="Type" value={pageType} onChange={setPageType} options={[{ value: "", label: "All types" }, ...TYPES.map((t) => ({ value: t, label: words(t) }))]} />
        <Dropdown id="seo-pages-status" label="Status" value={status} onChange={setStatus} options={[{ value: "", label: "Any status" }, ...STATUSES.map((t) => ({ value: t, label: words(t) }))]} />
        <Dropdown id="seo-pages-missing" label="Missing" value={missing} onChange={setMissing} options={[{ value: "", label: "Anything" }, ...MISSING.map(([v, l]) => ({ value: v, label: l }))]} />
      </div>

      {error && (
        <p role="alert" className="mx-6 my-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {!pages ? (
        <Loading />
      ) : pages.length === 0 ? (
        <Empty>No pages match. If this is a new install, use Sync pages or Load starter data on the overview.</Empty>
      ) : (
        <Grid label="SEO pages" minWidth="min-w-[64rem]" head={[["Page"], ["Type"], ["Status"], ["Title"], ["Focus keyword"], ["Complete", true], ["Issues", true], ["Last audit"], [""]]}>
          {pages.map((p) => (
            <tr key={p.id} className="align-top hover:bg-obsidian-50/60">
              <td className="px-6 py-4">
                <span className="block text-obsidian-900">
                  {p.label}
                  {p.important && <span className="ml-2 text-sm text-slate-600">· key page</span>}
                </span>
                <span className="block font-mono text-sm text-slate-600">{p.path}</span>
              </td>
              <td className="px-6 py-4 text-sm">{words(p.pageType)}</td>
              <td className="px-6 py-4">
                <Chip className={STATUS_STYLE[p.status]}>{words(p.status)}</Chip>
                {!p.robotsIndex && <Chip className="ml-1 bg-red-50 text-red-800">Noindex</Chip>}
                {p.status === "SCHEDULED" && p.publishAt && <span className="mt-1 block text-sm text-slate-600">{when(p.publishAt)}</span>}
              </td>
              <td className="max-w-[18rem] px-6 py-4 text-sm">
                {p.title ? (
                  <>
                    <span className="block text-obsidian-900">{p.title}</span>
                    <span className="block text-slate-600">
                      {p.titleFromOverride ? "Override" : "Live page"} · {p.title.length} chars
                    </span>
                  </>
                ) : (
                  <span className="text-slate-600">{p.lastCrawledAt ? "Missing" : "Not audited yet"}</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm">{p.focusKeyword ?? <span className="text-slate-600">–</span>}</td>
              <td className="px-6 py-4 text-right tabular-nums">{p.completeness}%</td>
              <td className="px-6 py-4 text-right text-sm tabular-nums">
                {p.openIssues}
                {p.errors > 0 && <span className="block text-red-700">{p.errors} blocking</span>}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {p.lastCrawledAt ? when(p.lastCrawledAt) : "Never"}
                {p.liveStatus && p.liveStatus !== 200 && <span className="block text-red-700">HTTP {p.liveStatus}</span>}
              </td>
              <td className="px-6 py-4 text-right">
                <Link href={`/admin/seo/pages/${p.id}`} className="inline-flex h-10 items-center rounded-full border border-obsidian-900/10 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
                  Edit <span className="sr-only">{p.label}</span>
                </Link>
              </td>
            </tr>
          ))}
        </Grid>
      )}
    </Panel>
  );
}

function NewGuideForm({ notify, onCreated }: { notify: (m: string) => void; onCreated: (id: string) => void }) {
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [focusKeyword, setFocusKeyword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const auto = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await seoApi<{ page: { id: string } }>("/pages", "POST", { label, slug, ...(focusKeyword.trim() ? { focusKeyword } : {}) });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't create the guide."));
    notify(`Draft guide "${label}" created. It stays hidden until you publish it.`);
    onCreated(res.data.page.id);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-b border-obsidian-900/[0.06] bg-obsidian-50/60 px-6 py-5 sm:grid-cols-3">
      <div>
        <label htmlFor="ng-label" className={labelCls}>
          Guide name
        </label>
        <input
          id="ng-label"
          required
          minLength={2}
          maxLength={120}
          className={field}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (!slugEdited) setSlug(auto(e.target.value));
          }}
        />
      </div>
      <div>
        <label htmlFor="ng-slug" className={labelCls}>
          Address: /guides/…
        </label>
        <input
          id="ng-slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={80}
          className={field}
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(e.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor="ng-kw" className={labelCls}>
          Focus keyword (optional)
        </label>
        <input id="ng-kw" maxLength={120} className={field} value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-3">
          {error}
        </p>
      )}
      <div className="sm:col-span-3">
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? "Creating…" : "Create draft"}
        </button>
      </div>
    </form>
  );
}
