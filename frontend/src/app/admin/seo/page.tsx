"use client";

// Admin SEO dashboard: overview, pages (editor at /admin/seo/pages/[id]), keyword map, clusters,
// redirects, audits and issues, llms.txt and the search data providers. Panels live in
// components/admin/seo; every action goes through /api/seo/admin/* (SEO managers and admins change it, editors write copy, viewers read; audited).

import { useCallback, useEffect, useState } from "react";
import { AdminHeader, StaffSignIn } from "@/components/admin/AdminHeader";
import { OverviewPanel, type SectionId } from "@/components/admin/seo/OverviewPanel";
import { PagesPanel } from "@/components/admin/seo/PagesPanel";
import { ClustersPanel, KeywordsPanel } from "@/components/admin/seo/KeywordsPanel";
import { RedirectsPanel } from "@/components/admin/seo/RedirectsPanel";
import { AuditPanel } from "@/components/admin/seo/AuditPanel";
import { IntegrationsPanel, LlmsPanel } from "@/components/admin/seo/LlmsPanel";

const SECTIONS: [SectionId, string][] = [
  ["overview", "Overview"],
  ["pages", "Pages"],
  ["keywords", "Keywords"],
  ["clusters", "Clusters"],
  ["redirects", "Redirects"],
  ["audit", "Audit & issues"],
  ["llms", "llms.txt & business info"],
  ["integrations", "Search data"],
];
const isSection = (s: string): s is SectionId => SECTIONS.some(([id]) => id === s);

export default function AdminSeoPage() {
  const [section, setSection] = useState<SectionId>("overview");
  const [access, setAccess] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [me, setMe] = useState<{ role: string; seo: { manage: boolean; editContent: boolean } } | null>(null);

  // The section is kept in the address (#keywords) so it survives reloads and can be linked.
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      if (isSection(hash)) setSection(hash);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const goTo = useCallback((id: SectionId) => {
    setSection(id);
    setMessage("");
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  useEffect(() => {
    fetch("/api/seo/admin/me")
      .then(async (res) => {
        if (res.ok) setMe(await res.json());
        setAccess(res.status === 401 || res.status === 403 ? "denied" : res.ok ? "ok" : "error");
      })
      .catch(() => setAccess("error"));
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <AdminHeader
        current="/admin/seo"
        eyebrow="Staff · SEO"
        title="SEO"
        subtitle="Page metadata, the keyword map, redirects, audits and llms.txt. Every figure comes from Vista Chase's own pages and records; no ranking or traffic data is shown until a provider is connected."
      />

      <div className="mx-auto max-w-7xl space-y-6 px-page py-8 sm:py-10">
        {access === "denied" && <StaffSignIn body="Sign in with an SEO manager, editor, viewer or admin account." />}
        {access === "error" && (
          <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            Couldn&apos;t reach the SEO service. Try again in a moment.
          </p>
        )}
        <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
          {message}
        </p>

        {access === "ok" && me && !me.seo.manage && (
          <p className="rounded-2xl bg-white px-5 py-3 text-sm text-obsidian-700 ring-1 ring-obsidian-900/10">
            {me.seo.editContent
              ? "You're signed in as an editor: you can write page copy, FAQs and guides. Titles, URLs, keywords, redirects and publishing stay with the SEO manager."
              : "You're signed in as a viewer: you can see everything here but not change it."}
          </p>
        )}

        {access === "ok" && (
          <>
            <div role="tablist" aria-label="SEO sections" className="flex gap-2 overflow-x-auto pb-1">
              {SECTIONS.map(([id, name]) => (
                <button
                  key={id}
                  id={`seo-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={section === id}
                  aria-controls={`seo-panel-${id}`}
                  onClick={() => goTo(id)}
                  className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm ${
                    section === id ? "border-obsidian-900 bg-obsidian-900 text-white" : "border-obsidian-900/10 bg-white text-obsidian-900 hover:border-obsidian-900/40"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div id={`seo-panel-${section}`} role="tabpanel" aria-labelledby={`seo-tab-${section}`}>
              {section === "overview" && <OverviewPanel notify={setMessage} goTo={goTo} />}
              {section === "pages" && <PagesPanel notify={setMessage} />}
              {section === "keywords" && <KeywordsPanel notify={setMessage} canManage={me?.seo.manage ?? false} />}
              {section === "clusters" && <ClustersPanel notify={setMessage} />}
              {section === "redirects" && <RedirectsPanel notify={setMessage} />}
              {section === "audit" && <AuditPanel notify={setMessage} />}
              {section === "llms" && <LlmsPanel notify={setMessage} />}
              {section === "integrations" && <IntegrationsPanel />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
