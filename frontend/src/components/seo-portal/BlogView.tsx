"use client";

// Blog SEO: every post at /blog-post/<slug> with its checks (title, description, headings, alt
// text, Webflow images, internal links, dates, sitemap, BlogPosting schema), the Webflow import,
// and "new post". Posts open in the blog post editor (BlogPostEditor.tsx). The list works like
// Webflow's collection list: filters (status, draft changes, indexing, featured, published / created
// / modified in the last day, week or month), sortable columns, 25 posts a page and a CSV export of
// the filtered list. "Select" (managers) ticks posts for bulk publish, unpublish, archive, feature
// or unfeature; each post still goes through its own checks, and there is no bulk delete.

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CheckSquare, Download, Plus, SlidersHorizontal } from "lucide-react";
import { Chip, Empty, Loading, dangerBtn, Panel, STATUS_STYLE, Stat, day, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, words, type PublishStatus } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";
import { ImportPanel } from "@/components/seo-portal/ImportPanel";
import { WebflowSyncPanel } from "@/components/seo-portal/WebflowSyncPanel";

interface Post {
  id: string;
  path: string;
  slug: string;
  label: string;
  status: PublishStatus;
  featured: boolean;
  featuredImage: string | null;
  thumbnailImage: string | null;
  ogImage: string | null;
  keywords: number;
  importSource: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  datePublished: string | null;
  dateModified: string | null;
  createdAt: string;
  indexed: boolean;
  words: number;
  headings: { h2: number; h3: number; h4: number; problems: string[] };
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  linksViaRedirect: string[];
  linksUnknown: string[];
  inSitemap: boolean;
  blogPosting: boolean | null;
  hasDraft: boolean;
  blocking: number;
  openIssues: number;
  problems: string[];
}

interface Summary {
  total: number;
  expected: number;
  published: number;
  drafts: number;
  imported: number;
  noTitle: number;
  noDescription: number;
  headingProblems: number;
  altText: number;
  webflowImages: number;
  linksViaRedirect: number;
  linksUnknown: number;
  withDraftChanges: number;
}

const PROBLEMS: { value: string; label: string }[] = [
  { value: "", label: "All posts" },
  { value: "no-title", label: "No SEO title" },
  { value: "no-description", label: "No meta description" },
  { value: "headings", label: "Heading structure" },
  { value: "no-featured-image", label: "No featured image" },
  { value: "alt-text", label: "Images without alt text" },
  { value: "webflow-images", label: "Images still on Webflow" },
  { value: "links-redirect", label: "Links through a redirect" },
  { value: "links-unknown", label: "Links to unknown pages" },
  { value: "no-date", label: "No publish date" },
  { value: "not-in-sitemap", label: "Not in sitemap" },
  { value: "draft-changes", label: "Draft changes waiting" },
];
const PROBLEM_LABEL = Object.fromEntries(PROBLEMS.map((p) => [p.value, p.label]));

type Sort = "name" | "published" | "created" | "modified" | "status";
interface Filters {
  status: string;
  changes: string;
  indexing: string;
  featured: string;
  published: string;
  created: string;
  modified: string;
}
const NO_FILTERS: Filters = { status: "", changes: "", indexing: "", featured: "", published: "", created: "", modified: "" };
const PAGE_SIZE = 25;
const WINDOWS = [
  { value: "", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];
const FILTER_FIELDS: { key: keyof Filters; label: string; options: { value: string; label: string }[] }[] = [
  { key: "status", label: "Status", options: [{ value: "", label: "Any status" }, { value: "PUBLISHED", label: "Published" }, { value: "DRAFT", label: "Draft" }, { value: "SCHEDULED", label: "Scheduled" }, { value: "ARCHIVED", label: "Archived" }] },
  { key: "changes", label: "Changes", options: [{ value: "", label: "Any" }, { value: "draft", label: "Changes in draft" }] },
  { key: "indexing", label: "Sitemap indexing", options: [{ value: "", label: "Any" }, { value: "yes", label: "Indexed" }, { value: "no", label: "Not indexed" }] },
  { key: "featured", label: "Featured", options: [{ value: "", label: "Any" }, { value: "yes", label: "Featured" }, { value: "no", label: "Not featured" }] },
  { key: "published", label: "Published", options: WINDOWS },
  { key: "created", label: "Created", options: WINDOWS },
  { key: "modified", label: "Modified", options: WINDOWS },
];

type BulkAction = "publish" | "unpublish" | "archive" | "feature" | "unfeature";
const BULK: { action: BulkAction; label: string; done: string }[] = [
  { action: "publish", label: "Publish", done: "published" },
  { action: "unpublish", label: "Unpublish", done: "moved to draft" },
  { action: "feature", label: "Feature", done: "featured" },
  { action: "unfeature", label: "Unfeature", done: "unfeatured" },
  { action: "archive", label: "Archive", done: "archived" },
];
interface BulkReply {
  results: { id: string; label: string | null; ok: boolean; skipped?: boolean; error?: string }[];
  done: number;
  skipped: number;
  failed: number;
}

function SortHeader({ label, value, sort, dir, onSort }: { label: string; value: Sort; sort: Sort; dir: "asc" | "desc"; onSort: (s: Sort) => void }) {
  const active = sort === value;
  const Icon = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => onSort(value)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-obsidian-900" aria-label={`Sort by ${label.toLowerCase()}${active ? (dir === "asc" ? ", now ascending" : ", now descending") : ""}`}>
      {label}
      {active && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

export function BlogView() {
  const { me } = usePortal();
  const uid = useId();
  const [data, setData] = useState<{ posts: Post[]; matching: number; summary: Summary } | null>(null);
  const [problem, setProblem] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>("published");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<BulkAction | null>(null);
  const [bulkNote, setBulkNote] = useState<{ text: string; failures: string[] } | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (problem) params.set("problem", problem);
    if (q.trim()) params.set("q", q.trim());
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    params.set("sort", sort);
    params.set("dir", dir);
    return params;
  }, [problem, q, filters, sort, dir]);
  const queryKey = query.toString();

  // Any change to the filters or sort starts again at page 1.
  useEffect(() => setPage(1), [queryKey]);

  const load = useCallback(async () => {
    const params = new URLSearchParams(queryKey);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    const res = await portalApi<{ posts: Post[]; matching: number; summary: Summary }>(`/blog?${params}`);
    if (res.ok) setData(res.data);
  }, [queryKey, page]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const pages = data ? Math.max(1, Math.ceil(data.matching / PAGE_SIZE)) : 1;
  const onSort = (value: Sort) => {
    if (value === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(value);
      setDir(value === "name" || value === "status" ? "asc" : "desc");
    }
  };

  const toggle = (postId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  const pageIds = data?.posts.map((p) => p.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((x) => selected.has(x));
  const someOnPage = pageIds.some((x) => selected.has(x));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const x of pageIds) {
        if (allOnPage) next.delete(x);
        else next.add(x);
      }
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const runBulk = async (action: BulkAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const meta = BULK.find((b) => b.action === action)!;
    if ((action === "archive" || action === "unpublish") && !window.confirm(`${meta.label} ${ids.length} ${ids.length === 1 ? "post" : "posts"}? ${action === "archive" ? "Archived posts leave the site." : "Unpublished posts leave the site until published again."}`)) return;
    setBusy(action);
    setBulkNote(null);
    const res = await portalApi<BulkReply>("/blog/bulk", "POST", { ids, action });
    setBusy(null);
    if (!res.ok) {
      setBulkNote({ text: errorOf(res.data, "That didn't work. Try again."), failures: [] });
      return;
    }
    const r = res.data;
    const parts = [`${r.done} ${r.done === 1 ? "post" : "posts"} ${meta.done}`];
    if (r.skipped) parts.push(`${r.skipped} already ${meta.done}`);
    if (r.failed) parts.push(`${r.failed} couldn't be changed`);
    setBulkNote({ text: `${parts.join(", ")}.`, failures: r.results.filter((x) => !x.ok).map((x) => `${x.label ?? "Unknown post"}: ${x.error}`) });
    // Keep the ones that failed ticked so they can be fixed and tried again.
    setSelected(new Set(r.results.filter((x) => !x.ok).map((x) => x.id)));
    void load();
  };

  const s = data?.summary;
  return (
    <div className="space-y-6">
      <PortalHeading
        title="Blog SEO"
        actions={
          me.seo.manage && (
            <Link href="/seo/blog/new" className={primaryBtn}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New blog post
            </Link>
          )
        }
        intro={
          <>
            Blog posts live at /blog-post/&lt;address&gt; and are listed on <Link href="/blog" className="text-ocean-700 underline underline-offset-2">/blog</Link>. Open a post to write it (title, address, meta title and description, keywords, featured image and the content with images, links and tables) and publish it. Changing a published post&apos;s address redirects the old one. The BlogPosting column reads the last audit.
          </>
        }
      />
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Posts here" value={`${s.total}/${s.expected}`} hint={`${s.published} published · ${s.drafts} drafts · ${s.imported} imported`} />
          <Stat label="Missing title or description" value={s.noTitle + s.noDescription} hint={`${s.noTitle} titles · ${s.noDescription} descriptions`} tone={s.noTitle + s.noDescription ? "warn" : "good"} />
          <Stat label="Image problems" value={s.altText + s.webflowImages} hint={`${s.altText} alt text · ${s.webflowImages} on Webflow's CDN`} tone={s.altText + s.webflowImages ? "warn" : "good"} />
          <Stat label="Link problems" value={s.linksViaRedirect + s.linksUnknown} hint={`${s.linksViaRedirect} via redirect · ${s.linksUnknown} unknown`} tone={s.linksViaRedirect + s.linksUnknown ? "warn" : "good"} />
        </div>
      )}
      <Panel
        id={`${uid}-posts`}
        title="Posts"
        actions={
          <>
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls={`${uid}-filters`} className={quietBtn}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filter{activeFilters ? ` (${activeFilters})` : ""}
            </button>
            {me.seo.manage && (
              <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting} className={quietBtn}>
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
                {selecting ? "Done selecting" : "Select"}
              </button>
            )}
            <a href={`/api/seo/portal/blog/export.csv?${queryKey}`} className={quietBtn}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
            {me.seo.manage && (
              <Link href="/seo/blog/new" className={quietBtn}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New post
              </Link>
            )}
          </>
        }
      >
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-q`} className={labelCls}>
              Search
            </label>
            <input id={`${uid}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, address or SEO title" className={field} />
          </div>
          <Dropdown id={`${uid}-problem`} label="Show" options={PROBLEMS} value={problem} onChange={setProblem} />
        </div>
        {showFilters && (
          <div id={`${uid}-filters`} className="border-t border-obsidian-900/[0.06] bg-obsidian-50/60 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FILTER_FIELDS.map((ff) => (
                <Dropdown key={ff.key} id={`${uid}-f-${ff.key}`} label={ff.label} options={ff.options} value={filters[ff.key]} onChange={(v) => setFilters((prev) => ({ ...prev, [ff.key]: v }))} />
              ))}
            </div>
            {activeFilters > 0 && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className={`${quietBtn} mt-4`}>
                Clear filters
              </button>
            )}
          </div>
        )}
        {data && (
          <p className="border-t border-obsidian-900/[0.06] px-6 py-3 text-sm text-slate-600" aria-live="polite">
            {data.matching} {data.matching === 1 ? "post" : "posts"}
            {data.matching !== data.summary.total ? ` of ${data.summary.total}` : ""}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
        )}
        {selecting && (
          <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 border-t border-obsidian-900/[0.06] bg-obsidian-50/60 px-6 py-3">
            <span className="mr-2 text-sm text-obsidian-900" aria-live="polite">
              {selected.size} selected
            </span>
            {BULK.map((b) => (
              <button key={b.action} type="button" onClick={() => void runBulk(b.action)} disabled={selected.size === 0 || busy !== null} className={b.action === "archive" ? dangerBtn : quietBtn}>
                {busy === b.action ? "Working…" : b.label}
              </button>
            ))}
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-sm text-slate-600 underline underline-offset-2 hover:text-obsidian-900">
                Clear selection
              </button>
            )}
          </div>
        )}
        {bulkNote && (
          <div role="status" className="border-t border-obsidian-900/[0.06] px-6 py-3 text-sm text-obsidian-900">
            <p>{bulkNote.text}</p>
            {bulkNote.failures.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-800">
                {bulkNote.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!data ? (
          <Loading />
        ) : data.posts.length === 0 ? (
          s?.total ? (
            <Empty>No posts match.</Empty>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-base text-obsidian-900">No blog posts yet.</p>
              <p className="mt-1 text-sm text-slate-600">Write a new post, or bring the existing posts over from Webflow with the import below.</p>
              {me.seo.manage && (
                <Link href="/seo/blog/new" className={`${primaryBtn} mt-4`}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Write the first post
                </Link>
              )}
            </div>
          )
        ) : (
          <SortableGrid sort={sort} dir={dir} onSort={onSort} select={selecting ? { all: allOnPage, some: someOnPage, onToggle: togglePage } : undefined}>
            {data.posts.map((p) => (
              <tr key={p.id} className={`align-top ${selecting && selected.has(p.id) ? "bg-ocean-50/60" : ""}`}>
                {selecting && (
                  <td className="py-3 pl-6">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.label}`} className="mt-1 h-5 w-5 accent-obsidian-900" />
                  </td>
                )}
                <td className="px-6 py-3">
                  <span className="flex gap-3">
                  {(p.thumbnailImage || p.featuredImage) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small preview of the post's image
                    <img src={(p.thumbnailImage || p.featuredImage) as string} alt="" loading="lazy" className="mt-1 h-14 w-20 shrink-0 rounded-lg object-cover ring-1 ring-obsidian-900/10" />
                  ) : (
                    <span className="mt-1 flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-obsidian-100 text-center text-sm text-slate-600">No image</span>
                  )}
                  <span className="min-w-0">
                  <span className="block text-base text-obsidian-900">{p.label}</span>
                  <span className="block font-mono text-sm text-slate-600">{p.path}</span>
                  <span className="text-sm text-slate-600">
                    {p.words} words · H2 {p.headings.h2} · H3 {p.headings.h3} · {p.images} images · {p.internalLinks} internal links · {p.keywords} {p.keywords === 1 ? "keyword" : "keywords"}
                  </span>
                  </span>
                  </span>
                </td>
                <td className="px-6 py-3">
                  <Chip className={STATUS_STYLE[p.status]}>{words(p.status)}</Chip>
                  {p.hasDraft && <span className="mt-1 block text-sm text-slate-600">Draft changes</span>}
                </td>
                <td className="px-6 py-3 text-sm text-slate-700">{p.status === "PUBLISHED" || p.datePublished ? day(p.datePublished) : "–"}</td>
                <td className="px-6 py-3 text-sm text-slate-700">{day(p.createdAt)}</td>
                <td className="px-6 py-3 text-sm text-slate-700">{day(p.dateModified)}</td>
                <td className="px-6 py-3 text-sm text-slate-700">
                  {p.featured ? "Yes" : "No"}
                  {!p.indexed && <span className="mt-1 block text-slate-600">Not indexed</span>}
                </td>
                <td className="px-6 py-3 text-sm">
                  {p.problems.length === 0 ? (
                    <span className="text-ocean-700">No problems found</span>
                  ) : (
                    <ul className="space-y-0.5 text-slate-700">
                      {p.problems.map((k) => (
                        <li key={k}>{PROBLEM_LABEL[k] ?? k}</li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-1 block text-slate-600">BlogPosting: {p.blogPosting === null ? "Not audited" : p.blogPosting ? "found" : "not found"}</span>
                </td>
                <td className="px-6 py-3 text-right">
                  <Link href={`/seo/blog/${p.id}`} className="inline-flex h-10 items-center rounded-full border border-obsidian-900/10 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
                    Edit post
                    <span className="sr-only"> {p.label}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </SortableGrid>
        )}
        {data && pages > 1 && (
          <nav aria-label="Post pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-obsidian-900/[0.06] px-6 py-4">
            <button type="button" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1} className={quietBtn}>
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {pages}
            </span>
            <button type="button" onClick={() => setPage((n) => Math.min(pages, n + 1))} disabled={page >= pages} className={quietBtn}>
              Next
            </button>
          </nav>
        )}
      </Panel>
      <WebflowSyncPanel />
      <ImportPanel kind="BLOG_POSTS" />
    </div>
  );
}

/** The posts table with Webflow-style sortable column headers. */
function SortableGrid({ sort, dir, onSort, select, children }: { sort: Sort; dir: "asc" | "desc"; onSort: (s: Sort) => void; select?: { all: boolean; some: boolean; onToggle: () => void }; children: ReactNode }) {
  const cols: { label: string; value?: Sort }[] = [{ label: "Name", value: "name" }, { label: "Status", value: "status" }, { label: "Published", value: "published" }, { label: "Created", value: "created" }, { label: "Modified", value: "modified" }, { label: "Featured" }, { label: "Checks" }, { label: "" }];
  return (
    <div className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-600" tabIndex={0} role="region" aria-label="Blog posts">
      <table className="w-full min-w-[72rem] text-left text-base">
        <thead className="bg-obsidian-50/70 text-sm text-slate-600">
          <tr>
            {select && (
              <th scope="col" className="py-3 pl-6 font-normal">
                <input
                  type="checkbox"
                  checked={select.all}
                  ref={(el) => {
                    if (el) el.indeterminate = select.some && !select.all;
                  }}
                  onChange={select.onToggle}
                  aria-label="Select every post on this page"
                  className="h-5 w-5 accent-obsidian-900"
                />
              </th>
            )}
            {cols.map((c, i) => (
              <th key={`${c.label}-${i}`} scope="col" aria-sort={c.value && c.value === sort ? (dir === "asc" ? "ascending" : "descending") : undefined} className="px-6 py-3 font-normal">
                {c.value ? <SortHeader label={c.label} value={c.value} sort={sort} dir={dir} onSort={onSort} /> : c.label || <span className="sr-only">Action</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-obsidian-900/[0.06]">{children}</tbody>
      </table>
    </div>
  );
}
