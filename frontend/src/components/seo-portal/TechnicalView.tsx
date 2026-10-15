"use client";

// Technical SEO: robots.txt, sitemap, crawler access, llms.txt, canonical, verification tag, the
// Google tag, mobile viewport, response time, real 404s and the http/www redirects, checked live
// against the site. The checks only read; the one setting changed here is per-crawler access for AI
// crawlers (search engines can't be blocked), with a preview of robots.txt and a confirmation.

import { useCallback, useEffect, useId, useState } from "react";
import { Chip, Panel, errorOf, portalApi, primaryBtn, quietBtn, when } from "@/components/admin/seo/shared";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

type Status = "pass" | "warn" | "fail" | "info" | "not_checked";
interface Check {
  id: string;
  group: string;
  label: string;
  status: Status;
  message: string;
}
interface Result {
  checkedAt: string;
  baseUrl: string;
  canonicalOrigin: string;
  siteUrl: string | null;
  blockAll: boolean;
  counts: Record<Status, number>;
  checks: Check[];
}
interface Crawlers {
  crawlers: { agent: string; note: string; kind: "search" | "ai"; rule: "allow" | "block" }[];
  blocked: string[];
  preview: string;
}

const STYLE: Record<Status, [string, string]> = {
  pass: ["Pass", "bg-ocean-50 text-ocean-800"],
  warn: ["Warning", "bg-summit-100 text-obsidian-900"],
  fail: ["Fail", "bg-red-50 text-red-800"],
  info: ["Note", "bg-obsidian-100 text-slate-700"],
  not_checked: ["Not checked", "bg-obsidian-100 text-slate-700"],
};

function CrawlerAccess({ initial }: { initial: Crawlers }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const [rules, setRules] = useState<Record<string, "allow" | "block">>(Object.fromEntries(initial.crawlers.map((c) => [c.agent, c.rule])));
  const [current, setCurrent] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = current.crawlers.some((c) => rules[c.agent] !== c.rule);
  const newlyBlocked = current.crawlers.filter((c) => rules[c.agent] === "block" && c.rule !== "block");

  async function save() {
    setBusy(true);
    setError("");
    const res = await portalApi<{ crawlers: Crawlers }>("/crawlers", "PUT", { rules, confirm });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save the crawler rules."));
    setCurrent(res.data.crawlers);
    setConfirm(false);
    notify("Crawler rules saved. robots.txt changes within a minute.");
  }

  return (
    <Panel id={`${uid}-crawlers`} title="Crawler access" description="By default every crawler may read the site. Search engines always stay allowed. Blocking an AI crawler removes the site from that service's answers.">
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
        <ul className="space-y-3">
          {current.crawlers.map((c) => (
            <li key={c.agent} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <span className="block font-mono text-base text-obsidian-900">{c.agent}</span>
                <span className="text-sm text-slate-600">{c.note}</span>
              </span>
              {c.kind === "search" ? (
                <Chip className="bg-ocean-50 text-ocean-800">Always allowed</Chip>
              ) : (
                <span className="flex gap-1" role="group" aria-label={`${c.agent} access`}>
                  {(["allow", "block"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={!me.seo.manage}
                      aria-pressed={rules[c.agent] === v}
                      onClick={() => setRules((r) => ({ ...r, [c.agent]: v }))}
                      className={`h-10 rounded-full px-4 text-sm ${rules[c.agent] === v ? "bg-obsidian-900 text-white" : "border border-obsidian-900/10 bg-white text-obsidian-900"}`}
                    >
                      {v === "allow" ? "Allow" : "Block"}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-1.5 text-sm text-slate-700">robots.txt with the saved rules (on the canonical domain)</p>
          <pre className="max-h-80 overflow-auto rounded-xl bg-obsidian-950 p-4 text-sm text-white/90">{current.preview}</pre>
        </div>
      </div>
      {me.seo.manage && changed && (
        <div className="space-y-3 border-t border-obsidian-900/[0.06] px-6 py-5">
          {newlyBlocked.length > 0 && (
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
              <span className="text-base text-obsidian-900">I understand {newlyBlocked.map((c) => c.agent).join(", ")} will stop reading the site.</span>
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="button" onClick={() => void save()} disabled={busy || (newlyBlocked.length > 0 && !confirm)} className={primaryBtn}>
            {busy ? "Saving…" : "Save crawler rules"}
          </button>
        </div>
      )}
    </Panel>
  );
}

export function TechnicalView() {
  const { me } = usePortal();
  const [result, setResult] = useState<Result | null>(null);
  const [crawlers, setCrawlers] = useState<Crawlers | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await portalApi<{ result: Result | null; crawlers: Crawlers }>("/technical");
    if (res.ok) {
      setResult(res.data.result);
      setCrawlers(res.data.crawlers);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run() {
    setBusy(true);
    setError("");
    const res = await portalApi<{ result: Result }>("/technical/run", "POST", {});
    setBusy(false);
    if (res.ok) setResult(res.data.result);
    else setError(errorOf(res.data, "Couldn't run the checks."));
  }

  const groups = result ? Array.from(new Set(result.checks.map((c) => c.group))) : [];
  return (
    <div className="space-y-6">
      <PortalHeading
        title="Technical SEO"
        intro="Live checks of what crawlers see. Nothing here changes the site; fixes to DNS, HTTPS or the server are listed for whoever runs the server."
        actions={
          me.seo.manage && (
            <button type="button" onClick={() => void run()} disabled={busy} className={primaryBtn}>
              {busy ? "Checking…" : "Run checks"}
            </button>
          )
        }
      />
      {error && <p className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-800">{error}</p>}
      {!result ? (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-slate-600 ring-1 ring-obsidian-900/10">Not checked yet. {me.seo.manage ? "Run the checks to see the results." : "An SEO manager can run them."}</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Checked {when(result.checkedAt)} against {result.baseUrl}. Canonical domain: {result.canonicalOrigin}. {result.counts.fail} failing, {result.counts.warn} warnings, {result.counts.pass} passing.
          </p>
          {groups.map((g) => (
            <Panel key={g} id={`tech-${g.replace(/\W+/g, "-")}`} title={g}>
              <ul className="divide-y divide-obsidian-900/[0.06]">
                {result.checks
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start gap-3 px-6 py-3">
                      <Chip className={STYLE[c.status][1]}>{STYLE[c.status][0]}</Chip>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base text-obsidian-900">{c.label}</span>
                        <span className="block break-words text-sm text-slate-700">{c.message}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </Panel>
          ))}
        </>
      )}
      {crawlers && <CrawlerAccess initial={crawlers} />}
      <button type="button" onClick={() => void load()} className={quietBtn}>
        Refresh
      </button>
    </div>
  );
}
