"use client";

// Page settings (/seo/page-settings), laid out like Webflow's Pages panel: a searchable list of every
// page on the left (grouped, the home page marked) and the chosen page's settings on the right. The
// settings are the existing page editor (SeoPageEditor), so saving, drafts, publishing, permissions
// and the change log work exactly as on "Pages & metadata"; this screen only adds the list.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Home, Newspaper, Search } from "lucide-react";
import { SeoPageEditor } from "@/components/admin/seo/PageEditor";
import { Loading, errorOf, field, portalApi, words, type PageType, type PublishStatus } from "@/components/admin/seo/shared";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

type Group = "pages" | "tours" | "destinations" | "blog" | "guides";

interface Row {
  id: string;
  path: string;
  label: string;
  pageType: PageType;
  status: PublishStatus;
  group: Group;
}

const GROUP_LABEL: Record<Group, string> = { pages: "Static pages", tours: "Tours", destinations: "Destinations", guides: "Guides", blog: "Blog posts" };
const ORDER: Group[] = ["pages", "tours", "destinations", "guides", "blog"];

function PageList({ rows, selected, onSelect }: { rows: Row[]; selected: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (term ? rows.filter((r) => r.label.toLowerCase().includes(term) || r.path.toLowerCase().includes(term)) : rows), [rows, term]);
  const groups = ORDER.map((g) => ({ g, items: shown.filter((r) => r.group === g).sort((a, b) => Number(b.pageType === "HOME") - Number(a.pageType === "HOME") || a.path.localeCompare(b.path)) })).filter((x) => x.items.length);
  return (
    <nav aria-label="Pages" className="rounded-[1.75rem] bg-white p-4 ring-1 ring-obsidian-900/[0.07]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <label htmlFor="page-settings-search" className="sr-only">
          Search pages
        </label>
        <input id="page-settings-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" className={`${field} pl-9`} />
      </div>
      <p className="mt-2 px-1 text-sm text-slate-600" aria-live="polite">
        {shown.length} of {rows.length} pages
      </p>
      <div className="mt-2 max-h-[22rem] overflow-y-auto xl:max-h-[calc(100vh-14rem)]">
        {groups.map(({ g, items }) => (
          <div key={g} className="mt-3 first:mt-0">
            <h2 className="px-2 text-xs uppercase tracking-wide text-slate-600">
              {GROUP_LABEL[g]} <span className="text-slate-500">{items.length}</span>
            </h2>
            <ul className="mt-1 space-y-0.5">
              {items.map((r) => {
                const Icon = r.pageType === "HOME" ? Home : g === "blog" ? Newspaper : FileText;
                const current = r.id === selected;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.id)}
                      aria-current={current ? "page" : undefined}
                      className={`flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm ${current ? "bg-obsidian-900 text-white" : "text-obsidian-900 hover:bg-obsidian-50"}`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${current ? "text-summit-300" : "text-slate-500"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {r.label}
                          {r.pageType === "HOME" && <span className="sr-only"> (home page)</span>}
                        </span>
                        <span className={`block truncate font-mono text-xs ${current ? "text-white/70" : "text-slate-600"}`}>{r.path}</span>
                      </span>
                      {r.status !== "PUBLISHED" && <span className={`shrink-0 text-xs ${current ? "text-white/80" : "text-slate-600"}`}>{words(r.status)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="px-2 py-4 text-sm text-slate-600">No page matches “{q}”.</p>}
      </div>
    </nav>
  );
}

function Inner() {
  const { me } = usePortal();
  const router = useRouter();
  const pathname = usePathname() ?? "/seo/page-settings";
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const selected = params?.get("page") ?? null;

  const load = useCallback(async () => {
    const res = await portalApi<{ pages: Row[] }>("/page-keywords");
    if (res.ok) setRows(res.data.pages);
    else setError(errorOf(res.data, "Couldn't load the pages."));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Open the home page when nothing is chosen, like Webflow does.
  const fallback = rows?.find((r) => r.pageType === "HOME")?.id ?? rows?.[0]?.id ?? null;
  const current = selected && rows?.some((r) => r.id === selected) ? selected : fallback;
  const row = rows?.find((r) => r.id === current) ?? null;

  const select = (id: string) => {
    router.replace(`${pathname}?page=${encodeURIComponent(id)}`, { scroll: false });
    if (window.matchMedia("(max-width: 1279px)").matches) document.getElementById("page-settings-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <PortalHeading
        title="Page settings"
        intro="Every page's settings in one place: address, SEO, Open Graph, site search, schema markup and custom code. Changes to a live page are saved as a draft first; publishing puts them live."
      />
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {!rows && !error && <Loading />}
      {rows && (
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <PageList rows={rows} selected={current} onSelect={select} />
          </div>
          <div id="page-settings-editor" className="min-w-0 scroll-mt-6">
            {row ? (
              <SeoPageEditor key={row.id} id={row.id} mode="draft" canPublish={me.seo.manage} compact />
            ) : (
              <p className="rounded-[1.75rem] bg-white px-6 py-8 text-sm text-slate-600 ring-1 ring-obsidian-900/10">No pages are listed yet. Add them from Pages &amp; metadata.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PageSettingsView() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}
