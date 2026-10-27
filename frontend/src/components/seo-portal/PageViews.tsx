"use client";

// Two per-page screens of the SEO portal:
// - Keywords by page: every page and blog post with the keywords it targets. Several keywords per
//   page; typing a keyword that isn't in the keyword sheet adds it there (unverified) and maps it.
// - Social images: the Open Graph image of every page, picked from the library or uploaded.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus, RefreshCw, X } from "lucide-react";
import { ImageField } from "@/components/admin/seo/ImageField";
import { Chip, Empty, Loading, Panel, STATUS_STYLE, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, seoApi, words, type PageType, type PublishStatus } from "@/components/admin/seo/shared";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

type Group = "pages" | "tours" | "destinations" | "blog" | "guides";
type Role = "PRIMARY" | "SECONDARY";

interface PageKeyword {
  mappingId: string;
  id: string;
  keyword: string;
  role: Role;
  archived: boolean;
  searchVolume: number | null;
}

interface PageRow {
  id: string;
  path: string;
  label: string;
  pageType: PageType;
  status: PublishStatus;
  group: Group;
  focusKeyword: string | null;
  ogImage: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  liveOgImage: string | null;
  keywords: PageKeyword[];
}

interface PageList {
  pages: PageRow[];
  counts: Record<Group, number>;
  withoutKeywords: number;
}

const GROUPS: { value: Group; label: string }[] = [
  { value: "pages", label: "Site pages" },
  { value: "tours", label: "Tours" },
  { value: "blog", label: "Blog posts" },
  { value: "destinations", label: "Destinations" },
  { value: "guides", label: "Guides" },
];

/** The site-wide share image set in the root layout (frontend/src/app/layout.tsx). */
const SITE_DEFAULT_OG = "/media/photos/moraine-lake-perfect-reflection.webp";

function usePageList() {
  const [data, setData] = useState<PageList | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const res = await portalApi<PageList>("/page-keywords");
    if (res.ok) {
      setData(res.data);
      setError("");
    } else setError(errorOf(res.data, "Couldn't load the pages."));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, load };
}

function GroupTabs({ value, onChange, counts }: { value: Group; onChange: (g: Group) => void; counts: Record<Group, number> }) {
  return (
    <div role="group" aria-label="Kind of page" className="flex flex-wrap gap-2">
      {GROUPS.filter((g) => counts[g.value] > 0 || g.value === "pages" || g.value === "blog").map((g) => (
        <button
          key={g.value}
          type="button"
          aria-pressed={value === g.value}
          onClick={() => onChange(g.value)}
          className={`h-10 rounded-full px-4 text-sm ${value === g.value ? "bg-obsidian-900 text-white" : "border border-obsidian-900/10 bg-white text-obsidian-900 hover:bg-obsidian-50"}`}
        >
          {g.label} <span className={value === g.value ? "text-white/70" : "text-slate-600"}>{counts[g.value]}</span>
        </button>
      ))}
    </div>
  );
}

/** Shown when the page list is empty: the registry hasn't been filled yet on this server. */
function NoPages({ onDone }: { onDone: () => void }) {
  const { me, notify } = usePortal();
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    const res = await seoApi<{ result: { added: number } }>("/pages/sync", "POST", {});
    setBusy(false);
    if (!res.ok) return notify(errorOf(res.data, "Couldn't add the site's pages."));
    notify(`${res.data.result.added} pages added.`);
    onDone();
  }
  return (
    <div className="rounded-none bg-white px-6 py-8 text-center ring-1 ring-obsidian-900/10">
      <p className="text-base text-obsidian-900">No pages are listed yet.</p>
      <p className="mt-1 text-sm text-slate-600">Add every page the site has (home, tours, service pages, destinations). Nothing on the site changes.</p>
      {me.seo.manage && (
        <button type="button" onClick={() => void sync()} disabled={busy} className={`${primaryBtn} mt-4`}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {busy ? "Adding pages…" : "Add the site's pages"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Keywords by page

function KeywordEditor({ page, onChanged }: { page: PageRow; onChanged: () => void }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const [text, setText] = useState("");
  const [primary, setPrimary] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: string; keyword: string }[]>([]);
  const onPage = useMemo(() => new Set(page.keywords.map((k) => k.keyword.toLowerCase())), [page.keywords]);

  useEffect(() => {
    const term = text.trim();
    if (term.length < 2) return setSuggestions([]);
    const t = window.setTimeout(async () => {
      const res = await seoApi<{ keywords: { id: string; keyword: string }[] }>(`/keywords?q=${encodeURIComponent(term)}&pageSize=8`);
      if (res.ok) setSuggestions((res.data.keywords ?? []).filter((k) => !onPage.has(k.keyword.toLowerCase())));
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, onPage]);

  async function add(keyword: string) {
    const value = keyword.trim();
    if (value.length < 2) return setError("Type a keyword of at least 2 characters.");
    setBusy("add");
    setError("");
    setWarnings([]);
    const res = await portalApi<{ created: boolean; warnings: string[] }>(`/pages/${page.id}/keywords`, "POST", { keyword: value, role: primary ? "PRIMARY" : "SECONDARY" });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't add that keyword."));
    setWarnings(res.data.warnings ?? []);
    notify(`“${value}” added to ${page.label}${res.data.created ? " (new in the keyword sheet, unverified)" : ""}.`);
    setText("");
    setPrimary(false);
    setSuggestions([]);
    onChanged();
  }

  async function setRole(k: PageKeyword, role: Role) {
    setBusy(k.mappingId);
    setError("");
    const res = await portalApi<{ warnings: string[] }>(`/pages/${page.id}/keywords/${k.mappingId}`, "PATCH", { role });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't change that keyword."));
    setWarnings(res.data.warnings ?? []);
    onChanged();
  }

  async function remove(k: PageKeyword) {
    setBusy(k.mappingId);
    setError("");
    const res = await portalApi(`/pages/${page.id}/keywords/${k.mappingId}`, "DELETE");
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't remove that keyword."));
    notify(`“${k.keyword}” removed from ${page.label}. It stays in the keyword sheet.`);
    onChanged();
  }

  return (
    <div className="space-y-4 border-t border-obsidian-900/[0.06] bg-obsidian-50/50 px-5 py-5 sm:px-6">
      {page.keywords.length === 0 ? (
        <p className="text-sm text-slate-600">No keywords on this page yet.</p>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06] rounded-2xl border border-obsidian-900/10 bg-white">
          {page.keywords.map((k) => (
            <li key={k.mappingId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-base text-obsidian-900">
                  {k.keyword}
                  {k.archived && <Chip className="ml-2 bg-red-50 text-red-800">Archived</Chip>}
                </span>
                <span className="text-sm text-slate-600">{k.searchVolume !== null ? `${k.searchVolume.toLocaleString()} searches a month` : "Volume not researched"}</span>
              </span>
              {me.seo.manage ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span role="group" aria-label={`Role of ${k.keyword}`} className="flex gap-1">
                    {(["PRIMARY", "SECONDARY"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={k.role === r}
                        disabled={busy !== null}
                        onClick={() => k.role !== r && void setRole(k, r)}
                        className={`h-9 rounded-full px-3.5 text-sm ${k.role === r ? "bg-obsidian-900 text-white" : "border border-obsidian-900/10 bg-white text-obsidian-900 hover:bg-obsidian-50"}`}
                      >
                        {r === "PRIMARY" ? "Primary" : "Secondary"}
                      </button>
                    ))}
                  </span>
                  <button type="button" onClick={() => void remove(k)} disabled={busy !== null} aria-label={`Remove ${k.keyword} from ${page.label}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-red-50 hover:text-red-700">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <Chip className={k.role === "PRIMARY" ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{words(k.role)}</Chip>
              )}
            </li>
          ))}
        </ul>
      )}

      {me.seo.manage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add(text);
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor={`${uid}-kw`} className={labelCls}>
                Add a keyword
              </label>
              <input id={`${uid}-kw`} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. private tours banff" autoComplete="off" className={field} />
            </div>
            <label className="flex h-11 items-center gap-2 text-sm text-obsidian-900">
              <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="h-5 w-5 accent-ocean-600" />
              Primary keyword
            </label>
            <button type="submit" disabled={busy !== null || text.trim().length < 2} className={primaryBtn}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {busy === "add" ? "Adding…" : "Add"}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">From the keyword sheet:</span>
              {suggestions.map((s) => (
                <button key={s.id} type="button" onClick={() => void add(s.keyword)} disabled={busy !== null} className="h-9 rounded-full border border-obsidian-900/10 bg-white px-3.5 text-sm text-obsidian-900 hover:bg-obsidian-50">
                  {s.keyword}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-600">Add as many as the page targets. Mark one as primary: the main term the page should rank for. New keywords join the keyword sheet as unverified, with no volume until someone researches them.</p>
        </form>
      )}
      {warnings.length > 0 && (
        <ul aria-live="polite" className="space-y-1 rounded-2xl bg-summit-100 px-4 py-3 text-sm text-obsidian-900">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PageKeywordsView() {
  const uid = useId();
  const { data, error, load } = usePageList();
  const [group, setGroup] = useState<Group>("pages");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.pages ?? []).filter((p) => p.group === group && (!term || `${p.label} ${p.path} ${p.keywords.map((k) => k.keyword).join(" ")}`.toLowerCase().includes(term)));
  }, [data, group, q]);

  return (
    <div className="space-y-6">
      <PortalHeading
        title="Keywords by page"
        intro="The keywords each page and blog post targets. Open a page to add, change or remove its keywords; a page can have as many as it needs, with one primary."
      />
      {error && <p className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-800">{error}</p>}
      {!data ? (
        <Loading />
      ) : data.pages.length === 0 ? (
        <NoPages onDone={() => void load()} />
      ) : (
        <>
          <GroupTabs value={group} onChange={setGroup} counts={data.counts} />
          <Panel id={`${uid}-pages`} title={GROUPS.find((g) => g.value === group)?.label ?? "Pages"} description={`${data.withoutKeywords} of ${data.pages.length} pages have no keywords yet.`}>
            <div className="px-6 py-4">
              <label htmlFor={`${uid}-q`} className={labelCls}>
                Search pages or keywords
              </label>
              <input id={`${uid}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} sm:max-w-md`} />
            </div>
            {rows.length === 0 ? (
              <Empty>{group === "blog" ? "No blog posts yet. Create one under Blog SEO." : "No pages match."}</Empty>
            ) : (
              <ul className="divide-y divide-obsidian-900/[0.06] border-t border-obsidian-900/[0.06]">
                {rows.map((p) => {
                  const open = openId === p.id;
                  return (
                    <li key={p.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-base text-obsidian-900">
                            {p.label}
                            <Chip className={STATUS_STYLE[p.status]}>{words(p.status)}</Chip>
                          </p>
                          <p className="font-mono text-sm text-slate-600">{p.path}</p>
                          <p className="mt-2 flex flex-wrap gap-1.5">
                            {p.keywords.length === 0 ? (
                              <span className="text-sm text-slate-600">No keywords yet</span>
                            ) : (
                              p.keywords.map((k) => (
                                <Chip key={k.mappingId} className={k.role === "PRIMARY" ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>
                                  {k.keyword}
                                  {k.role === "PRIMARY" ? " · primary" : ""}
                                </Chip>
                              ))
                            )}
                          </p>
                        </div>
                        <span className="flex flex-wrap gap-2">
                          <Link href={`/seo/pages/${p.id}`} className={quietBtn}>
                            Edit page
                          </Link>
                          <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} aria-controls={`${uid}-kw-${p.id}`} className={quietBtn}>
                            {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                            {p.keywords.length} {p.keywords.length === 1 ? "keyword" : "keywords"}
                            <span className="sr-only"> on {p.label}</span>
                          </button>
                        </span>
                      </div>
                      {open && (
                        <div id={`${uid}-kw-${p.id}`}>
                          <KeywordEditor page={p} onChanged={() => void load()} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Social images (Open Graph)

function SocialImageRow({ page, onSaved }: { page: PageRow; onSaved: () => void }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(page.ogImage ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isCms = page.group === "blog" || page.group === "guides";
  const notLive = page.status !== "PUBLISHED";
  // Code pages: publishing the page row only applies the fields set here, so it is offered.
  const [publish, setPublish] = useState(notLive && !isCms);

  const effective = page.ogImage || page.featuredImage || page.liveOgImage || SITE_DEFAULT_OG;
  const sourceLabel = page.ogImage ? "Set here" : page.featuredImage ? "Featured image" : page.liveOgImage ? "From the page" : "Site default";

  async function save() {
    setBusy(true);
    setError("");
    const res = await portalApi(`/pages/${page.id}/social-image`, "PUT", { ogImage: value.trim() || null, publish: publish && notLive && !isCms });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save the image."));
    notify(publish && notLive && !isCms ? `${page.label}: social image saved and live.` : notLive ? `${page.label}: social image saved. It goes live when the page is published.` : `${page.label}: social image saved and live.`);
    setOpen(false);
    onSaved();
  }

  return (
    <li>
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- preview of the configured share image */}
        <img src={effective} alt="" loading="lazy" className="aspect-[1200/630] w-36 shrink-0 rounded-lg object-cover ring-1 ring-obsidian-900/10" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-base text-obsidian-900">
            {page.label}
            <Chip className={STATUS_STYLE[page.status]}>{words(page.status)}</Chip>
          </p>
          <p className="font-mono text-sm text-slate-600">{page.path}</p>
          <p className="text-sm text-slate-600">{sourceLabel}</p>
        </div>
        {me.seo.manage && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={quietBtn}>
            {open ? "Close" : page.ogImage ? "Change image" : "Set image"}
            <span className="sr-only"> for {page.label}</span>
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-4 border-t border-obsidian-900/[0.06] bg-obsidian-50/50 px-5 py-5 sm:px-6">
          <ImageField
            id={`${uid}-og`}
            label={`Open Graph image for ${page.label}`}
            value={value}
            onChange={setValue}
            fallback={page.featuredImage || page.liveOgImage || SITE_DEFAULT_OG}
            fallbackLabel={page.featuredImage ? "Featured image" : page.liveOgImage ? "From the page" : "Site default"}
            hint="Best at 1200 × 630 px. Shown when the page is shared on Facebook, LinkedIn, WhatsApp, Slack and similar. Empty uses the image shown on the left."
          />
          {notLive && !isCms && (
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
              <span className="text-sm text-obsidian-900">
                Make it live now. This page&apos;s SEO settings aren&apos;t published yet; publishing applies only the fields set in the portal (the image, and anything else already filled in on the page).
              </span>
            </label>
          )}
          {notLive && isCms && <p className="text-sm text-slate-600">This post isn&apos;t published yet, so the image goes live with it.</p>}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={busy || value.trim() === (page.ogImage ?? "")} className={primaryBtn}>
              {busy ? "Saving…" : "Save image"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(page.ogImage ?? "");
                setOpen(false);
              }}
              className={quietBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function SocialImagesView() {
  const uid = useId();
  const { data, error, load } = usePageList();
  const [group, setGroup] = useState<Group>("pages");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.pages ?? []).filter((p) => p.group === group && (!term || `${p.label} ${p.path}`.toLowerCase().includes(term)));
  }, [data, group, q]);
  const missing = (data?.pages ?? []).filter((p) => !p.ogImage && !p.featuredImage).length;

  return (
    <div className="space-y-6">
      <PortalHeading
        title="Social images"
        intro="The Open Graph image of every page: the picture people see when a page is shared on social media or in a chat. Pick one from the library or upload it."
      />
      {error && <p className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-800">{error}</p>}
      {!data ? (
        <Loading />
      ) : data.pages.length === 0 ? (
        <NoPages onDone={() => void load()} />
      ) : (
        <>
          <GroupTabs value={group} onChange={setGroup} counts={data.counts} />
          <Panel id={`${uid}-og`} title={GROUPS.find((g) => g.value === group)?.label ?? "Pages"} description={`${missing} of ${data.pages.length} pages have no image of their own and share the page's or site's default.`}>
            <div className="px-6 py-4">
              <label htmlFor={`${uid}-q`} className={labelCls}>
                Search pages
              </label>
              <input id={`${uid}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} className={`${field} sm:max-w-md`} />
            </div>
            {rows.length === 0 ? (
              <Empty>{group === "blog" ? "No blog posts yet." : "No pages match."}</Empty>
            ) : (
              <ul className="divide-y divide-obsidian-900/[0.06] border-t border-obsidian-900/[0.06]">
                {rows.map((p) => (
                  <SocialImageRow key={`${p.id}-${p.ogImage ?? ""}`} page={p} onSaved={() => void load()} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
