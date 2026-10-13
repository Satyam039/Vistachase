"use client";

// Keyword research and clusters for /admin/seo. Keywords are entered or imported by staff:
// search volume and difficulty appear only when someone typed them in with a basis (estimate or
// researched) and, for researched figures, a named source. Nothing here is live ranking or traffic data.
// Every call goes through /api/seo/admin/*, which is admin-only and audited there.

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Download, Upload } from "lucide-react";
import { Dropdown, type DropdownOption } from "@/components/forms/Dropdown";
import {
  Chip,
  Empty,
  Grid,
  Loading,
  Metric,
  Panel,
  Stat,
  TRACK_LABEL,
  day,
  errorOf,
  field,
  labelCls,
  primaryBtn,
  quietBtn,
  dangerBtn,
  seoApi,
  words,
  type Cluster,
  type Keyword,
  type Track,
} from "@/components/admin/seo/shared";

const SIGNED_OUT = "Sign in with an admin account.";
const denied = (status: number) => status === 401 || status === 403;

const INTENTS = ["INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL"] as const;
const FUNNEL_STAGES = ["TOFU", "MOFU", "BOFU"] as const;
const TRACKS: Track[] = ["TRAFFIC_ACQUISITION", "BOOKING_CONVERSION"];
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const KEYWORD_STATUSES = ["IDEA", "PLANNED", "IN_PROGRESS", "IMPLEMENTED", "ARCHIVED"] as const;
const VALIDATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;
const METRIC_BASES = ["UNKNOWN", "ESTIMATE", "RESEARCHED"] as const;
const PAGE_TYPES = ["HOME", "TOUR", "DESTINATION", "LANDING", "GUIDE", "STATIC", "LEGAL"] as const;

const FUNNEL_LABEL: Record<string, string> = { TOFU: "Top of funnel", MOFU: "Middle of funnel", BOFU: "Bottom of funnel" };

const opts = (values: readonly string[], allLabel?: string, label: (v: string) => string = words): DropdownOption[] => [
  ...(allLabel !== undefined ? [{ value: "", label: allLabel }] : []),
  ...values.map((v) => ({ value: v, label: label(v) })),
];
const trackOpts = (allLabel?: string) => opts(TRACKS, allLabel, (v) => TRACK_LABEL[v as Track]);
const funnelOpts = (allLabel?: string) => opts(FUNNEL_STAGES, allLabel, (v) => FUNNEL_LABEL[v]);

const VALIDATION_STYLE: Record<Keyword["validationStatus"], string> = {
  VERIFIED: "bg-ocean-50 text-ocean-800",
  UNVERIFIED: "bg-obsidian-100 text-slate-700",
  REJECTED: "bg-red-50 text-red-800",
};
const PRIORITY_STYLE: Record<Keyword["priority"], string> = {
  HIGH: "bg-summit-100 text-obsidian-900",
  MEDIUM: "bg-ocean-50 text-ocean-800",
  LOW: "bg-obsidian-100 text-slate-700",
};

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}

function TextField({ id, label, children }: { id: string; label: string; children: (id: string) => ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Keyword form (add and edit)

type FormState = {
  keyword: string;
  designation: string;
  searchVolume: string;
  volumeBasis: string;
  volumeSource: string;
  difficulty: string;
  difficultyBasis: string;
  difficultySource: string;
  intent: string;
  funnelStage: string;
  track: string;
  clusterId: string;
  targetPath: string;
  targetPageType: string;
  priority: string;
  businessRelevance: string;
  competitionNotes: string;
  competitors: string;
  status: string;
  dataSource: string;
  lastVerifiedAt: string;
  validationStatus: string;
  notes: string;
};

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function fromKeyword(k?: Keyword): FormState {
  return {
    keyword: k?.keyword ?? "",
    designation: k?.designation ?? "SECONDARY",
    searchVolume: num(k?.searchVolume),
    volumeBasis: k?.volumeBasis ?? "UNKNOWN",
    volumeSource: k?.volumeSource ?? "",
    difficulty: num(k?.difficulty),
    difficultyBasis: k?.difficultyBasis ?? "UNKNOWN",
    difficultySource: k?.difficultySource ?? "",
    intent: k?.intent ?? "INFORMATIONAL",
    funnelStage: k?.funnelStage ?? "TOFU",
    track: k?.track ?? "TRAFFIC_ACQUISITION",
    clusterId: k?.cluster?.id ?? "",
    targetPath: k?.targetPath ?? "",
    targetPageType: k?.targetPageType ?? "",
    priority: k?.priority ?? "MEDIUM",
    businessRelevance: num(k?.businessRelevance),
    competitionNotes: k?.competitionNotes ?? "",
    competitors: k?.competitors.join(", ") ?? "",
    status: k?.status ?? "IDEA",
    dataSource: k?.dataSource ?? "",
    lastVerifiedAt: k?.lastVerifiedAt ? k.lastVerifiedAt.slice(0, 10) : "",
    validationStatus: k?.validationStatus ?? "UNVERIFIED",
    notes: k?.notes ?? "",
  };
}

const textOrNull = (v: string) => (v.trim() === "" ? null : v.trim());
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function toPayload(f: FormState): Record<string, unknown> {
  return {
    keyword: f.keyword.trim(),
    designation: f.designation,
    searchVolume: numOrNull(f.searchVolume),
    volumeBasis: f.volumeBasis,
    volumeSource: textOrNull(f.volumeSource),
    difficulty: numOrNull(f.difficulty),
    difficultyBasis: f.difficultyBasis,
    difficultySource: textOrNull(f.difficultySource),
    intent: f.intent,
    funnelStage: f.funnelStage,
    track: f.track,
    clusterId: f.clusterId || null,
    targetPath: textOrNull(f.targetPath),
    targetPageType: f.targetPageType || null,
    priority: f.priority,
    businessRelevance: numOrNull(f.businessRelevance),
    competitionNotes: textOrNull(f.competitionNotes),
    competitors: f.competitors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    status: f.status,
    dataSource: textOrNull(f.dataSource),
    lastVerifiedAt: f.lastVerifiedAt || null,
    validationStatus: f.validationStatus,
    notes: textOrNull(f.notes),
  };
}

// Fields the server checks together: when one changes, the whole group is sent.
const GROUPS = [
  ["searchVolume", "volumeBasis", "volumeSource"],
  ["difficulty", "difficultyBasis", "difficultySource"],
  ["validationStatus", "lastVerifiedAt"],
];

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changed = new Set(Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])));
  for (const group of GROUPS) if (group.some((k) => changed.has(k))) group.forEach((k) => changed.add(k));
  return Object.fromEntries(Array.from(changed).map((k) => [k, after[k]]));
}

/** The server's rules, shown as hints while typing. The server stays the authority. */
function hintsFor(f: FormState): string[] {
  const out: string[] = [];
  for (const [value, basis, source, name] of [
    [f.searchVolume, f.volumeBasis, f.volumeSource, "volume"],
    [f.difficulty, f.difficultyBasis, f.difficultySource, "difficulty"],
  ] as const) {
    const hasValue = value.trim() !== "";
    if (hasValue && !Number.isInteger(Number(value))) out.push(`The ${name} must be a whole number.`);
    if (hasValue && basis === "UNKNOWN") out.push(`A ${name} value needs a basis: Estimate or Researched.`);
    if (!hasValue && basis !== "UNKNOWN") out.push(`No ${name} value, so its basis must be Unknown.`);
    if (basis === "RESEARCHED" && !source.trim()) out.push(`A researched ${name} needs a source (for example Google Keyword Planner).`);
  }
  if (f.difficulty.trim() !== "" && (Number(f.difficulty) < 0 || Number(f.difficulty) > 100)) out.push("Difficulty runs from 0 to 100.");
  if (f.validationStatus === "VERIFIED" && !f.lastVerifiedAt) out.push("A verified keyword needs the date it was checked.");
  return out;
}

function KeywordForm({
  keyword,
  clusters,
  onDone,
  onCancel,
  onSignedOut,
  notify,
}: {
  keyword?: Keyword;
  clusters: Cluster[];
  onDone: () => void;
  onCancel: () => void;
  onSignedOut: () => void;
  notify: (m: string) => void;
}) {
  const [f, setF] = useState<FormState>(() => fromKeyword(keyword));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof FormState) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));
  const input = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value);
  const pre = keyword ? `kw-${keyword.id}` : "kw-new";
  const hints = hintsFor(f);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (f.keyword.trim().length < 2) return setError("Enter the keyword.");
    const payload = toPayload(f);
    let body = payload;
    if (keyword) {
      body = changedFields(toPayload(fromKeyword(keyword)), payload);
      if (Object.keys(body).length === 0) {
        notify("No changes to save.");
        return onCancel();
      }
    }
    setBusy(true);
    const { ok, status, data } = await seoApi(keyword ? `/keywords/${keyword.id}` : "/keywords", keyword ? "PATCH" : "POST", body);
    setBusy(false);
    if (denied(status)) return onSignedOut();
    if (!ok) return setError(errorOf(data, keyword ? "Couldn't save the keyword." : "Couldn't add the keyword."));
    notify(keyword ? `"${payload.keyword}" was updated.` : `"${payload.keyword}" was added.`);
    onDone();
  }

  const clusterOptions: DropdownOption[] = [{ value: "", label: "No cluster" }, ...clusters.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <form onSubmit={submit} noValidate aria-label={keyword ? `Edit ${keyword.keyword}` : "Add a keyword"} className="space-y-5 bg-obsidian-50/60 px-6 py-6">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-3">
        <TextField id={`${pre}-keyword`} label="Keyword">
          {(id) => <input id={id} value={f.keyword} onChange={input("keyword")} required maxLength={150} className={field} />}
        </TextField>
        <Dropdown id={`${pre}-designation`} label="Designation" value={f.designation} onChange={set("designation")} options={opts(["PRIMARY", "SECONDARY"])} />
        <Dropdown id={`${pre}-track`} label="Track" value={f.track} onChange={set("track")} options={trackOpts()} />
        <Dropdown id={`${pre}-intent`} label="Intent" value={f.intent} onChange={set("intent")} options={opts(INTENTS)} />
        <Dropdown id={`${pre}-funnel`} label="Funnel stage" value={f.funnelStage} onChange={set("funnelStage")} options={funnelOpts()} />
        <Dropdown id={`${pre}-cluster`} label="Cluster" value={f.clusterId} onChange={set("clusterId")} options={clusterOptions} searchable />
      </div>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-base text-obsidian-900">Search volume (monthly)</legend>
        <TextField id={`${pre}-volume`} label="Volume (blank = unknown)">
          {(id) => <input id={id} type="number" inputMode="numeric" min={0} step={1} value={f.searchVolume} onChange={input("searchVolume")} className={field} />}
        </TextField>
        <Dropdown id={`${pre}-volume-basis`} label="Volume basis" value={f.volumeBasis} onChange={set("volumeBasis")} options={opts(METRIC_BASES)} />
        <TextField id={`${pre}-volume-source`} label="Volume source">
          {(id) => <input id={id} value={f.volumeSource} onChange={input("volumeSource")} maxLength={120} placeholder="Google Keyword Planner" className={field} />}
        </TextField>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-base text-obsidian-900">Keyword difficulty (0–100)</legend>
        <TextField id={`${pre}-difficulty`} label="Difficulty (blank = unknown)">
          {(id) => <input id={id} type="number" inputMode="numeric" min={0} max={100} step={1} value={f.difficulty} onChange={input("difficulty")} className={field} />}
        </TextField>
        <Dropdown id={`${pre}-difficulty-basis`} label="Difficulty basis" value={f.difficultyBasis} onChange={set("difficultyBasis")} options={opts(METRIC_BASES)} />
        <TextField id={`${pre}-difficulty-source`} label="Difficulty source">
          {(id) => <input id={id} value={f.difficultySource} onChange={input("difficultySource")} maxLength={120} className={field} />}
        </TextField>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        <TextField id={`${pre}-path`} label="Target path">
          {(id) => <input id={id} value={f.targetPath} onChange={input("targetPath")} maxLength={300} placeholder="/private-tours" className={field} />}
        </TextField>
        <Dropdown id={`${pre}-page-type`} label="Target page type" value={f.targetPageType} onChange={set("targetPageType")} options={opts(PAGE_TYPES, "Not set")} />
        <Dropdown id={`${pre}-priority`} label="Priority" value={f.priority} onChange={set("priority")} options={opts(PRIORITIES)} />
        <Dropdown
          id={`${pre}-relevance`}
          label="Business relevance (1–5)"
          value={f.businessRelevance}
          onChange={set("businessRelevance")}
          options={[{ value: "", label: "Not set" }, ...["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }))]}
        />
        <Dropdown id={`${pre}-status`} label="Status" value={f.status} onChange={set("status")} options={opts(KEYWORD_STATUSES)} />
        <TextField id={`${pre}-competitors`} label="Competitors (comma separated)">
          {(id) => <input id={id} value={f.competitors} onChange={input("competitors")} className={field} />}
        </TextField>
        <TextField id={`${pre}-data-source`} label="Data source">
          {(id) => <input id={id} value={f.dataSource} onChange={input("dataSource")} maxLength={200} className={field} />}
        </TextField>
        <Dropdown id={`${pre}-validation`} label="Validation" value={f.validationStatus} onChange={set("validationStatus")} options={opts(VALIDATION_STATUSES)} />
        <TextField id={`${pre}-verified`} label="Last verified">
          {(id) => <input id={id} type="date" value={f.lastVerifiedAt} onChange={input("lastVerifiedAt")} className={field} />}
        </TextField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField id={`${pre}-competition`} label="Competition notes">
          {(id) => <textarea id={id} rows={3} value={f.competitionNotes} onChange={input("competitionNotes")} maxLength={1000} className={field} />}
        </TextField>
        <TextField id={`${pre}-notes`} label="Notes">
          {(id) => <textarea id={id} rows={3} value={f.notes} onChange={input("notes")} maxLength={2000} className={field} />}
        </TextField>
      </div>

      <div aria-live="polite">
        {hints.length > 0 && (
          <ul className="space-y-1 rounded-2xl bg-summit-100 px-4 py-3 text-sm text-obsidian-900">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : keyword ? "Save changes" : "Add keyword"}
        </button>
        <button type="button" onClick={onCancel} className={quietBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
// CSV import

interface ImportRow {
  line: number;
  keyword: string;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
  notes: string[];
  cluster?: string | null;
}
interface ImportSummary {
  rows: ImportRow[];
  unknownColumns: string[];
  newClusters: string[];
  counts: { create: number; update: number; skip: number; error: number };
}

const MAX_CSV_BYTES = 1_000_000;
const CSV_HEADERS =
  "keyword, designation, searchVolume, volumeBasis, volumeSource, difficulty, difficultyBasis, difficultySource, intent, funnelStage, track, cluster, targetPath, targetPageType, priority, businessRelevance, competitors, competitionNotes, status, dataSource, lastVerifiedAt, validationStatus, notes";

const ACTION_STYLE: Record<ImportRow["action"], string> = {
  create: "bg-ocean-50 text-ocean-800",
  update: "bg-summit-100 text-obsidian-900",
  skip: "bg-obsidian-100 text-slate-700",
  error: "bg-red-50 text-red-800",
};

function ImportForm({ onImported, onSignedOut, notify }: { onImported: () => void; onSignedOut: () => void; notify: (m: string) => void }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("skip");
  const [track, setTrack] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const body = () => ({ csv, mode, ...(track ? { track } : {}), ...(dataSource.trim() ? { dataSource: dataSource.trim() } : {}) });

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    setError("");
    setPreview(null);
    setCsv("");
    setFileName("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      e.target.value = "";
      return setError("The file is larger than 1 MB. Split it into smaller files.");
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
    };
    reader.onerror = () => setError("Couldn't read the file.");
    reader.readAsText(file);
  }

  async function runPreview() {
    if (!csv) return setError("Choose a CSV file.");
    setBusy(true);
    setError("");
    const { ok, status, data } = await seoApi<{ preview: ImportSummary }>("/keywords/import/preview", "POST", body());
    setBusy(false);
    if (denied(status)) return onSignedOut();
    if (!ok) return setError(errorOf(data, "Couldn't read the file."));
    setPreview(data.preview);
  }

  async function runImport() {
    setBusy(true);
    setError("");
    const { ok, status, data } = await seoApi<{ result: ImportSummary }>("/keywords/import", "POST", body());
    setBusy(false);
    if (denied(status)) return onSignedOut();
    if (!ok) return setError(errorOf(data, "Couldn't import the file."));
    const c = data.result.counts;
    notify(`Imported: ${c.create} added, ${c.update} updated, ${c.skip} skipped, ${c.error} with errors (not saved).`);
    setPreview(null);
    setCsv("");
    setFileName("");
    onImported();
  }

  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPreview(null);
  };
  const saving = preview ? preview.counts.create + preview.counts.update : 0;

  return (
    <div className="space-y-5 border-t border-obsidian-900/[0.06] bg-obsidian-50/60 px-6 py-6">
      <h3 className="text-lg text-obsidian-900">Import keywords from CSV</h3>
      <p className="text-sm text-slate-600">
        The first row is the header. Accepted columns: {CSV_HEADERS}. Common spreadsheet names also work (for example &quot;Search volume&quot;, &quot;KD&quot;,
        &quot;Search intent&quot;, &quot;Target URL&quot;). Only <code>keyword</code> is required. Volume and difficulty need a basis (Estimate or Researched), and a
        researched figure needs a source. New cluster names are created on import. Up to 1 MB.
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-4">
        <TextField id="kw-import-file" label="CSV file">
          {(id) => (
            <input
              id={id}
              type="file"
              accept=".csv,text/csv"
              onChange={chooseFile}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:text-obsidian-900 file:ring-1 file:ring-obsidian-900/10"
            />
          )}
        </TextField>
        <Dropdown
          id="kw-import-mode"
          label="Keywords already in the list"
          value={mode}
          onChange={reset(setMode)}
          options={[
            { value: "skip", label: "Skip existing" },
            { value: "update", label: "Update existing" },
          ]}
        />
        <Dropdown id="kw-import-track" label="Default track (optional)" value={track} onChange={reset(setTrack)} options={trackOpts("From the file")} />
        <TextField id="kw-import-source" label="Default data source (optional)">
          {(id) => <input id={id} value={dataSource} onChange={(e) => reset(setDataSource)(e.target.value)} maxLength={200} className={field} />}
        </TextField>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={runPreview} disabled={busy || !csv} className={quietBtn}>
          {busy && !preview ? "Checking…" : "Preview"}
        </button>
        {preview && (
          <button type="button" onClick={runImport} disabled={busy || saving === 0} className={primaryBtn}>
            {busy ? "Importing…" : `Import ${saving} ${saving === 1 ? "row" : "rows"}`}
          </button>
        )}
        {fileName && <span className="text-sm text-slate-600">{fileName}</span>}
      </div>

      {preview && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {preview.counts.create} to add, {preview.counts.update} to update, {preview.counts.skip} skipped, {preview.counts.error} with errors (rows with errors are never saved).
          </p>
          {preview.unknownColumns.length > 0 && <p className="text-sm text-slate-700">Ignored columns: {preview.unknownColumns.join(", ")}</p>}
          {preview.newClusters.length > 0 && <p className="text-sm text-slate-700">New clusters to create: {preview.newClusters.join(", ")}</p>}
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-obsidian-900/[0.07]">
            <Grid label="Import preview" head={[["Line"], ["Keyword"], ["Result"], ["Cluster"], ["Errors and notes"]]}>
              {preview.rows.map((r) => (
                <tr key={r.line} className="align-top">
                  <td className="px-6 py-3 tabular-nums text-slate-600">{r.line}</td>
                  <td className="px-6 py-3 text-obsidian-900">{r.keyword || "–"}</td>
                  <td className="px-6 py-3">
                    <Chip className={ACTION_STYLE[r.action]}>{words(r.action)}</Chip>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{r.cluster || "–"}</td>
                  <td className="px-6 py-3 text-sm">
                    {r.errors.map((m, i) => (
                      <p key={`e${i}`} className="text-red-800">
                        {m}
                      </p>
                    ))}
                    {r.notes.map((m, i) => (
                      <p key={`n${i}`} className="text-slate-600">
                        {m}
                      </p>
                    ))}
                    {r.errors.length + r.notes.length === 0 && <span className="text-slate-500">–</span>}
                  </td>
                </tr>
              ))}
            </Grid>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Keywords panel

interface KeywordSummary {
  traffic: number;
  booking: number;
  mapped: number;
  unmapped: number;
  plannedOnly: number;
  cannibalised: number;
  verified: number;
  unverified: number;
  metricsUnknown: number;
  intentMismatches: number;
}

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { q: "", track: "", intent: "", funnelStage: "", priority: "", status: "", validationStatus: "", clusterId: "", mapped: "", includeArchived: "" };
type Filters = typeof EMPTY_FILTERS;

export function KeywordsPanel({ notify }: { notify: (message: string) => void }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ total: number; keywords: Keyword[] } | null>(null);
  const [summary, setSummary] = useState<KeywordSummary | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // keyword id or "new"
  const [importing, setImporting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSide = useCallback(async () => {
    const [o, c] = await Promise.all([seoApi<{ overview: { keywords: KeywordSummary } }>("/overview"), seoApi<{ clusters: Cluster[] }>("/clusters")]);
    if (denied(o.status) || denied(c.status)) return setSignedOut(true);
    if (o.ok) setSummary(o.data.overview.keywords);
    if (c.ok) setClusters(c.data.clusters);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    const { ok, status, data } = await seoApi<{ total: number; page: number; pageSize: number; keywords: Keyword[] }>(`/keywords?${params}`);
    if (denied(status)) return setSignedOut(true);
    if (!ok) return setError(errorOf(data, "Couldn't load keywords."));
    setError("");
    setList({ total: data.total, keywords: data.keywords });
  }, [filters, page]);

  useEffect(() => {
    void loadSide();
  }, [loadSide]);
  useEffect(() => {
    void load();
  }, [load]);

  const reloadAll = () => {
    setEditing(null);
    void load();
    void loadSide();
  };

  const setFilter = (key: keyof Filters) => (value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  async function toggleArchive(k: Keyword) {
    setBusyId(k.id);
    const archived = !k.archivedAt;
    const { ok, status, data } = await seoApi(`/keywords/${k.id}/archive`, "POST", { archived });
    setBusyId(null);
    if (denied(status)) return setSignedOut(true);
    if (!ok) return setError(errorOf(data, "Couldn't change the keyword."));
    notify(archived ? `"${k.keyword}" was archived.` : `"${k.keyword}" was restored.`);
    reloadAll();
  }

  if (signedOut) {
    return (
      <Panel id="seo-keywords" title="Keywords">
        <div className="px-6 py-6">
          <Alert>{SIGNED_OUT}</Alert>
        </div>
      </Panel>
    );
  }

  const exportHref = `/api/seo/admin/keywords/export.csv${filters.includeArchived === "true" ? "?includeArchived=true" : ""}`;
  const pages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const clusterOptions: DropdownOption[] = [{ value: "", label: "All clusters" }, ...clusters.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Panel
      id="seo-keywords"
      title="Keywords"
      description="Keyword research entered or imported by the team, grouped by track: traffic acquisition (guides and destination pages) and booking conversion (tour and booking pages)."
      actions={
        <>
          <a href={exportHref} download className={quietBtn}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </a>
          <button type="button" onClick={() => setImporting((v) => !v)} aria-expanded={importing} className={quietBtn}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import CSV
          </button>
          <button type="button" onClick={() => setEditing(editing === "new" ? null : "new")} aria-expanded={editing === "new"} className={primaryBtn}>
            Add keyword
          </button>
        </>
      }
    >
      {importing && <ImportForm onImported={reloadAll} onSignedOut={() => setSignedOut(true)} notify={notify} />}
      {editing === "new" && (
        <div className="border-b border-obsidian-900/[0.06]">
          <KeywordForm clusters={clusters} onDone={reloadAll} onCancel={() => setEditing(null)} onSignedOut={() => setSignedOut(true)} notify={notify} />
        </div>
      )}

      {summary && (
        <div className="grid gap-4 px-6 pt-6 sm:grid-cols-2">
          <Stat label={TRACK_LABEL.TRAFFIC_ACQUISITION} value={summary.traffic.toLocaleString("en-CA")} hint="Active keywords on this track" />
          <Stat label={TRACK_LABEL.BOOKING_CONVERSION} value={summary.booking.toLocaleString("en-CA")} hint="Active keywords on this track" />
          <p className="text-sm text-slate-600 sm:col-span-2">
            {summary.mapped} mapped to a page, {summary.plannedOnly} with a planned page only, {summary.unmapped} unmapped, {summary.cannibalised} cannibalised, {summary.intentMismatches}{" "}
            intent mismatches. {summary.verified} verified, {summary.unverified} unverified, {summary.metricsUnknown} with no search volume.
          </p>
        </div>
      )}

      <form
        role="search"
        aria-label="Filter keywords"
        className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter("q")(search.trim());
        }}
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="kw-q" className={labelCls}>
            Search keywords
          </label>
          <div className="flex gap-2">
            <input id="kw-q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} className={field} />
            <button type="submit" className={quietBtn}>
              Search
            </button>
          </div>
        </div>
        <Dropdown id="kw-f-track" label="Track" value={filters.track} onChange={setFilter("track")} options={trackOpts("All tracks")} />
        <Dropdown id="kw-f-intent" label="Intent" value={filters.intent} onChange={setFilter("intent")} options={opts(INTENTS, "All intents")} />
        <Dropdown id="kw-f-funnel" label="Funnel stage" value={filters.funnelStage} onChange={setFilter("funnelStage")} options={funnelOpts("All stages")} />
        <Dropdown id="kw-f-priority" label="Priority" value={filters.priority} onChange={setFilter("priority")} options={opts(PRIORITIES, "All priorities")} />
        <Dropdown id="kw-f-status" label="Status" value={filters.status} onChange={setFilter("status")} options={opts(KEYWORD_STATUSES, "All statuses")} />
        <Dropdown id="kw-f-validation" label="Validation" value={filters.validationStatus} onChange={setFilter("validationStatus")} options={opts(VALIDATION_STATUSES, "Any validation")} />
        <Dropdown id="kw-f-cluster" label="Cluster" value={filters.clusterId} onChange={setFilter("clusterId")} options={clusterOptions} searchable />
        <Dropdown
          id="kw-f-mapped"
          label="Mapped to a page"
          value={filters.mapped}
          onChange={setFilter("mapped")}
          options={[
            { value: "", label: "Mapped or not" },
            { value: "yes", label: "Mapped" },
            { value: "no", label: "Not mapped" },
          ]}
        />
        <Dropdown
          id="kw-f-archived"
          label="Archived keywords"
          value={filters.includeArchived}
          onChange={setFilter("includeArchived")}
          options={[
            { value: "", label: "Hide archived" },
            { value: "true", label: "Include archived" },
          ]}
        />
      </form>

      <p className="border-t border-obsidian-900/[0.06] px-6 py-3 text-sm text-slate-600">
        Search volume and difficulty are shown only when entered with a source. Nothing here is live ranking or traffic data.
      </p>
      {error && (
        <div className="px-6 pb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!list ? (
        <Loading />
      ) : list.keywords.length === 0 ? (
        <Empty>No keywords match these filters.</Empty>
      ) : (
        <Grid
          label="Keywords"
          minWidth="min-w-[88rem]"
          head={[["Keyword"], ["Track"], ["Intent / funnel"], ["Cluster"], ["Target path"], ["Priority"], ["Volume", true], ["Difficulty", true], ["Validation"], ["Status"], [""]]}
        >
          {list.keywords.map((k) => (
            <KeywordRow
              key={k.id}
              k={k}
              open={editing === k.id}
              busy={busyId === k.id}
              onEdit={() => setEditing(editing === k.id ? null : k.id)}
              onArchive={() => void toggleArchive(k)}
            >
              <KeywordForm keyword={k} clusters={clusters} onDone={reloadAll} onCancel={() => setEditing(null)} onSignedOut={() => setSignedOut(true)} notify={notify} />
            </KeywordRow>
          ))}
        </Grid>
      )}

      {list && list.total > 0 && (
        <nav aria-label="Keyword pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-obsidian-900/[0.06] px-6 py-4 text-sm text-slate-600">
          <span>
            {list.total.toLocaleString("en-CA")} {list.total === 1 ? "keyword" : "keywords"} · page {page} of {pages}
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={quietBtn}>
              Previous
            </button>
            <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className={quietBtn}>
              Next
            </button>
          </span>
        </nav>
      )}
    </Panel>
  );
}

function KeywordRow({ k, open, busy, onEdit, onArchive, children }: { k: Keyword; open: boolean; busy: boolean; onEdit: () => void; onArchive: () => void; children: ReactNode }) {
  return (
    <>
      <tr className="align-top">
        <td className="px-6 py-4">
          <p className="text-obsidian-900">{k.keyword}</p>
          <p className="text-sm text-slate-600">{words(k.designation)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {k.archivedAt && <Chip className="bg-obsidian-100 text-slate-700">Archived</Chip>}
            {k.flags.unmapped && <Chip className="bg-red-50 text-red-800">Unmapped</Chip>}
            {k.flags.plannedOnly && <Chip className="bg-summit-100 text-obsidian-900">Planned page</Chip>}
            {k.flags.cannibalised && <Chip className="bg-red-50 text-red-800">Cannibalised</Chip>}
          </div>
          {k.flags.intentMismatch && <p className="mt-2 max-w-xs text-sm text-red-800">{k.flags.intentMismatch}</p>}
          {k.mappings.length > 0 && (
            <p className="mt-2 text-sm text-slate-600">
              On: {k.mappings.map((m) => `${m.page.path}${m.role === "PRIMARY" ? " (primary)" : ""}`).join(", ")}
            </p>
          )}
        </td>
        <td className="px-6 py-4 text-slate-700">{TRACK_LABEL[k.track]}</td>
        <td className="px-6 py-4 text-slate-700">
          {words(k.intent)}
          <span className="block text-sm text-slate-600">{FUNNEL_LABEL[k.funnelStage]}</span>
        </td>
        <td className="px-6 py-4 text-slate-700">{k.cluster?.name ?? "–"}</td>
        <td className="px-6 py-4 text-slate-700">
          {k.targetPath ?? "–"}
          {k.targetPageType && <span className="block text-sm text-slate-600">{words(k.targetPageType)}</span>}
        </td>
        <td className="px-6 py-4">
          <Chip className={PRIORITY_STYLE[k.priority]}>{words(k.priority)}</Chip>
          {k.businessRelevance !== null && <span className="mt-1 block text-sm text-slate-600">Relevance {k.businessRelevance}/5</span>}
        </td>
        <td className="px-6 py-4 text-right tabular-nums">
          <Metric value={k.searchVolume} basis={k.volumeBasis} source={k.volumeSource} />
          {k.volumeBasis !== "UNKNOWN" && k.volumeSource && <span className="block text-sm text-slate-600">{k.volumeSource}</span>}
        </td>
        <td className="px-6 py-4 text-right tabular-nums">
          <Metric value={k.difficulty} basis={k.difficultyBasis} source={k.difficultySource} />
          {k.difficultyBasis !== "UNKNOWN" && k.difficultySource && <span className="block text-sm text-slate-600">{k.difficultySource}</span>}
        </td>
        <td className="px-6 py-4">
          <Chip className={VALIDATION_STYLE[k.validationStatus]}>{words(k.validationStatus)}</Chip>
          {k.lastVerifiedAt && <span className="mt-1 block text-sm text-slate-600">{day(k.lastVerifiedAt)}</span>}
        </td>
        <td className="px-6 py-4 text-slate-700">{words(k.status)}</td>
        <td className="px-6 py-4">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onEdit} aria-expanded={open} aria-label={`Edit ${k.keyword}`} className={quietBtn}>
              {open ? "Close" : "Edit"}
            </button>
            <button type="button" onClick={onArchive} disabled={busy} aria-label={`${k.archivedAt ? "Restore" : "Archive"} ${k.keyword}`} className={k.archivedAt ? quietBtn : dangerBtn}>
              {k.archivedAt ? "Restore" : "Archive"}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={11} className="p-0">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Clusters panel

function ClusterForm({ cluster, onDone, onCancel, onSignedOut, notify }: { cluster?: Cluster; onDone: () => void; onCancel: () => void; onSignedOut: () => void; notify: (m: string) => void }) {
  const [name, setName] = useState(cluster?.name ?? "");
  const [pillar, setPillar] = useState(cluster?.pillar ?? "");
  const [track, setTrack] = useState<string>(cluster?.track ?? "TRAFFIC_ACQUISITION");
  const [description, setDescription] = useState(cluster?.description ?? "");
  const [hubPath, setHubPath] = useState(cluster?.hubPath ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pre = cluster ? `cl-${cluster.id}` : "cl-new";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Enter the cluster name.");
    setBusy(true);
    const body = { name: name.trim(), track, pillar: textOrNull(pillar), description: textOrNull(description), hubPath: textOrNull(hubPath) };
    const { ok, status, data } = await seoApi(cluster ? `/clusters/${cluster.id}` : "/clusters", cluster ? "PATCH" : "POST", body);
    setBusy(false);
    if (denied(status)) return onSignedOut();
    if (!ok) return setError(errorOf(data, "Couldn't save the cluster."));
    notify(cluster ? `${body.name} was updated.` : `${body.name} was added.`);
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate aria-label={cluster ? `Edit ${cluster.name}` : "Add a cluster"} className="grid gap-4 bg-obsidian-50/60 px-6 py-6 md:grid-cols-2">
      {error && (
        <div className="md:col-span-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <TextField id={`${pre}-name`} label="Name">
        {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={field} />}
      </TextField>
      <Dropdown id={`${pre}-track`} label="Track" value={track} onChange={setTrack} options={trackOpts()} />
      <TextField id={`${pre}-pillar`} label="Pillar (optional)">
        {(id) => <input id={id} value={pillar} onChange={(e) => setPillar(e.target.value)} maxLength={80} className={field} />}
      </TextField>
      <TextField id={`${pre}-hub`} label="Hub page path (optional)">
        {(id) => <input id={id} value={hubPath} onChange={(e) => setHubPath(e.target.value)} maxLength={300} placeholder="/banff-guide" className={field} />}
      </TextField>
      <div className="md:col-span-2">
        <TextField id={`${pre}-description`} label="Description (optional)">
          {(id) => <textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={field} />}
        </TextField>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : cluster ? "Save changes" : "Add cluster"}
        </button>
        <button type="button" onClick={onCancel} className={quietBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ClustersPanel({ notify }: { notify: (message: string) => void }) {
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [trackFilter, setTrackFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // cluster id or "new"
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  const load = useCallback(async () => {
    const { ok, status, data } = await seoApi<{ clusters: Cluster[] }>("/clusters");
    if (denied(status)) return setSignedOut(true);
    if (!ok) return setError(errorOf(data, "Couldn't load clusters."));
    setError("");
    setClusters(data.clusters);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const done = () => {
    setEditing(null);
    void load();
  };

  if (signedOut) {
    return (
      <Panel id="seo-clusters" title="Keyword clusters">
        <div className="px-6 py-6">
          <Alert>{SIGNED_OUT}</Alert>
        </div>
      </Panel>
    );
  }

  const groups = TRACKS.filter((t) => !trackFilter || t === trackFilter).map((t) => ({ track: t, rows: (clusters ?? []).filter((c) => c.track === t) }));

  return (
    <Panel
      id="seo-clusters"
      title="Keyword clusters"
      description="Topic groups with a hub page. Counts are this site's own keywords; mapped means the keyword is assigned to a page."
      actions={
        <>
          <div className="w-56">
            <Dropdown id="cl-f-track" label="Track" hideLabel variant="pill" value={trackFilter} onChange={setTrackFilter} options={trackOpts("All tracks")} />
          </div>
          <button type="button" onClick={() => setEditing(editing === "new" ? null : "new")} aria-expanded={editing === "new"} className={primaryBtn}>
            Add cluster
          </button>
        </>
      }
    >
      {editing === "new" && <ClusterForm onDone={done} onCancel={() => setEditing(null)} onSignedOut={() => setSignedOut(true)} notify={notify} />}
      {error && (
        <div className="px-6 py-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {!clusters ? (
        <Loading />
      ) : clusters.length === 0 ? (
        <Empty>No clusters yet. Add one, or import keywords with a cluster column.</Empty>
      ) : (
        groups.map((g) => (
          <div key={g.track} className="border-t border-obsidian-900/[0.06]">
            <h3 className="px-6 pb-2 pt-5 text-lg text-obsidian-900">
              {TRACK_LABEL[g.track]} <span className="text-sm text-slate-600">({g.rows.length})</span>
            </h3>
            {g.rows.length === 0 ? (
              <Empty>No clusters on this track.</Empty>
            ) : (
              <Grid label={`${TRACK_LABEL[g.track]} clusters`} head={[["Name"], ["Pillar"], ["Hub page"], ["Keywords", true], ["Mapped", true], ["High priority", true], [""]]}>
                {g.rows.map((c) => (
                  <ClusterRow key={c.id} c={c} open={editing === c.id} onEdit={() => setEditing(editing === c.id ? null : c.id)}>
                    <ClusterForm cluster={c} onDone={done} onCancel={() => setEditing(null)} onSignedOut={() => setSignedOut(true)} notify={notify} />
                  </ClusterRow>
                ))}
              </Grid>
            )}
          </div>
        ))
      )}
    </Panel>
  );
}

function ClusterRow({ c, open, onEdit, children }: { c: Cluster; open: boolean; onEdit: () => void; children: ReactNode }) {
  return (
    <>
      <tr className="align-top">
        <td className="px-6 py-4">
          <p className="text-obsidian-900">{c.name}</p>
          {c.description && <p className="mt-1 max-w-md text-sm text-slate-600">{c.description}</p>}
        </td>
        <td className="px-6 py-4 text-slate-700">{c.pillar ?? "–"}</td>
        <td className="px-6 py-4">
          {c.hubPath ? (
            <Link href={c.hubPath} className="text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
              {c.hubPath}
            </Link>
          ) : (
            <span className="text-slate-500">–</span>
          )}
        </td>
        <td className="px-6 py-4 text-right tabular-nums">{c.keywords}</td>
        <td className="px-6 py-4 text-right tabular-nums">{c.mapped}</td>
        <td className="px-6 py-4 text-right tabular-nums">{c.highPriority}</td>
        <td className="px-6 py-4 text-right">
          <button type="button" onClick={onEdit} aria-expanded={open} aria-label={`Edit ${c.name}`} className={quietBtn}>
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="p-0">
            {children}
          </td>
        </tr>
      )}
    </>
  );
}
