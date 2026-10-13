"use client";

// Site audit (/admin/seo): run an audit on demand, work through the issues it found, and read the
// history of past runs. Every figure here comes from the audit itself, never from search engines.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Grid, Loading, Panel, SEVERITY_STYLE, Stat, errorOf, primaryBtn, quietBtn, seoApi, when, words, type AuditRun, type Issue, type Severity } from "./shared";

type IssueStatus = Issue["status"];

const SIGNED_OUT = "Sign in with an admin account.";
const signedOut = (status: number) => status === 401 || status === 403;

const STATUSES: { value: IssueStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IGNORED", label: "Ignored" },
  { value: "RESOLVED", label: "Resolved" },
];

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}

const num = (v: number | undefined) => (typeof v === "number" ? v.toLocaleString("en-CA") : "–");

export function AuditPanel({ notify, initialSeverity }: { notify: (m: string) => void; initialSeverity?: Severity }) {
  const [status, setStatus] = useState<IssueStatus>("OPEN");
  const [severity, setSeverity] = useState<string>(initialSeverity ?? "");
  const [type, setType] = useState("");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [knownTypes, setKnownTypes] = useState<string[]>([]);
  const [audits, setAudits] = useState<AuditRun[] | null>(null);
  const [error, setError] = useState("");
  const [runError, setRunError] = useState("");
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AuditRun | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadIssues = useCallback(async () => {
    const q = new URLSearchParams({ status });
    if (severity) q.set("severity", severity);
    if (type) q.set("type", type);
    const { ok, status: code, data } = await seoApi<{ issues: Issue[] }>(`/issues?${q.toString()}`);
    if (ok) {
      const list = data.issues ?? [];
      setIssues(list);
      setKnownTypes((prev) => Array.from(new Set([...prev, ...list.map((i) => i.type)])).sort());
      setError("");
    } else {
      setIssues([]);
      setError(signedOut(code) ? SIGNED_OUT : errorOf(data, "Couldn't load issues."));
    }
  }, [status, severity, type]);

  const loadAudits = useCallback(async () => {
    const { ok, status: code, data } = await seoApi<{ audits: AuditRun[] }>("/audits");
    if (ok) setAudits(data.audits ?? []);
    else {
      setAudits([]);
      if (signedOut(code)) setError(SIGNED_OUT);
    }
  }, []);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    void loadAudits();
  }, [loadAudits]);

  const typeOptions = useMemo(() => [{ value: "", label: "All types" }, ...knownTypes.map((t) => ({ value: t, label: words(t) }))], [knownTypes]);

  async function runNow() {
    setRunning(true);
    setRunError("");
    const { ok, status: code, data } = await seoApi<{ run?: AuditRun }>("/audits", "POST");
    setRunning(false);
    if (data.run) setLastRun(data.run);
    if (!ok) {
      if (signedOut(code)) setRunError(SIGNED_OUT);
      else if (code === 409) setRunError("An audit is already running. Give it a few minutes, then refresh the history below.");
      else if (code === 429) setRunError("Too many audits in the last hour. Please wait a while before running another.");
      else setRunError(errorOf(data, "Couldn't run the audit."));
      void loadAudits();
      return;
    }
    notify(data.run?.status === "FAILED" ? "The audit failed. See the history for the reason." : "Audit finished.");
    void loadAudits();
    void loadIssues();
  }

  async function setIssueStatus(issue: Issue, next: "OPEN" | "IGNORED") {
    setBusyId(issue.id);
    const { ok, status: code, data } = await seoApi(`/issues/${issue.id}`, "PATCH", { status: next });
    setBusyId(null);
    if (!ok) return setError(signedOut(code) ? SIGNED_OUT : errorOf(data, "Couldn't update the issue."));
    notify(next === "IGNORED" ? "Issue ignored." : "Issue reopened.");
    void loadIssues();
  }

  const s = lastRun?.summary;

  return (
    <div className="space-y-6">
      <Panel
        id="seo-audit-run"
        title="Site audit"
        description="Audits read the live pages of this site (SEO_AUDIT_BASE_URL) and the SEO records. A nightly audit runs at 04:00 Mountain Time."
        actions={
          <button type="button" onClick={() => void runNow()} disabled={running} className={primaryBtn}>
            {running ? "Running audit…" : "Run audit now"}
          </button>
        }
      >
        <div className="space-y-4 px-6 py-5" aria-live="polite">
          {runError && <Alert>{runError}</Alert>}
          {running && <p className="text-sm text-slate-600">Checking pages and links. This can take a minute.</p>}
          {lastRun && !running && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Latest run: {words(lastRun.status)}, started {when(lastRun.startedAt)}
                {lastRun.baseUrl ? ` against ${lastRun.baseUrl}` : ""}.
              </p>
              {lastRun.error && <p className="text-sm text-red-800">{lastRun.error}</p>}
              {s && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Pages checked" value={num(s.pagesChecked)} hint={`${num(s.pagesReachable)} reachable`} />
                  <Stat label="Links checked" value={num(s.linksChecked)} hint={`${num(s.brokenLinks)} broken`} tone={s.brokenLinks ? "bad" : undefined} />
                  <Stat label="Issues found" value={num(s.issues)} tone={s.issues ? "warn" : "good"} />
                  <Stat label="Resolved by this run" value={num(s.resolved)} tone={s.resolved ? "good" : undefined} />
                </div>
              )}
              {s?.crawlNote && <p className="text-sm text-slate-600">{s.crawlNote}</p>}
            </div>
          )}
          {!lastRun && !running && !runError && <p className="text-sm text-slate-600">Run an audit to check every page now, or wait for the nightly run.</p>}
        </div>
      </Panel>

      <Panel id="seo-issues" title="Issues" description="Problems the audits found. Fixed issues resolve on the next audit; ignore the ones you have decided to live with.">
        <div className="flex flex-wrap items-end gap-4 px-6 py-5">
          <div role="group" aria-label="Issue status" className="flex flex-wrap gap-2">
            {STATUSES.map((st) => (
              <button
                key={st.value}
                type="button"
                aria-pressed={status === st.value}
                onClick={() => setStatus(st.value)}
                className={status === st.value ? `${quietBtn} border-ocean-600 bg-ocean-50 text-ocean-800 hover:bg-ocean-50` : quietBtn}
              >
                {st.label}
              </button>
            ))}
          </div>
          <div className="w-48">
            <Dropdown
              id="issue-severity"
              label="Severity"
              variant="pill"
              value={severity}
              onChange={setSeverity}
              options={[{ value: "", label: "All severities" }, ...SEVERITIES.map((v) => ({ value: v, label: words(v) }))]}
            />
          </div>
          <div className="w-64">
            <Dropdown id="issue-type" label="Type" variant="pill" value={type} onChange={setType} options={typeOptions} searchable={typeOptions.length > 8} />
          </div>
        </div>
        {error && (
          <div className="px-6 pb-5">
            <Alert>{error}</Alert>
          </div>
        )}
        {issues === null ? (
          <Loading />
        ) : issues.length === 0 ? (
          <Empty>No {words(status).toLowerCase()} issues{severity || type ? " match these filters" : ""}.</Empty>
        ) : (
          <Grid label="Issues" minWidth="min-w-[68rem]" head={[["Severity"], ["Type"], ["Page"], ["Message"], ["First seen"], ["Last seen"], ["", true]]}>
            {issues.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="px-6 py-4">
                  <Chip className={SEVERITY_STYLE[i.severity]}>{words(i.severity)}</Chip>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{words(i.type)}</td>
                <td className="px-6 py-4">
                  {i.page?.label && <span className="block">{i.page.label}</span>}
                  {i.path ? (
                    <a href={i.path} target="_blank" rel="noopener noreferrer" className="font-code text-sm text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
                      {i.path}
                      <span className="sr-only"> (opens the live page in a new tab)</span>
                    </a>
                  ) : (
                    !i.page?.label && <span className="text-slate-500">Site-wide</span>
                  )}
                  {i.pageId && (
                    <Link href={`/admin/seo/pages/${i.pageId}`} className="mt-1 block text-sm text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
                      Edit<span className="sr-only"> {i.page?.label ?? i.path ?? "page"}</span>
                    </Link>
                  )}
                </td>
                <td className="max-w-md px-6 py-4 text-sm text-slate-700">{i.message}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{when(i.firstSeenAt)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{when(i.lastSeenAt)}</td>
                <td className="px-6 py-4 text-right">
                  {i.status === "OPEN" && (
                    <button type="button" disabled={busyId === i.id} onClick={() => void setIssueStatus(i, "IGNORED")} className={quietBtn} aria-label={`Ignore: ${i.message}`}>
                      Ignore
                    </button>
                  )}
                  {i.status === "IGNORED" && (
                    <button type="button" disabled={busyId === i.id} onClick={() => void setIssueStatus(i, "OPEN")} className={quietBtn} aria-label={`Reopen: ${i.message}`}>
                      Reopen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>

      <Panel id="seo-audit-history" title="Audit history" description="The last 30 audits, newest first.">
        {audits === null ? (
          <Loading />
        ) : audits.length === 0 ? (
          <Empty>No audits have run yet.</Empty>
        ) : (
          <Grid
            label="Audit history"
            minWidth="min-w-[78rem]"
            head={[["Started"], ["Trigger"], ["Status"], ["Pages checked", true], ["Reachable", true], ["Links checked", true], ["Broken links", true], ["Issues", true], ["Resolved", true], ["Note"]]}
          >
            {audits.map((a) => (
              <tr key={a.id} className="align-top">
                <td className="whitespace-nowrap px-6 py-4 text-sm">{when(a.startedAt)}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{words(a.trigger)}</td>
                <td className="px-6 py-4">
                  <Chip className={a.status === "FAILED" ? "bg-red-50 text-red-800" : a.status === "RUNNING" ? "bg-summit-100 text-obsidian-900" : "bg-ocean-50 text-ocean-800"}>{words(a.status)}</Chip>
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{num(a.summary?.pagesChecked)}</td>
                <td className="px-6 py-4 text-right tabular-nums">{num(a.summary?.pagesReachable)}</td>
                <td className="px-6 py-4 text-right tabular-nums">{num(a.summary?.linksChecked)}</td>
                <td className="px-6 py-4 text-right tabular-nums">{num(a.summary?.brokenLinks)}</td>
                <td className="px-6 py-4 text-right tabular-nums">{num(a.summary?.issues)}</td>
                <td className="px-6 py-4 text-right tabular-nums">{num(a.summary?.resolved)}</td>
                <td className="max-w-sm px-6 py-4 text-sm text-slate-700">{a.error ? <span className="text-red-800">{a.error}</span> : a.summary?.crawlNote || "–"}</td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
    </div>
  );
}
