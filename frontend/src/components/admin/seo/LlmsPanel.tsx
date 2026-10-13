"use client";

// llms.txt and business details (/admin/seo), plus the status of search data integrations.
// The preview below mirrors llmsTxt() in backend/src/modules/seo/seo.public.ts; keep them in step.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { Chip, Empty, Loading, Panel, dangerBtn, day, errorOf, field, labelCls, primaryBtn, quietBtn, seoApi } from "./shared";

const SIGNED_OUT = "Sign in with an admin account.";
const signedOut = (status: number) => status === 401 || status === 403;

type Section = "PRIMARY" | "SECONDARY";

interface Settings {
  siteName: string;
  summary: string | null;
  aboutText: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  serviceArea: string[];
  businessHours: string | null;
  googleBusinessUrl: string | null;
  sameAs: string[];
  llmsEnabled: boolean;
  updatedAt: string | null;
}

interface Entry {
  key: string;
  title: string;
  path: string;
  description: string;
  section: Section;
}

interface Form {
  siteName: string;
  summary: string;
  aboutText: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  serviceArea: string;
  businessHours: string;
  googleBusinessUrl: string;
  sameAs: string;
  llmsEnabled: boolean;
}

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

let keySeq = 0;
const newKey = () => `e${++keySeq}`;

const toForm = (s: Settings): Form => ({
  siteName: s.siteName ?? "",
  summary: s.summary ?? "",
  aboutText: s.aboutText ?? "",
  contactEmail: s.contactEmail ?? "",
  contactPhone: s.contactPhone ?? "",
  address: s.address ?? "",
  serviceArea: (s.serviceArea ?? []).join("\n"),
  businessHours: s.businessHours ?? "",
  googleBusinessUrl: s.googleBusinessUrl ?? "",
  sameAs: (s.sameAs ?? []).join("\n"),
  llmsEnabled: !!s.llmsEnabled,
});

/** Same output as llmsTxt() on the server, built from the unsaved form. */
function buildPreview(form: Form, entries: Entry[], origin: string, updatedAt: string | null): string {
  const abs = (p: string) => (p.startsWith("/") ? `${origin}${p}` : p);
  const line = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/[\r\n]+/g, " ")
      .replace(/[[\]]/g, "")
      .trim();
  const list = (section: Section) =>
    entries
      .filter((e) => e.section === section && e.title.trim() && e.path.trim())
      .map((e) => `- [${line(e.title)}](${abs(e.path.trim())})${e.description.trim() ? `: ${line(e.description)}` : ""}`)
      .join("\n");

  const parts = [`# ${line(form.siteName)}`];
  if (form.summary.trim()) parts.push(`> ${line(form.summary)}`);
  if (form.aboutText.trim()) parts.push(form.aboutText.replace(/\r/g, "").trim());
  const primary = list("PRIMARY");
  if (primary) parts.push(`## Key pages\n\n${primary}`);
  const area = lines(form.serviceArea);
  const contact = [
    form.contactEmail.trim() && `- Email: ${line(form.contactEmail)}`,
    form.contactPhone.trim() && `- Phone: ${line(form.contactPhone)}`,
    form.address.trim() && `- Address: ${line(form.address)}`,
    area.length > 0 && `- Service area: ${area.map(line).join(", ")}`,
    form.businessHours.trim() && `- Hours: ${line(form.businessHours)}`,
    form.googleBusinessUrl.trim() && `- Google Business Profile: ${form.googleBusinessUrl.trim()}`,
  ].filter(Boolean);
  if (contact.length > 0) parts.push(`## Contact\n\n${contact.join("\n")}`);
  const secondary = list("SECONDARY");
  if (secondary) parts.push(`## Optional\n\n${secondary}`);
  parts.push(`Last updated: ${updatedAt ? day(updatedAt) : new Date().toISOString().slice(0, 10)}`);
  return `${parts.join("\n\n")}\n`;
}

const SECTIONS = [
  { value: "PRIMARY", label: "Key pages" },
  { value: "SECONDARY", label: "Optional" },
];

export function LlmsPanel({ notify }: { notify: (m: string) => void }) {
  const [form, setForm] = useState<Form | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  const apply = useCallback((data: { settings: Settings; entries: { id: string; title: string; path: string; description: string | null; section: Section }[] }) => {
    setForm(toForm(data.settings));
    setUpdatedAt(data.settings.updatedAt ?? null);
    setEntries((data.entries ?? []).map((e) => ({ key: e.id || newKey(), title: e.title, path: e.path, description: e.description ?? "", section: e.section })));
  }, []);

  const load = useCallback(async () => {
    const { ok, status, data } = await seoApi<{ settings: Settings; entries: { id: string; title: string; path: string; description: string | null; section: Section }[] }>("/settings");
    if (ok && data.settings) {
      apply(data);
      setError("");
    } else setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't load the settings."));
  }, [apply]);

  useEffect(() => {
    void load();
    setOrigin(window.location.origin);
  }, [load]);

  const preview = useMemo(() => (form ? buildPreview(form, entries, origin, updatedAt) : ""), [form, entries, origin, updatedAt]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setEntry = (key: string, patch: Partial<Entry>) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const move = (index: number, by: -1 | 1) =>
    setEntries((list) => {
      const to = index + by;
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    const { ok, status, data } = await seoApi<{ settings: Settings; entries: { id: string; title: string; path: string; description: string | null; section: Section }[] }>("/settings", "PUT", {
      siteName: form.siteName.trim(),
      summary: form.summary,
      aboutText: form.aboutText,
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      address: form.address,
      serviceArea: lines(form.serviceArea),
      businessHours: form.businessHours,
      googleBusinessUrl: form.googleBusinessUrl.trim() || null,
      sameAs: lines(form.sameAs),
      llmsEnabled: form.llmsEnabled,
      entries: entries.map((en) => ({
        title: en.title.trim(),
        path: en.path.trim(),
        ...(en.description.trim() ? { description: en.description.trim() } : {}),
        section: en.section,
      })),
    });
    setBusy(false);
    if (!ok) return setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't save the settings."));
    if (data.settings) apply(data);
    notify(form.llmsEnabled ? "Settings saved. /llms.txt is published." : "Settings saved. /llms.txt stays switched off.");
  }

  if (!form) {
    return (
      <Panel id="seo-llms" title="llms.txt and business details">
        {error ? (
          <div className="px-6 py-5">
            <Alert>{error}</Alert>
          </div>
        ) : (
          <Loading />
        )}
      </Panel>
    );
  }

  const text = (k: "siteName" | "contactEmail" | "contactPhone" | "address" | "businessHours" | "googleBusinessUrl", label: string, extra: Record<string, unknown> = {}) => (
    <div>
      <label htmlFor={`llms-${k}`} className={labelCls}>
        {label}
      </label>
      <input id={`llms-${k}`} value={form[k]} onChange={(e) => set(k, e.target.value)} className={field} {...extra} />
    </div>
  );

  return (
    <Panel
      id="seo-llms"
      title="llms.txt and business details"
      description="A plain-text summary of Vista Chase for AI assistants, plus the business details structured data may use. Only list facts you can stand behind: no invented awards, prices or ratings."
    >
      <form onSubmit={save} className="space-y-8 px-6 py-6" noValidate>
        {error && <Alert>{error}</Alert>}

        <div className="grid gap-4 md:grid-cols-2">
          {text("siteName", "Site name", { required: true, maxLength: 80 })}
          {text("googleBusinessUrl", "Google Business Profile link", { type: "url", placeholder: "https://" })}
          <div className="md:col-span-2">
            <label htmlFor="llms-summary" className={labelCls}>
              Summary (one or two sentences)
            </label>
            <textarea id="llms-summary" value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={500} rows={2} className={field} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="llms-about" className={labelCls}>
              About
            </label>
            <textarea id="llms-about" value={form.aboutText} onChange={(e) => set("aboutText", e.target.value)} maxLength={2000} rows={5} className={field} />
          </div>
          {text("contactEmail", "Contact email", { type: "email", autoComplete: "off" })}
          {text("contactPhone", "Contact phone", { type: "tel", autoComplete: "off" })}
          {text("address", "Address", { maxLength: 300 })}
          {text("businessHours", "Business hours", { maxLength: 300, placeholder: "6 a.m. – 9 p.m. Mountain Time" })}
          <div>
            <label htmlFor="llms-area" className={labelCls}>
              Service area (one per line)
            </label>
            <textarea id="llms-area" value={form.serviceArea} onChange={(e) => set("serviceArea", e.target.value)} rows={4} className={field} />
          </div>
          <div>
            <label htmlFor="llms-sameas" className={labelCls}>
              Official profiles, https:// (one per line)
            </label>
            <textarea id="llms-sameas" value={form.sameAs} onChange={(e) => set("sameAs", e.target.value)} rows={4} className={field} />
          </div>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg text-obsidian-900">Pages listed in llms.txt</legend>
          <p className="text-sm text-slate-600">Site paths like /private-tours or full https:// links. Key pages come first; Optional pages are listed at the end.</p>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-600">No pages listed yet.</p>
          ) : (
            <ol className="space-y-3">
              {entries.map((en, i) => {
                const p = `llms-entry-${en.key}`;
                const name = en.title.trim() || `entry ${i + 1}`;
                return (
                  <li key={en.key} className="grid gap-3 rounded-2xl bg-obsidian-50/60 p-4 md:grid-cols-[1fr_1fr_12rem_auto]">
                    <div>
                      <label htmlFor={`${p}-title`} className={labelCls}>
                        Title
                      </label>
                      <input id={`${p}-title`} value={en.title} onChange={(e) => setEntry(en.key, { title: e.target.value })} maxLength={120} className={field} />
                    </div>
                    <div>
                      <label htmlFor={`${p}-path`} className={labelCls}>
                        Path or link
                      </label>
                      <input id={`${p}-path`} value={en.path} onChange={(e) => setEntry(en.key, { path: e.target.value })} placeholder="/private-tours" maxLength={500} className={field} />
                    </div>
                    <Dropdown id={`${p}-section`} label="Section" value={en.section} onChange={(v) => setEntry(en.key, { section: v as Section })} options={SECTIONS} />
                    <div className="flex items-end gap-2">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={quietBtn} aria-label={`Move ${name} up`}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === entries.length - 1} className={quietBtn} aria-label={`Move ${name} down`}>
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setEntries((list) => list.filter((x) => x.key !== en.key))} className={dangerBtn} aria-label={`Remove ${name}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="md:col-span-4">
                      <label htmlFor={`${p}-desc`} className={labelCls}>
                        Description (optional)
                      </label>
                      <input id={`${p}-desc`} value={en.description} onChange={(e) => setEntry(en.key, { description: e.target.value })} maxLength={300} className={field} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <button type="button" onClick={() => setEntries((list) => [...list, { key: newKey(), title: "", path: "", description: "", section: "PRIMARY" }])} disabled={entries.length >= 60} className={quietBtn}>
            Add a page
          </button>
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-center">
            <input id="llms-enabled" type="checkbox" checked={form.llmsEnabled} onChange={(e) => set("llmsEnabled", e.target.checked)} className="h-5 w-5 accent-ocean-600" />
            <label htmlFor="llms-enabled" className="ml-2 text-base text-obsidian-900">
              Publish /llms.txt
            </label>
          </div>
          <p className="text-sm text-slate-600">
            <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
              Open /llms.txt<span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            – it returns 404 while switched off. Changes appear there after you save.
          </p>
        </div>

        <div className="space-y-2">
          <h3 id="llms-preview-heading" className="text-lg text-obsidian-900">
            Preview
          </h3>
          <pre aria-labelledby="llms-preview-heading" tabIndex={0} className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-obsidian-50 p-4 font-code text-sm text-obsidian-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600">
            {preview}
          </pre>
        </div>

        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
    </Panel>
  );
}

interface Integration {
  id: string;
  name: string;
  connected: boolean;
  configured: boolean;
  message: string;
  lastDataAt: string | null;
}

export function IntegrationsPanel() {
  const [list, setList] = useState<Integration[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const { ok, status, data } = await seoApi<{ integrations: Integration[] }>("/integrations");
      if (ok) setList(data.integrations ?? []);
      else {
        setList([]);
        setError(signedOut(status) ? SIGNED_OUT : errorOf(data, "Couldn't load integrations."));
      }
    })();
  }, []);

  return (
    <Panel
      id="seo-integrations"
      title="Search data integrations"
      description="Rankings, clicks, impressions and traffic are not shown anywhere in this dashboard until a provider is connected and verified. Setup steps: docs/SEO.md."
    >
      {error && (
        <div className="px-6 pt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        !error && <Empty>No integrations are available.</Empty>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {list.map((it) => (
            <li key={it.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
              <div className="max-w-2xl">
                <p className="text-base text-obsidian-900">{it.name}</p>
                <p className="mt-1 text-sm text-slate-600">{it.message}</p>
                {it.lastDataAt && <p className="mt-1 text-sm text-slate-600">Last data stored: {it.lastDataAt}</p>}
              </div>
              {it.connected ? (
                <Chip className="bg-ocean-50 text-ocean-800">Connected</Chip>
              ) : it.configured ? (
                <Chip className="bg-summit-100 text-obsidian-900">Configured, not connected</Chip>
              ) : (
                <Chip className="bg-obsidian-100 text-slate-700">Not connected</Chip>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
