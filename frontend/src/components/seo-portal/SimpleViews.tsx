"use client";

// Portal sections that are mostly the existing SEO panels (also used by the page editor) plus the
// portal's import tools.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PagesPanel } from "@/components/admin/seo/PagesPanel";
import { ClustersPanel, KeywordsPanel } from "@/components/admin/seo/KeywordsPanel";
import { SeoPageEditor } from "@/components/admin/seo/PageEditor";
import { IntegrationsPanel, LlmsPanel } from "@/components/admin/seo/LlmsPanel";
import { portalApi } from "@/components/admin/seo/shared";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";
import { ImportPanel } from "@/components/seo-portal/ImportPanel";

export function PagesView() {
  const { notify } = usePortal();
  return (
    <div className="space-y-6">
      <PortalHeading title="Pages & metadata" intro="Every page's title, description, canonical, robots and social fields. Edits to a live page are saved as a draft; publishing a draft puts it live, with the change recorded." />
      <PagesPanel notify={notify} />
      <ImportPanel kind="PAGE_METADATA" />
    </div>
  );
}

export function PageEditorView() {
  const { me } = usePortal();
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <Link href="/seo/pages" className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All pages
      </Link>
      <SeoPageEditor id={String(params.id)} mode="draft" canPublish={me.seo.manage} />
    </div>
  );
}

export function KeywordsView() {
  const { me, notify } = usePortal();
  return (
    <div className="space-y-6">
      <PortalHeading title="Keywords" intro="The keyword map: research, clusters and which page targets which keyword. Volumes and difficulty show only when they were researched or entered with their source; nothing is estimated here." />
      <KeywordsPanel notify={notify} canManage={me.seo.manage} />
      <div id="clusters">
        <ClustersPanel notify={notify} />
      </div>
    </div>
  );
}

interface AnalyticsData {
  integrations: { id: string; name: string; connected: boolean; configured: boolean; message: string }[];
  tracking: { enabled?: boolean; ga4Id?: string | null; adsId?: string | null; adsConversionLabel?: string | null; conversionValue?: number | null; currency?: string | null; conversionTriggers?: string | null };
  verification: { set: boolean; matchesHandoff: boolean | null };
  searchMetricRows: number;
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  useEffect(() => {
    void portalApi<AnalyticsData>("/analytics").then((r) => r.ok && setData(r.data));
  }, []);
  const t = data?.tracking;
  return (
    <div className="space-y-6">
      <PortalHeading title="Analytics & Search Console" intro="Connection status only. Traffic, clicks, impressions and rankings appear here once Google Search Console or GA4 is connected on the server; nothing is estimated." />
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
            <h2 className="text-xl text-obsidian-900">Google tag on the site</h2>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="inline text-slate-600">Status: </dt>
                <dd className="inline">{t?.enabled ? "On (approved by an admin)" : "Off"}</dd>
              </div>
              <div>
                <dt className="inline text-slate-600">GA4: </dt>
                <dd className="inline font-mono">{t?.ga4Id ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="inline text-slate-600">Google Ads: </dt>
                <dd className="inline font-mono">{t?.adsId ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="inline text-slate-600">Conversion: </dt>
                <dd className="inline">
                  {t?.adsConversionLabel ? `${t.adsConversionLabel}, ${t.conversionValue ?? "?"} ${t.currency ?? ""}` : "Not set"}. Which buttons count as a conversion is still to be confirmed with Nishika; no conversion events are sent yet.
                </dd>
              </div>
              <div>
                <dt className="inline text-slate-600">Search Console verification tag: </dt>
                <dd className="inline">{data.verification.set ? (data.verification.matchesHandoff ? "On the home page (matches the handoff)" : "On the home page (differs from the handoff value)") : "Not added"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-slate-600">
              Changing these needs an admin: <Link href="/seo/settings" className="text-ocean-700 underline underline-offset-2">Settings → Approvals</Link>.
            </p>
          </section>
          <section className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
            <h2 className="text-xl text-obsidian-900">Search data</h2>
            <p className="mt-2 text-sm text-slate-600">{data.searchMetricRows ? `${data.searchMetricRows} rows of provider data stored.` : "No search data: not connected."}</p>
          </section>
        </div>
      )}
      <IntegrationsPanel />
    </div>
  );
}

export function LlmsView() {
  const { notify } = usePortal();
  return <LlmsPanel notify={notify} />;
}
