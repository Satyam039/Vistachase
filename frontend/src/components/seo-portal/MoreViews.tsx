"use client";

// Redirects (with Webflow import, reviewed activation, CSV export and history) and Images & alt
// text (read-only inventory) in the SEO portal.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { RedirectsPanel } from "@/components/admin/seo/RedirectsPanel";
import { Chip, Empty, Grid, Loading, Panel, Stat, errorOf, field, labelCls, portalApi, primaryBtn, seoApi, when, words } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";
import { ImportPanel } from "@/components/seo-portal/ImportPanel";

// ---------------------------------------------------------------------------------------------
// Redirects

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  active: boolean;
  source: string;
  note: string | null;
}

interface HistoryRow {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  by: string | null;
  at: string;
}

function ReviewImported({ onChanged }: { onChanged: () => void }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const [rows, setRows] = useState<Redirect[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await seoApi<{ redirects: Redirect[] }>("/redirects");
    if (res.ok) setRows(res.data.redirects.filter((r) => !r.active && r.source === "IMPORT"));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function activate() {
    setBusy(true);
    setError("");
    const res = await portalApi<{ result: { activated: number; failed: { id: string; error: string }[] } }>("/redirects/activate", "POST", { ids: Array.from(picked), confirm: true });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't switch them on."));
    const { activated, failed } = res.data.result;
    notify(`${activated} redirect${activated === 1 ? "" : "s"} switched on${failed.length ? `; ${failed.length} refused (${failed[0].error})` : ""}. Switching one off again undoes it.`);
    setPicked(new Set());
    setConfirm(false);
    void load();
    onChanged();
  }

  if (!rows || rows.length === 0) return null;
  return (
    <Panel id={`${uid}-review`} title="Imported redirects waiting for review" description="Saved switched off. Tick the ones that are right and switch them on; the same checks as a hand-made redirect apply.">
      <Grid label="Imported redirects that are off" head={[[""], ["From"], ["To"], ["Note"]]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-6 py-2">
              <input
                type="checkbox"
                aria-label={`Select ${r.fromPath}`}
                disabled={!me.seo.manage}
                checked={picked.has(r.id)}
                onChange={(e) =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (e.target.checked) n.add(r.id);
                    else n.delete(r.id);
                    return n;
                  })
                }
                className="h-5 w-5 accent-ocean-600"
              />
            </td>
            <td className="px-6 py-2 font-mono text-sm">{r.fromPath}</td>
            <td className="px-6 py-2 font-mono text-sm">
              {r.toPath} <span className="text-slate-500">({r.statusCode})</span>
            </td>
            <td className="px-6 py-2 text-sm text-slate-600">{r.note}</td>
          </tr>
        ))}
      </Grid>
      {me.seo.manage && (
        <div className="space-y-3 border-t border-obsidian-900/[0.06] px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPicked(new Set(rows.map((r) => r.id)))} className="text-sm text-ocean-700 underline underline-offset-2">
              Select all
            </button>
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
            <span className="text-base text-obsidian-900">I checked these against the Webflow redirect list</span>
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="button" onClick={() => void activate()} disabled={!confirm || picked.size === 0 || busy} className={primaryBtn}>
            {busy ? "Switching on…" : `Switch on ${picked.size}`}
          </button>
        </div>
      )}
    </Panel>
  );
}

function RedirectHistory({ version }: { version: number }) {
  const uid = useId();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  useEffect(() => {
    void portalApi<{ history: HistoryRow[] }>("/redirects/history").then((r) => r.ok && setRows(r.data.history));
  }, [version]);
  return (
    <Panel id={`${uid}-history`} title="Redirect history" description="Every redirect created, changed, switched on or off, or deleted.">
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No changes yet.</Empty>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {rows.slice(0, 50).map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 px-6 py-3 text-sm">
              <span>
                {words(r.action.replace(/^SEO_/, ""))}
                {r.details?.fromPath ? ` · ${String(r.details.fromPath)}` : ""}
                {r.details?.toPath ? ` → ${String(r.details.toPath)}` : ""}
              </span>
              <span className="text-slate-600">
                {r.by ?? "System"} · {when(r.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function RedirectsView() {
  const { notify } = usePortal();
  const [version, setVersion] = useState(0);
  return (
    <div className="space-y-6">
      <PortalHeading
        title="Redirects"
        intro="Old address → new address, applied by the site within a minute. The server refuses loops, long chains, staff areas and redirects that would hide a live page."
        actions={
          <a href="/api/seo/portal/redirects/export.csv" className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-5 text-sm text-obsidian-900 hover:bg-obsidian-50">
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </a>
        }
      />
      <RedirectsPanel key={version} notify={notify} />
      <ReviewImported onChanged={() => setVersion((v) => v + 1)} />
      <ImportPanel kind="REDIRECTS" />
      <RedirectHistory version={version} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Images

interface ImageRow {
  src: string;
  kind: string;
  pages: string[];
  alts: (string | null)[];
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  webflow: boolean;
  localCopy: string | null;
  flags: string[];
  recommendations: string[];
}

interface ImageData {
  images: ImageRow[];
  summary: { images: number; pagesCrawled: number; missingAlt: number; filenameAlt: number; webflowCdn: number; webflowWithLocalCopy: number; broken: number; large: number; library: { files: number; fromWebflow: number; filenameAlt: number } };
  note: string;
}

const FLAG_LABEL: Record<string, string> = {
  "missing-alt": "No alt text",
  "filename-alt": "Alt text is a file name",
  "webflow-cdn": "On Webflow's CDN",
  external: "Hosted elsewhere",
  broken: "Broken",
  large: "Large file",
};

export function ImagesView() {
  const uid = useId();
  const [data, setData] = useState<ImageData | null>(null);
  const [flag, setFlag] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    void portalApi<ImageData>("/images").then((r) => r.ok && setData(r.data));
  }, []);
  const rows = useMemo(() => (data?.images ?? []).filter((r) => (!flag || r.flags.includes(flag)) && (!q || r.src.toLowerCase().includes(q.toLowerCase()) || r.pages.some((p) => p.includes(q)))), [data, flag, q]);
  const s = data?.summary;
  return (
    <div className="space-y-6">
      <PortalHeading title="Images & alt text" intro={data?.note ?? "Every image the audit found, with its alt text and what to fix."} />
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Images found" value={s.images} hint={`on ${s.pagesCrawled} audited pages`} />
          <Stat label="Alt text problems" value={s.missingAlt + s.filenameAlt} hint={`${s.missingAlt} missing · ${s.filenameAlt} file names`} tone={s.missingAlt + s.filenameAlt ? "warn" : "good"} />
          <Stat label="Still on Webflow's CDN" value={s.webflowCdn} hint={`${s.webflowWithLocalCopy} already have a local copy`} tone={s.webflowCdn ? "warn" : "good"} />
          <Stat label="Broken or large" value={s.broken + s.large} hint={`${s.broken} broken · ${s.large} over 400 KB`} tone={s.broken ? "bad" : s.large ? "warn" : "good"} />
        </div>
      )}
      <Panel id={`${uid}-images`} title="Images">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-q`} className={labelCls}>
              Search by file or page
            </label>
            <input id={`${uid}-q`} value={q} onChange={(e) => setQ(e.target.value)} className={field} />
          </div>
          <Dropdown id={`${uid}-flag`} label="Show" options={[{ value: "", label: "All images" }, ...Object.entries(FLAG_LABEL).map(([value, label]) => ({ value, label }))]} value={flag} onChange={setFlag} />
        </div>
        {!data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>{data.images.length ? "No images match." : "No images yet: run a website audit first."}</Empty>
        ) : (
          <Grid label="Images" head={[["Image"], ["Alt text"], ["Used on"], ["Fix"]]} minWidth="min-w-[60rem]">
            {rows.slice(0, 500).map((r) => (
              <tr key={`${r.kind}-${r.src}`} className="align-top">
                <td className="max-w-xs px-6 py-3">
                  <span className="block break-all font-mono text-sm">{r.src}</span>
                  <span className="text-sm text-slate-600">
                    {words(r.kind)}
                    {r.format ? ` · ${r.format}` : ""}
                    {r.width && r.height ? ` · ${r.width}×${r.height}` : ""}
                    {r.bytes ? ` · ${Math.round(r.bytes / 1024)} KB` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.flags.map((f) => (
                      <Chip key={f} className={f === "broken" ? "bg-red-50 text-red-800" : "bg-summit-100 text-obsidian-900"}>
                        {FLAG_LABEL[f] ?? f}
                      </Chip>
                    ))}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-slate-700">{Array.from(new Set(r.alts.map((a) => a ?? "(none)"))).join(" / ") || "–"}</td>
                <td className="px-6 py-3 font-mono text-sm text-slate-700">
                  {r.pages.slice(0, 4).map((p) => (
                    <span key={p} className="block">
                      {p}
                    </span>
                  ))}
                  {r.pages.length > 4 && <span className="text-slate-600">+{r.pages.length - 4} more</span>}
                </td>
                <td className="px-6 py-3 text-sm text-slate-700">
                  <ul className="space-y-1">
                    {r.recommendations.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
      {s && (
        <p className="text-sm text-slate-600">
          Media library: {s.library.files} files, {s.library.fromWebflow} copied from Webflow, {s.library.filenameAlt} with file-name alt text (backend/media/manifest.json).
        </p>
      )}
    </div>
  );
}
