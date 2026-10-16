"use client";

// Portal overview: the migration at a glance (blog posts, approvals, imports, technical
// checks, images, my tasks), then the existing SEO dashboard. All counts come from Vista Chase's own
// records; search and traffic figures appear only once a provider is connected.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OverviewPanel, type SectionId } from "@/components/admin/seo/OverviewPanel";
import { Chip, Panel, Stat, portalApi, when, words } from "@/components/admin/seo/shared";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

interface Migration {
  checklist: { before: { total: number; done: number; blocked: number }; after: { total: number; done: number; blocked: number } };
  blog: Record<string, number>;
  pendingRequests: number;
  lastImport: { kind: string; source: string; status: string; createdAt: string } | null;
  baseline: { capturedAt: string; urls: number | null } | null;
  webflow: { configured: boolean };
  technical: { checkedAt: string; counts: Record<string, number> } | null;
  images: { webflowReferences: number; missingAlt: number };
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  path: string | null;
}

const SECTION_ROUTE: Record<SectionId, string> = {
  overview: "/seo",
  pages: "/seo/pages",
  keywords: "/seo/keywords",
  clusters: "/seo/keywords#clusters",
  redirects: "/seo/redirects",
  audit: "/seo/audit",
  llms: "/seo/settings#llms",
  integrations: "/seo/analytics",
};

export function OverviewView() {
  const { notify } = usePortal();
  const router = useRouter();
  const [data, setData] = useState<{ migration: Migration; tasks: { counts: Record<string, number>; mine: Task[] } } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    portalApi<{ overview: { migration: Migration; tasks: { counts: Record<string, number>; mine: Task[] } } }>("/overview").then((res) => {
      if (res.ok) setData(res.data.overview);
      else setError("Couldn't load the migration summary.");
    });
  }, []);

  const m = data?.migration;
  return (
    <div className="space-y-6">
      <PortalHeading title="Overview" intro="Where the Webflow migration stands and what needs attention. Every number is counted from this site's own records." />
      {error && <p className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-800">{error}</p>}
      {m && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Blog posts published" value={`${m.blog.PUBLISHED ?? 0}/${m.blog.expected}`} hint={`${m.blog.DRAFT ?? 0} drafts here`} tone={(m.blog.PUBLISHED ?? 0) >= m.blog.expected ? "good" : undefined} />
            <Stat label="Waiting for an admin" value={m.pendingRequests} hint="Tag, verification or site schema" />
            <Stat label="Webflow images still linked" value={m.images.webflowReferences} hint={`${m.images.missingAlt} images missing alt text (last audit)`} tone={m.images.webflowReferences ? "warn" : "good"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel id="ov-sources" title="Sources">
              <ul className="space-y-2 px-6 py-5 text-sm text-slate-700">
                <li>
                  Webflow API: <Chip className={m.webflow.configured ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{m.webflow.configured ? "Token set" : "Not connected"}</Chip>
                </li>
                <li>Live-site baseline: {m.baseline ? `${m.baseline.urls ?? "?"} URLs, ${when(m.baseline.capturedAt)}` : "Not captured yet"}</li>
                <li>Last import: {m.lastImport ? `${words(m.lastImport.kind)} from ${words(m.lastImport.source)}, ${words(m.lastImport.status).toLowerCase()} ${when(m.lastImport.createdAt)}` : "None yet"}</li>
                <li>Technical checks: {m.technical ? `${m.technical.counts.fail ?? 0} failing, ${m.technical.counts.warn ?? 0} warnings (${when(m.technical.checkedAt)})` : "Not run yet"}</li>
              </ul>
            </Panel>
            <Panel id="ov-tasks" title="My open tasks" actions={<Link href="/seo/tasks" className="text-sm text-ocean-700 underline underline-offset-2">All tasks</Link>}>
              {data.tasks.mine.length === 0 ? (
                <p className="px-6 py-5 text-sm text-slate-600">Nothing assigned to you.</p>
              ) : (
                <ul className="divide-y divide-obsidian-900/[0.06]">
                  {data.tasks.mine.map((t) => (
                    <li key={t.id} className="px-6 py-3 text-sm">
                      <span className="text-obsidian-900">{t.title}</span>
                      <span className="block text-slate-600">
                        {words(t.status)} · {words(t.priority)}
                        {t.dueDate ? ` · due ${t.dueDate.slice(0, 10)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel id="ov-team" title="Team tasks">
              <ul className="grid grid-cols-2 gap-3 px-6 py-5 text-sm">
                {Object.entries(data.tasks.counts).map(([k, n]) => (
                  <li key={k} className="rounded-xl bg-obsidian-50 px-3 py-2">
                    <span className="block text-2xl font-light text-obsidian-900">{n}</span>
                    <span className="text-slate-600">{words(k)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
      <OverviewPanel notify={notify} goTo={(section) => router.push(SECTION_ROUTE[section])} />
    </div>
  );
}
