"use client";

// SEO tasks, the migration checklist, change history and settings (admin approvals, llms.txt and
// business details) in the SEO portal.

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LlmsPanel } from "@/components/admin/seo/LlmsPanel";
import { Chip, Empty, Grid, Loading, Panel, day, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, when, words } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";

// ---------------------------------------------------------------------------------------------
// Tasks

type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string | null;
  assigneeId: string | null;
  assignee: string | null;
  createdBy: string | null;
  createdById: string | null;
  dueDate: string | null;
  path: string | null;
  overdue: boolean;
  updatedAt: string;
}
interface Member {
  id: string;
  name: string;
  role: string;
}

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];
const PRIORITIES = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];
const CATEGORIES = ["Metadata", "Blog", "Redirects", "Images", "Schema", "Technical", "Content", "Tracking", "Other"].map((c) => ({ value: c, label: c }));

function TaskForm({ team, task, onDone }: { team: Member[]; task: Task | null; onDone: () => void }) {
  const uid = useId();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [category, setCategory] = useState(task?.category ?? "Other");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? "");
  const [path, setPath] = useState(task?.path ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { title, description: description || null, priority, category, assigneeId: assigneeId || null, dueDate: dueDate || null, path: path || null };
    const res = task ? await portalApi(`/tasks/${task.id}`, "PATCH", body) : await portalApi("/tasks", "POST", body);
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save the task."));
    onDone();
  }

  return (
    <form onSubmit={save} className="grid gap-4 border-b border-obsidian-900/[0.06] px-6 py-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${uid}-title`} className={labelCls}>
          Task
        </label>
        <input id={`${uid}-title`} required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${uid}-desc`} className={labelCls}>
          Details
        </label>
        <textarea id={`${uid}-desc`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
      </div>
      <Dropdown id={`${uid}-assignee`} label="Assigned to" options={[{ value: "", label: "Nobody yet" }, ...team.map((m) => ({ value: m.id, label: m.name, description: words(m.role) }))]} value={assigneeId} onChange={setAssigneeId} />
      <Dropdown id={`${uid}-priority`} label="Priority" options={PRIORITIES} value={priority} onChange={(v) => setPriority(v as Task["priority"])} />
      <Dropdown id={`${uid}-category`} label="Area" options={CATEGORIES} value={category} onChange={setCategory} />
      <div>
        <label htmlFor={`${uid}-due`} className={labelCls}>
          Due
        </label>
        <input id={`${uid}-due`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${uid}-path`} className={labelCls}>
          Page (optional)
        </label>
        <input id={`${uid}-path`} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/blog-post/…" className={`${field} font-mono text-sm`} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : task ? "Save task" : "Add task"}
        </button>
        <button type="button" onClick={onDone} className={quietBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TasksView() {
  const { me, notify } = usePortal();
  const uid = useId();
  const [data, setData] = useState<{ tasks: Task[]; team: Member[]; counts: Record<string, number> } | null>(null);
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const canEdit = me.seo.editContent;

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (mine) params.set("assigneeId", me.id);
    const res = await portalApi<{ tasks: Task[]; team: Member[]; counts: Record<string, number> }>(`/tasks?${params}`);
    if (res.ok) setData(res.data);
  }, [status, mine, me.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function setTaskStatus(t: Task, next: string) {
    const res = await portalApi(`/tasks/${t.id}`, "PATCH", { status: next });
    if (!res.ok) notify(errorOf(res.data, "Couldn't update the task."));
    void load();
  }

  async function remove(t: Task) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    const res = await portalApi(`/tasks/${t.id}`, "DELETE");
    notify(res.ok ? "Task deleted." : errorOf(res.data, "Couldn't delete the task."));
    void load();
  }

  return (
    <div className="space-y-6">
      <PortalHeading title="SEO tasks" intro="The team's to-do list. Every change is in the change history." />
      <Panel
        id={`${uid}-tasks`}
        title="Tasks"
        description={data ? STATUSES.map((s) => `${s.label} ${data.counts[s.value] ?? 0}`).join(" · ") : undefined}
        actions={
          canEdit && (
            <button type="button" onClick={() => setEditing("new")} className={quietBtn}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New task
            </button>
          )
        }
      >
        {editing && data && (
          <TaskForm
            team={data.team}
            task={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
        <div className="flex flex-wrap items-end gap-4 px-6 py-5">
          <div className="w-56">
            <Dropdown id={`${uid}-status`} label="Status" options={[{ value: "", label: "All" }, ...STATUSES]} value={status} onChange={setStatus} />
          </div>
          <label className="flex h-12 items-center gap-2 text-base">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-5 w-5 accent-ocean-600" />
            Only mine
          </label>
        </div>
        {!data ? (
          <Loading />
        ) : data.tasks.length === 0 ? (
          <Empty>No tasks here.</Empty>
        ) : (
          <Grid label="SEO tasks" head={[["Task"], ["Assigned to"], ["Due"], ["Status"], [""]]} minWidth="min-w-[52rem]">
            {data.tasks.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-6 py-3">
                  <span className="block text-base text-obsidian-900">{t.title}</span>
                  <span className="text-sm text-slate-600">
                    {words(t.priority)} priority{t.category ? ` · ${t.category}` : ""}
                    {t.path ? (
                      <>
                        {" · "}
                        <span className="font-mono">{t.path}</span>
                      </>
                    ) : null}
                  </span>
                  {t.description && <span className="mt-1 block whitespace-pre-line text-sm text-slate-700">{t.description}</span>}
                </td>
                <td className="px-6 py-3 text-sm">{t.assignee ?? "–"}</td>
                <td className={`px-6 py-3 text-sm ${t.overdue ? "text-red-700" : ""}`}>{t.dueDate ? day(t.dueDate) : "–"}</td>
                <td className="w-48 px-6 py-3">
                  {canEdit ? (
                    <Dropdown id={`${uid}-st-${t.id}`} label={`Status of ${t.title}`} hideLabel variant="pill" options={STATUSES} value={t.status} onChange={(v) => void setTaskStatus(t, v)} />
                  ) : (
                    <Chip className="bg-obsidian-100 text-slate-700">{words(t.status)}</Chip>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {canEdit && (
                    <span className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditing(t)} className={quietBtn}>
                        Edit
                      </button>
                      {(me.role === "ADMIN" || t.createdById === me.id) && (
                        <button type="button" onClick={() => void remove(t)} className={quietBtn}>
                          Delete
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Migration checklist

type ItemStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "NOT_APPLICABLE";
interface Item {
  id: string;
  key: string;
  phase: "BEFORE_LAUNCH" | "AFTER_LAUNCH";
  section: string;
  title: string;
  description: string | null;
  source: string;
  status: ItemStatus;
  notes: string | null;
  assigneeName: string | null;
  evidence: string[];
  confirmedBy: string | null;
  confirmedAt: string | null;
  autoCheck: string | null;
  lastCheck: { ok: boolean | null; message: string; at: string } | null;
}

const ITEM_STATUS: { value: ItemStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
];
const ITEM_STYLE: Record<ItemStatus, string> = {
  NOT_STARTED: "bg-obsidian-100 text-slate-700",
  IN_PROGRESS: "bg-ocean-50 text-ocean-800",
  BLOCKED: "bg-red-50 text-red-800",
  DONE: "bg-ocean-600 text-white",
  NOT_APPLICABLE: "bg-obsidian-100 text-slate-600",
};

function ChecklistItem({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { me } = usePortal();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await portalApi(`/checklist/${item.id}`, "PATCH", body);
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't update this item."));
    setEvidence("");
    setConfirm(false);
    onChanged();
  }

  return (
    <li className="px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base text-obsidian-900">{item.title}</p>
          {item.description && <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>}
          {item.lastCheck && (
            <p className={`mt-1 text-sm ${item.lastCheck.ok === false ? "text-red-700" : item.lastCheck.ok ? "text-ocean-700" : "text-slate-600"}`}>
              Automatic check: {item.lastCheck.message}
            </p>
          )}
          {item.status === "DONE" && (
            <p className="mt-1 text-sm text-slate-600">
              Done{item.confirmedBy ? ` by ${item.confirmedBy}` : ""} {item.confirmedAt ? when(item.confirmedAt) : ""}
              {item.evidence.length === 0 ? " (confirmed, no evidence attached)" : ""}
            </p>
          )}
        </div>
        <span className="flex items-center gap-2">
          <Chip className={ITEM_STYLE[item.status]}>{ITEM_STATUS.find((s) => s.value === item.status)?.label}</Chip>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={quietBtn}>
            {open ? "Close" : "Details"}
          </button>
        </span>
      </div>
      {open && (
        <div className="mt-4 space-y-4 rounded-2xl bg-obsidian-50 p-4">
          <div>
            <p className="text-sm text-slate-700">Evidence</p>
            {item.evidence.length === 0 ? (
              <p className="text-sm text-slate-600">None yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {item.evidence.map((e) => (
                  <li key={e} className="flex flex-wrap items-center gap-2 break-all">
                    {/^https?:\/\//.test(e) ? (
                      <a href={e} target="_blank" rel="noopener noreferrer" className="text-ocean-700 underline underline-offset-2">
                        {e}
                      </a>
                    ) : (
                      <span>{e}</span>
                    )}
                    {me.seo.manage && (
                      <button type="button" onClick={() => void update({ removeEvidence: e })} className="text-sm text-slate-600 underline">
                        remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {me.seo.manage && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${uid}-ev`} className={labelCls}>
                    Add evidence (a link, a check result or what you verified)
                  </label>
                  <input id={`${uid}-ev`} value={evidence} onChange={(e) => setEvidence(e.target.value)} className={field} />
                </div>
                <button type="button" disabled={busy || evidence.trim().length < 3} onClick={() => void update({ addEvidence: evidence.trim() })} className={quietBtn}>
                  Add
                </button>
                {item.lastCheck?.ok && (
                  <button type="button" disabled={busy} onClick={() => void update({ addEvidence: `Automatic check ${item.lastCheck!.at.slice(0, 10)}: ${item.lastCheck!.message}`.slice(0, 1000) })} className={quietBtn}>
                    Use the automatic check
                  </button>
                )}
              </div>
              <div>
                <label htmlFor={`${uid}-notes`} className={labelCls}>
                  Notes
                </label>
                <textarea id={`${uid}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (item.notes ?? "") && void update({ notes: notes || null })} className={field} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-56">
                  <Dropdown
                    id={`${uid}-status`}
                    label="Status"
                    options={ITEM_STATUS}
                    value={item.status}
                    onChange={(v) => {
                      if (v === "DONE" && item.evidence.length === 0 && !confirm) return setError("Add evidence first, or tick the confirmation below.");
                      void update({ status: v, ...(v === "DONE" && confirm ? { confirm: true } : {}) });
                    }}
                  />
                </div>
                {item.status !== "DONE" && item.evidence.length === 0 && (
                  <label className="flex items-start gap-2 pb-3 text-sm text-obsidian-900">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-5 w-5 accent-ocean-600" />I checked this myself and confirm it is done
                  </label>
                )}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function ChecklistView() {
  const { me, notify } = usePortal();
  const uid = useId();
  const [data, setData] = useState<{ items: Item[]; progress: { before: { total: number; done: number }; after: { total: number; done: number } } } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await portalApi<{ items: Item[]; progress: { before: { total: number; done: number }; after: { total: number; done: number } } }>("/checklist");
    if (res.ok) setData(res.data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setBusy(true);
    const res = await portalApi<{ items: Item[]; progress: { before: { total: number; done: number }; after: { total: number; done: number } } }>("/checklist/refresh", "POST", {});
    setBusy(false);
    if (res.ok) {
      setData(res.data);
      notify("Automatic checks updated. They suggest evidence; they never mark items done.");
    }
  }

  const phase = (p: Item["phase"]) => {
    const items = data?.items.filter((i) => i.phase === p) ?? [];
    const sections = Array.from(new Set(items.map((i) => i.section)));
    return sections.map((s) => (
      <div key={s}>
        <h3 className="bg-obsidian-50/70 px-6 py-2 text-sm text-slate-600">{s}</h3>
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {items
            .filter((i) => i.section === s)
            .map((i) => (
              <ChecklistItem key={i.id} item={i} onChanged={() => void load()} />
            ))}
        </ul>
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <PortalHeading
        title="Migration checklist"
        intro="The handoff's before-launch list and the usual after-launch checks. An item is done only with evidence or a recorded confirmation; automatic checks only suggest."
        actions={
          me.seo.manage && (
            <button type="button" onClick={() => void refresh()} disabled={busy} className={primaryBtn}>
              {busy ? "Checking…" : "Run automatic checks"}
            </button>
          )
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <Panel id={`${uid}-before`} title={`Before launch · ${data.progress.before.done}/${data.progress.before.total} done`}>
            {phase("BEFORE_LAUNCH")}
          </Panel>
          <Panel id={`${uid}-after`} title={`After launch · ${data.progress.after.done}/${data.progress.after.total} done`}>
            {phase("AFTER_LAUNCH")}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Change history

interface Entry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  by: string;
  at: string;
}

const ENTITY_OPTIONS = [
  { value: "", label: "Everything" },
  { value: "SeoPage", label: "Pages and posts" },
  { value: "SeoKeyword", label: "Keywords" },
  { value: "SeoRedirect", label: "Redirects" },
  { value: "SeoSchemaBlock", label: "Schema" },
  { value: "SeoImportBatch", label: "Imports" },
  { value: "SeoChecklistItem", label: "Checklist" },
  { value: "SeoTask", label: "Tasks" },
  { value: "SeoChangeRequest", label: "Approvals" },
  { value: "SeoSiteSettings", label: "Settings" },
  { value: "SeoIssue", label: "Audit issues" },
];

function summary(e: Entry) {
  const d = e.details ?? {};
  const bits = [d.path, d.fromPath && `${d.fromPath} → ${d.toPath ?? ""}`, d.title, d.key, d.kind].filter((v) => typeof v === "string" && v) as string[];
  const fields = Array.isArray(d.fields) ? (d.fields as string[]).join(", ") : Array.isArray(d.changed) ? (d.changed as string[]).join(", ") : "";
  return [bits.join(" · "), fields && `fields: ${fields}`].filter(Boolean).join(" · ");
}

export function ActivityView() {
  const uid = useId();
  const [entity, setEntity] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);

  const load = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams();
      if (entity) params.set("entityType", entity);
      if (before) params.set("before", before);
      const res = await portalApi<{ entries: Entry[]; next: string | null }>(`/activity?${params}`);
      if (!res.ok) return;
      setEntries((prev) => (before && prev ? [...prev, ...res.data.entries] : res.data.entries));
      setNext(res.data.next);
    },
    [entity],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PortalHeading title="Change history" intro="Who changed what and when, across the SEO portal and the admin SEO screens. Page-level history (with old and new values) is on each page." />
      <Panel id={`${uid}-log`} title="Changes">
        <div className="w-72 px-6 py-5">
          <Dropdown id={`${uid}-entity`} label="Show" options={ENTITY_OPTIONS} value={entity} onChange={setEntity} />
        </div>
        {!entries ? (
          <Loading />
        ) : entries.length === 0 ? (
          <Empty>No changes recorded.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
                <span className="min-w-0">
                  <span className="block text-base text-obsidian-900">
                    {words(e.action.replace(/^SEO_/, ""))}
                    {e.entityType === "SeoPage" && (
                      <Link href={`/seo/pages/${e.entityId}`} className="ml-2 text-sm text-ocean-700 underline underline-offset-2">
                        open
                      </Link>
                    )}
                  </span>
                  <span className="block break-words text-sm text-slate-600">{summary(e)}</span>
                </span>
                <span className="text-sm text-slate-600">
                  {e.by} · {when(e.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {next && (
          <div className="px-6 py-4">
            <button type="button" onClick={() => void load(next)} className={quietBtn}>
              Show older
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Settings: approvals (Google tag, verification, site-wide schema), llms.txt and business info

interface Request {
  id: string;
  kind: "TRACKING" | "VERIFICATION" | "SITE_SCHEMA";
  title: string;
  payload: Record<string, unknown>;
  before: Record<string, unknown> | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedBy: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  warnings: string[];
}
interface AdminState {
  tracking: { enabled?: boolean; ga4Id?: string | null; adsId?: string | null; adsConversionLabel?: string | null; conversionValue?: number | null; currency?: string | null; consentDefault?: string | null; conversionTriggers?: string | null };
  verification: string | null;
  handoffVerification: string;
  verificationMatchesHandoff: boolean | null;
  conversionScriptStored: boolean;
}

const HANDOFF_TRACKING = { ga4Id: "G-KH1432E703", adsId: "AW-16675422535", adsConversionLabel: "nzlDCJ7BJoYcEMeCu48-", conversionValue: 50, currency: "CAD" };

function RequestForms({ state, onDone }: { state: AdminState; onDone: () => void }) {
  const { me, notify } = usePortal();
  const uid = useId();
  const isAdmin = me.role === "ADMIN";
  const t = state.tracking;
  const [token, setToken] = useState(state.verification ?? "");
  const [enabled, setEnabled] = useState(Boolean(t.enabled));
  const [ga4Id, setGa4Id] = useState(t.ga4Id ?? "");
  const [adsId, setAdsId] = useState(t.adsId ?? "");
  const [label, setLabel] = useState(t.adsConversionLabel ?? "");
  const [value, setValue] = useState(t.conversionValue != null ? String(t.conversionValue) : "");
  const [currency, setCurrency] = useState(t.currency ?? "CAD");
  const [consent, setConsent] = useState(t.consentDefault ?? "");
  const [triggers, setTriggers] = useState(t.conversionTriggers ?? "");
  const [script, setScript] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function send(kind: "VERIFICATION" | "TRACKING") {
    setError("");
    setBusy(kind);
    const payload =
      kind === "VERIFICATION"
        ? { token: token.trim() || null }
        : {
            enabled,
            ga4Id: ga4Id.trim() || null,
            adsId: adsId.trim() || null,
            adsConversionLabel: label.trim() || null,
            conversionValue: value ? Number(value) : null,
            currency: currency.trim() || null,
            consentDefault: consent || null,
            conversionTriggers: triggers.trim() || null,
            ...(script.trim() ? { conversionScript: script } : {}),
          };
    const res = isAdmin ? await portalApi<{ warnings: string[] }>("/requests/apply", "POST", { kind, payload, reason: reason || null, confirm }) : await portalApi<{ warnings: string[] }>("/requests", "POST", { kind, payload, reason: reason || null });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't send this."));
    notify(isAdmin ? "Applied. The public site picks it up within a minute." : "Sent to an admin for approval.");
    if (res.data.warnings?.length) setError(res.data.warnings.join(" "));
    setConfirm(false);
    onDone();
  }

  if (!me.seo.manage) return null;
  return (
    <Panel id={`${uid}-forms`} title={isAdmin ? "Change site-wide settings" : "Ask an admin for a change"} description="These reach every page or grant access to the site's search data, so only an admin applies them. Each request keeps the value it replaces.">
      <div className="grid gap-8 px-6 py-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg text-obsidian-900">Google site verification</h3>
          <p className="text-sm text-slate-600">
            The meta tag content from Search Console, shown on the home page only. The handoff document reads <span className="break-all font-mono">{state.handoffVerification}</span>; check it against the tag on the live site before adding it.
          </p>
          <div>
            <label htmlFor={`${uid}-token`} className={labelCls}>
              Verification token
            </label>
            <input id={`${uid}-token`} value={token} onChange={(e) => setToken(e.target.value)} className={`${field} font-mono text-sm`} />
          </div>
          <button type="button" onClick={() => void send("VERIFICATION")} disabled={busy !== null || (isAdmin && !confirm)} className={primaryBtn}>
            {busy === "VERIFICATION" ? "Sending…" : isAdmin ? "Apply verification tag" : "Request verification tag"}
          </button>
        </div>
        <div className="space-y-4">
          <h3 className="text-lg text-obsidian-900">Google tag (GA4 and Google Ads)</h3>
          <p className="text-sm text-slate-600">
            One gtag.js loader for both IDs. The handoff lists {HANDOFF_TRACKING.ga4Id} and {HANDOFF_TRACKING.adsId} (conversion label {HANDOFF_TRACKING.adsConversionLabel}, {HANDOFF_TRACKING.conversionValue} {HANDOFF_TRACKING.currency}). Conversion events aren&apos;t sent until the triggers are confirmed with Nishika.
          </p>
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-ocean-600" />
            Load the Google tag on the site
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-ga4`} className={labelCls}>
                GA4 ID
              </label>
              <input id={`${uid}-ga4`} value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} placeholder={HANDOFF_TRACKING.ga4Id} className={`${field} font-mono text-sm`} />
            </div>
            <div>
              <label htmlFor={`${uid}-ads`} className={labelCls}>
                Google Ads ID
              </label>
              <input id={`${uid}-ads`} value={adsId} onChange={(e) => setAdsId(e.target.value)} placeholder={HANDOFF_TRACKING.adsId} className={`${field} font-mono text-sm`} />
            </div>
            <div>
              <label htmlFor={`${uid}-label`} className={labelCls}>
                Conversion label
              </label>
              <input id={`${uid}-label`} value={label} onChange={(e) => setLabel(e.target.value)} className={`${field} font-mono text-sm`} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`${uid}-value`} className={labelCls}>
                  Value
                </label>
                <input id={`${uid}-value`} type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor={`${uid}-cur`} className={labelCls}>
                  Currency
                </label>
                <input id={`${uid}-cur`} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={field} />
              </div>
            </div>
          </div>
          <Dropdown
            id={`${uid}-consent`}
            label="Consent mode default"
            options={[
              { value: "", label: "Not set" },
              { value: "denied", label: "Denied until the visitor consents" },
              { value: "granted", label: "Granted" },
            ]}
            value={consent}
            onChange={setConsent}
          />
          <div>
            <label htmlFor={`${uid}-triggers`} className={labelCls}>
              Conversion triggers (as confirmed by Nishika)
            </label>
            <textarea id={`${uid}-triggers`} rows={2} value={triggers} onChange={(e) => setTriggers(e.target.value)} placeholder="Not confirmed yet" className={field} />
          </div>
          <div>
            <label htmlFor={`${uid}-script`} className={labelCls}>
              Webflow footer conversion script (stored for reference, never run)
            </label>
            <textarea id={`${uid}-script`} rows={3} value={script} onChange={(e) => setScript(e.target.value)} placeholder={state.conversionScriptStored ? "A script is stored. Paste a new one to replace it." : "Paste the full script from Webflow → Site settings → Custom code"} className={`${field} font-mono text-sm`} />
          </div>
          <button type="button" onClick={() => void send("TRACKING")} disabled={busy !== null || (isAdmin && !confirm)} className={primaryBtn}>
            {busy === "TRACKING" ? "Sending…" : isAdmin ? "Apply Google tag settings" : "Request Google tag settings"}
          </button>
        </div>
      </div>
      <div className="space-y-3 border-t border-obsidian-900/[0.06] px-6 py-5">
        <div>
          <label htmlFor={`${uid}-reason`} className={labelCls}>
            Reason or source (kept with the change)
          </label>
          <input id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
        </div>
        {isAdmin && (
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 h-5 w-5 accent-ocean-600" />
            <span className="text-base text-obsidian-900">I understand this changes every page of the public site</span>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}

export function SettingsView() {
  const { me, notify } = usePortal();
  const uid = useId();
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [state, setState] = useState<AdminState | null>(null);

  const load = useCallback(async () => {
    const res = await portalApi<{ requests: Request[]; state: AdminState }>("/requests");
    if (res.ok) {
      setRequests(res.data.requests);
      setState(res.data.state);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function review(r: Request, decision: "approve" | "reject") {
    const note = decision === "reject" ? window.prompt("Why? (optional, kept with the request)") ?? "" : "";
    const res = await portalApi(`/requests/${r.id}/review`, "POST", { decision, note: note || null });
    notify(res.ok ? (decision === "approve" ? "Approved and applied." : "Rejected.") : errorOf(res.data, "Couldn't review the request."));
    void load();
  }

  async function cancel(r: Request) {
    const res = await portalApi(`/requests/${r.id}/cancel`, "POST", {});
    notify(res.ok ? "Request cancelled." : errorOf(res.data, "Couldn't cancel."));
    void load();
  }

  const t = state?.tracking;
  return (
    <div className="space-y-6">
      <PortalHeading title="Settings" intro="Site-wide settings that need an admin (Google tag, verification, site-wide schema), llms.txt and the business details structured data uses." />
      {state && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
            <p className="text-sm text-slate-600">Google tag</p>
            <p className="mt-1 text-xl">{t?.enabled ? `On: ${[t.ga4Id, t.adsId].filter(Boolean).join(", ")}` : "Off"}</p>
          </div>
          <div className="rounded-none bg-white p-5 ring-1 ring-obsidian-900/[0.07]">
            <p className="text-sm text-slate-600">Search Console verification tag</p>
            <p className="mt-1 text-xl">{state.verification ? (state.verificationMatchesHandoff ? "On (matches the handoff)" : "On (differs from the handoff)") : "Not added"}</p>
          </div>
        </div>
      )}
      <Panel id={`${uid}-requests`} title="Approvals" description={me.role === "ADMIN" ? "Requests from the SEO team. Approving applies the change immediately." : "Your requests and their outcome."}>
        {!requests ? (
          <Loading />
        ) : requests.length === 0 ? (
          <Empty>No requests yet.</Empty>
        ) : (
          <Grid label="Change requests" head={[["Request"], ["Asked by"], ["Status"], [""]]} minWidth="min-w-[48rem]">
            {requests.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-6 py-3">
                  <span className="block text-base text-obsidian-900">{r.title}</span>
                  <span className="block break-all font-mono text-sm text-slate-600">{JSON.stringify(r.payload)}</span>
                  {r.reason && <span className="block text-sm text-slate-700">Reason: {r.reason}</span>}
                  {r.warnings.map((w, i) => (
                    <span key={i} className="block text-sm text-red-700">
                      {w}
                    </span>
                  ))}
                </td>
                <td className="px-6 py-3 text-sm">
                  {r.requestedBy ?? "–"}
                  <span className="block text-slate-600">{when(r.createdAt)}</span>
                </td>
                <td className="px-6 py-3 text-sm">
                  <Chip className={r.status === "APPROVED" ? "bg-ocean-50 text-ocean-800" : r.status === "PENDING" ? "bg-summit-100 text-obsidian-900" : "bg-obsidian-100 text-slate-700"}>{words(r.status)}</Chip>
                  {r.reviewedBy && (
                    <span className="mt-1 block text-slate-600">
                      {r.reviewedBy} · {when(r.reviewedAt)}
                    </span>
                  )}
                  {r.reviewNote && <span className="block text-slate-600">{r.reviewNote}</span>}
                </td>
                <td className="px-6 py-3 text-right">
                  {r.status === "PENDING" && (
                    <span className="flex justify-end gap-2">
                      {me.role === "ADMIN" && (
                        <>
                          <button type="button" onClick={() => void review(r, "approve")} className={primaryBtn}>
                            Approve
                          </button>
                          <button type="button" onClick={() => void review(r, "reject")} className={quietBtn}>
                            Reject
                          </button>
                        </>
                      )}
                      {me.seo.manage && (
                        <button type="button" onClick={() => void cancel(r)} className={quietBtn}>
                          Cancel
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
      {state && <RequestForms state={state} onDone={() => void load()} />}
      <div id="llms">
        <LlmsPanel notify={notify} />
      </div>
    </div>
  );
}
