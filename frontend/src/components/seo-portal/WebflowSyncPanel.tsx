"use client";

// Webflow sync on the portal's Blog posts screen: whether the automatic sync is on, the last runs and
// a "Sync now" button for SEO managers. The sync reads Webflow's blog CMS with the server's token and
// brings published posts here (rules in docs/SEO_PORTAL.md, "Webflow sync"); the token never reaches
// the browser.

import { useCallback, useEffect, useId, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Panel, errorOf, portalApi, primaryBtn, when } from "@/components/admin/seo/shared";
import { usePortal } from "@/components/seo-portal/PortalShell";

interface Run {
  at: string;
  trigger: "SCHEDULED" | "MANUAL";
  webflowPublished: number;
  created: string[];
  updated: string[];
  drafted: string[];
  linked: string[];
  offline: string[];
  unchanged: number;
  skipped: { ref: string; path: string | null; reason: string }[];
  notes: string[];
}

interface Status {
  configured: boolean;
  scheduled: boolean;
  everyMinutes: number;
  linkedPosts: number;
  running: boolean;
  lastRuns: Run[];
  lastFailure: { at: string; error: string } | null;
}

const summary = (r: Run) =>
  [
    `${r.webflowPublished} published in Webflow`,
    `${r.created.length} added`,
    `${r.updated.length} updated`,
    `${r.drafted.length} sent to drafts for review`,
    `${r.linked.length} linked`,
    `${r.offline.length} taken offline`,
    `${r.unchanged} unchanged`,
    `${r.skipped.length} skipped`,
  ].join(", ");

export function WebflowSyncPanel() {
  const uid = useId();
  const { me, notify } = usePortal();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await portalApi<{ sync: Status }>("/webflow/sync");
    if (res.ok) setStatus(res.data.sync);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    setBusy(true);
    setError("");
    const res = await portalApi<{ result: Run }>("/webflow/sync", "POST", {});
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "The sync didn't finish. Try again."));
    notify(`Webflow sync done: ${summary(res.data.result)}.`);
    void load();
  }

  if (!status) return null;
  const last = status.lastRuns[0];
  const lines = last
    ? [
        ...last.created.map((p) => `Added ${p}`),
        ...last.updated.map((p) => `Updated ${p}`),
        ...last.drafted.map((p) => `Draft to review on ${p}`),
        ...last.offline.map((p) => `Taken offline (unpublished in Webflow): ${p}`),
        ...last.skipped.map((s) => `Skipped ${s.path ?? s.ref}: ${s.reason}`),
        ...last.notes,
      ]
    : [];

  return (
    <Panel
      id={`${uid}-sync`}
      title="Webflow sync"
      description="Posts published in Webflow's Blog Posts collection appear here and on the site at the same address. Drafts and archived items are never brought in."
      actions={
        me.seo.manage ? (
          <button type="button" onClick={() => void syncNow()} disabled={busy || !status.configured || status.running} className={primaryBtn}>
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            {busy ? "Syncing…" : "Sync now"}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4 px-6 py-6 text-sm text-slate-700">
        <p className={`rounded-2xl px-5 py-3 ${status.configured ? "bg-ocean-50 text-ocean-800" : "bg-summit-100 text-obsidian-900"}`}>
          {!status.configured
            ? "Not connected: the server has no Webflow API token (WEBFLOW_API_TOKEN), so nothing syncs. Posts written in this portal publish as usual."
            : status.scheduled
              ? `On: the server checks Webflow every ${status.everyMinutes} minutes. ${status.linkedPosts} post${status.linkedPosts === 1 ? " is" : "s are"} linked to Webflow.`
              : `Connected, but the automatic sync is off (WEBFLOW_SYNC_ENABLED). Use Sync now, or ask an admin to switch it on. ${status.linkedPosts} post${status.linkedPosts === 1 ? " is" : "s are"} linked to Webflow.`}
        </p>
        <p>A post someone has changed here keeps your changes: Webflow&apos;s newer version waits as a draft to review. Addresses are never changed by the sync.</p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {status.lastFailure && (
          <p role="status" className="text-red-700">
            Last scheduled run failed {when(status.lastFailure.at)}: {status.lastFailure.error}
          </p>
        )}
        {last ? (
          <div className="space-y-2">
            <p className="text-obsidian-900">
              Last run {when(last.at)} ({last.trigger === "MANUAL" ? "Sync now" : "automatic"}): {summary(last)}.
            </p>
            {lines.length > 0 && (
              <ul className="list-disc space-y-1 pl-6">
                {lines.slice(0, 30).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p>No sync has run yet.</p>
        )}
      </div>
    </Panel>
  );
}
