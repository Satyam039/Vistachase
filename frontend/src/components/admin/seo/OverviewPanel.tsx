"use client";

// SEO overview: page coverage, duplicates, links, keyword coverage, open issues ranked by what to
// fix first, cluster coverage and the (disconnected) search data providers. Every figure is counted
// from Vista Chase's own records and audits.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Chip, Empty, Grid, Loading, Panel, SEVERITY_STYLE, Stat, TRACK_LABEL, errorOf, primaryBtn, seoApi, when, words, type Cluster, type Severity, type Track } from "@/components/admin/seo/shared";

export interface Overview {
  pages: {
    total: number;
    status: Record<"PUBLISHED" | "DRAFT" | "SCHEDULED" | "ARCHIVED", number>;
    noindex: number;
    neverCrawled: number;
    byType: Record<string, number>;
    missing: Record<"title" | "description" | "h1" | "canonical" | "focusKeyword", number>;
  };
  duplicates: Record<"titles" | "descriptions" | "canonicals" | "slugs", number>;
  links: { broken: number; redirectIssues: number; activeRedirects: number };
  keywords: {
    total: number;
    traffic: number;
    booking: number;
    mapped: number;
    plannedOnly: number;
    unmapped: number;
    cannibalised: number;
    verified: number;
    unverified: number;
    metricsUnknown: number;
    intentMismatches: number;
  };
  clusters: Cluster[];
  issues: {
    open: number;
    bySeverity: Record<Severity, number>;
    fixes: { id: string; type: string; severity: Severity; path: string | null; pageId: string | null; pageLabel: string | null; message: string }[];
  };
  audits: { id: string; status: string; trigger: string; startedAt: string; finishedAt: string | null; summary: { issues?: number; crawled?: boolean; crawlNote?: string | null } }[];
  integrations: { id: string; name: string; connected: boolean; configured: boolean; message: string }[];
  dataNote: string;
}

export type SectionId = "overview" | "pages" | "keywords" | "clusters" | "redirects" | "audit" | "llms" | "integrations";

export function OverviewPanel({ notify, goTo }: { notify: (m: string) => void; goTo: (section: SectionId) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await seoApi<{ overview: Overview }>("/overview");
    if (!res.ok) return setError(errorOf(res.data, "Couldn't load the SEO overview."));
    setError("");
    setData(res.data.overview);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function bootstrap() {
    setBusy(true);
    const res = await seoApi<{ result: { pagesAdded: number; clustersAdded: number; keywordsAdded: number; mappingsAdded: number } }>("/bootstrap", "POST", {});
    setBusy(false);
    if (!res.ok) return notify(errorOf(res.data, "Couldn't load the starter data."));
    const r = res.data.result;
    notify(`Added ${r.pagesAdded} pages, ${r.clustersAdded} clusters, ${r.keywordsAdded} keywords and ${r.mappingsAdded} page mappings. Nothing existing was changed.`);
    await load();
  }

  if (error)
    return (
      <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
        {error}
      </p>
    );
  if (!data)
    return (
      <Panel id="seo-overview-loading" title="Overview">
        <Loading />
      </Panel>
    );

  const { pages, keywords, issues } = data;
  const crawled = pages.total - pages.neverCrawled;
  const needsStarter = pages.total === 0 || keywords.total === 0;

  return (
    <div className="space-y-6">
      <p className="rounded-2xl bg-obsidian-100/60 px-5 py-3 text-sm text-slate-700">{data.dataNote}</p>

      {needsStarter && (
        <Panel
          id="seo-starter"
          title="Get started"
          description="Adds a row for every public page, tour and destination, plus the starter keyword map built from the Vista Chase catalogue. Search figures stay empty and every keyword starts unverified. Existing records are never changed."
          actions={
            <button type="button" className={primaryBtn} disabled={busy} onClick={bootstrap}>
              {busy ? "Loading…" : "Load starter data"}
            </button>
          }
        >
          <span />
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pages tracked" value={pages.total} hint={`${pages.status.PUBLISHED} published · ${pages.status.DRAFT} draft · ${pages.status.SCHEDULED} scheduled`} />
        <Stat label="Open issues" value={issues.open} tone={issues.bySeverity.CRITICAL > 0 ? "bad" : undefined} hint={`${issues.bySeverity.CRITICAL} critical · ${issues.bySeverity.HIGH} high`} />
        <Stat label="Keywords" value={keywords.total} hint={`${keywords.traffic} traffic · ${keywords.booking} booking`} />
        <Stat label="Pages never audited" value={pages.neverCrawled} tone={pages.neverCrawled > 0 ? "warn" : "good"} hint={crawled > 0 ? `${crawled} read by an audit` : "Run an audit to read the live pages"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="seo-missing" title="Missing fields" description={`On the ${crawled} audited pages (live page or override). Focus keywords on every tour, destination and landing page.`}>
          <dl className="grid grid-cols-2 gap-px bg-obsidian-900/[0.06] sm:grid-cols-3">
            {(
              [
                ["Title", pages.missing.title],
                ["Meta description", pages.missing.description],
                ["H1", pages.missing.h1],
                ["Canonical", pages.missing.canonical],
                ["Focus keyword", pages.missing.focusKeyword],
                ["Noindex", pages.noindex],
              ] as const
            ).map(([name, n]) => (
              <div key={name} className="bg-white px-6 py-4">
                <dt className="text-sm text-slate-600">{name}</dt>
                <dd className={`text-2xl font-light tabular-nums ${n > 0 ? "text-obsidian-900" : "text-ocean-700"}`}>{n}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel id="seo-dupes" title="Duplicates & links" description="From the latest audit.">
          <dl className="grid grid-cols-2 gap-px bg-obsidian-900/[0.06] sm:grid-cols-3">
            {(
              [
                ["Duplicate titles", data.duplicates.titles],
                ["Duplicate descriptions", data.duplicates.descriptions],
                ["Duplicate canonicals", data.duplicates.canonicals],
                ["Broken internal links", data.links.broken],
                ["Redirect problems", data.links.redirectIssues],
                ["Active redirects", data.links.activeRedirects],
              ] as const
            ).map(([name, n]) => (
              <div key={name} className="bg-white px-6 py-4">
                <dt className="text-sm text-slate-600">{name}</dt>
                <dd className="text-2xl font-light tabular-nums text-obsidian-900">{n}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel
        id="seo-fixes"
        title="Fix first"
        description="Open issues ranked by severity, doubled on key pages."
        actions={
          <button type="button" className="inline-flex items-center gap-1 text-sm text-ocean-700 hover:underline" onClick={() => goTo("audit")}>
            All issues <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        }
      >
        {issues.fixes.length === 0 ? (
          <Empty>{data.audits.length === 0 ? "No audit has run yet. Run one under Audit." : "Nothing open. Well done."}</Empty>
        ) : (
          <Grid label="Issues to fix first" head={[["Severity"], ["Page"], ["Problem"], [""]]}>
            {issues.fixes.map((f) => (
              <tr key={f.id} className="hover:bg-obsidian-50/60">
                <td className="px-6 py-4">
                  <Chip className={SEVERITY_STYLE[f.severity]}>{words(f.severity)}</Chip>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="block text-obsidian-900">{f.pageLabel ?? f.path ?? "Site"}</span>
                  {f.path && <span className="block font-mono text-slate-600">{f.path}</span>}
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{f.message}</td>
                <td className="px-6 py-4 text-right">
                  {f.pageId && (
                    <Link href={`/admin/seo/pages/${f.pageId}`} className="text-sm text-ocean-700 hover:underline">
                      Edit page
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>

      <Panel
        id="seo-kw-coverage"
        title="Keyword coverage"
        description="Traffic acquisition keywords bring visitors (guides, destinations). Booking conversion keywords sell (tour and landing pages)."
        actions={
          <button type="button" className="inline-flex items-center gap-1 text-sm text-ocean-700 hover:underline" onClick={() => goTo("keywords")}>
            Keywords <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        }
      >
        <dl className="grid grid-cols-2 gap-px bg-obsidian-900/[0.06] sm:grid-cols-4">
          {(
            [
              ["Mapped to a page", keywords.mapped],
              ["Target page not built yet", keywords.plannedOnly],
              ["Unmapped", keywords.unmapped],
              ["Cannibalised", keywords.cannibalised],
              ["Intent mismatch", keywords.intentMismatches],
              ["Verified", keywords.verified],
              ["Unverified", keywords.unverified],
              ["No volume data", keywords.metricsUnknown],
            ] as const
          ).map(([name, n]) => (
            <div key={name} className="bg-white px-6 py-4">
              <dt className="text-sm text-slate-600">{name}</dt>
              <dd className="text-2xl font-light tabular-nums text-obsidian-900">{n}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel id="seo-clusters" title="Clusters">
        {data.clusters.length === 0 ? (
          <Empty>No clusters yet.</Empty>
        ) : (
          <Grid label="Cluster coverage" head={[["Cluster"], ["Track"], ["Hub page"], ["Keywords", true], ["Mapped", true], ["High priority", true]]}>
            {data.clusters.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4">
                  <span className="block text-obsidian-900">{c.name}</span>
                  {c.pillar && <span className="block text-sm text-slate-600">{c.pillar}</span>}
                </td>
                <td className="px-6 py-4 text-sm">{TRACK_LABEL[c.track as Track]}</td>
                <td className="px-6 py-4 font-mono text-sm">{c.hubPath ?? "–"}</td>
                <td className="px-6 py-4 text-right tabular-nums">{c.keywords}</td>
                <td className="px-6 py-4 text-right tabular-nums">{c.mapped}</td>
                <td className="px-6 py-4 text-right tabular-nums">{c.highPriority}</td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="seo-audits" title="Recent audits">
          {data.audits.length === 0 ? (
            <Empty>No audits yet.</Empty>
          ) : (
            <ul className="divide-y divide-obsidian-900/[0.06]">
              {data.audits.slice(0, 5).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 text-sm">
                  <span>
                    {when(a.startedAt)} · {words(a.trigger)}
                  </span>
                  <span className="text-slate-600">
                    {words(a.status)}
                    {typeof a.summary?.issues === "number" && ` · ${a.summary.issues} issues`}
                    {a.summary?.crawled === false && " · site not reached"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel id="seo-integrations" title="Search data">
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {data.integrations.map((i) => (
              <li key={i.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-obsidian-900">{i.name}</span>
                  <Chip className={i.connected ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{i.connected ? "Connected" : i.configured ? "Configured, not connected" : "Not connected"}</Chip>
                </div>
                <p className="mt-1 text-sm text-slate-600">{i.message}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
