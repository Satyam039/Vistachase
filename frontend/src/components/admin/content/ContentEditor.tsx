"use client";

// Admin → Content: tour and destination copy (words and images). Prices, capacity, booking mode
// and URLs are not here: they belong to the booking engine and departures screens. Search titles
// and descriptions are edited in the SEO workspace. Every save is checked by /api/content (role,
// field rules, stale-copy protection) and shows up in the history below the form.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Chip, Empty, Loading, Panel, errorOf, field, labelCls, primaryBtn, quietBtn, when } from "@/components/admin/seo/shared";

interface Caps {
  role: string;
  content: { read: boolean; write: boolean };
}

interface TourListItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  isFeatured: boolean;
  updatedAt: string;
  destination: { name: string };
}

interface DestinationListItem {
  id: string;
  slug: string;
  name: string;
  isFeatured: boolean;
}

interface HistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  details: { changes?: Record<string, { from: unknown; to: unknown }> };
  user: { name: string; email: string } | null;
}

interface TourContent {
  id: string;
  slug: string;
  title: string;
  category: string;
  bookingMode: string;
  summary: string;
  description: string;
  durationHours: number;
  isFeatured: boolean;
  sortOrder: number;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  whatToBring: string[];
  facts: { label: string; value: string }[];
  faqs: { question: string; answer: string }[];
  tabs: unknown[];
  featuredImage: string;
  galleryImages: string[];
  crossSells: string[];
  updatedAt: string;
  destination: { name: string; slug: string };
}

interface DestinationContent {
  id: string;
  slug: string;
  name: string;
  province: string;
  region: string;
  description: string;
  heroImage: string;
  isFeatured: boolean;
}

type Selected = { kind: "tour" | "destination"; id: string } | null;

async function contentApi<T>(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(`/api/content${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error. Please try again." } as never };
  }
}

const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);
const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  description: "Description",
  durationHours: "Duration",
  isFeatured: "Featured",
  sortOrder: "Display order",
  highlights: "Highlights",
  inclusions: "Included",
  exclusions: "Not included",
  whatToBring: "What to bring",
  facts: "Key facts",
  faqs: "FAQs",
  tabs: "Itinerary and detail tabs",
  featuredImage: "Featured image",
  galleryImages: "Gallery",
  crossSells: "Related tours",
  name: "Name",
  province: "Province",
  region: "Region",
  heroImage: "Hero image",
};

export function ContentWorkspace({ onDenied }: { onDenied: () => void }) {
  const [caps, setCaps] = useState<Caps | null>(null);
  const [list, setList] = useState<{ tours: TourListItem[]; destinations: DestinationListItem[] } | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [me, res] = await Promise.all([contentApi<Caps>("/me"), contentApi<{ tours: TourListItem[]; destinations: DestinationListItem[] }>("/")]);
    if (me.status === 401 || me.status === 403) return onDenied();
    if (!res.ok || !me.ok) return setError(errorOf(res.data, "Couldn't load the content list."));
    setCaps(me.data);
    setList(res.data);
  }, [onDenied]);

  useEffect(() => {
    void load();
    const read = () => {
      const m = /^#(tour|destination)-([a-z0-9]+)$/i.exec(window.location.hash);
      setSelected(m ? { kind: m[1] as "tour" | "destination", id: m[2] } : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [load]);

  const open = (s: Selected) => {
    setSelected(s);
    window.history.replaceState(null, "", s ? `#${s.kind}-${s.id}` : window.location.pathname);
    window.scrollTo({ top: 0 });
  };

  const tours = useMemo(() => list?.tours.filter((t) => !q || `${t.title} ${t.slug}`.toLowerCase().includes(q.toLowerCase())) ?? [], [list, q]);

  if (error) return <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">{error}</p>;
  if (!list || !caps) return <Loading />;

  if (selected) {
    const back = (
      <button type="button" className={quietBtn} onClick={() => { open(null); void load(); }}>
        ← All content
      </button>
    );
    return selected.kind === "tour" ? (
      <TourEditor id={selected.id} canWrite={caps.content.write} back={back} />
    ) : (
      <DestinationEditor id={selected.id} canWrite={caps.content.write} back={back} />
    );
  }

  return (
    <div className="space-y-6">
      {!caps.content.write && <p className="rounded-2xl bg-obsidian-100 px-5 py-3 text-sm text-slate-700">Your role can read content but not change it.</p>}
      <Panel
        id="content-tours"
        title="Tours"
        description="The words and photos on each tour page. Prices, dates, seats and booking settings are managed on the Departures screen."
        actions={
          <>
            <label htmlFor="content-search" className="sr-only">Search tours</label>
            <input id="content-search" type="search" placeholder="Search tours" className={`${field} h-10 py-2`} value={q} onChange={(e) => setQ(e.target.value)} />
          </>
        }
      >
        {tours.length === 0 ? (
          <Empty>No tours match.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {tours.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <button type="button" className="text-left text-base text-obsidian-900 hover:underline" onClick={() => open({ kind: "tour", id: t.id })}>
                    {t.title}
                  </button>
                  <p className="text-sm text-slate-600">/{t.slug} · {t.destination.name} · last saved {when(t.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.isFeatured && <Chip className="bg-summit-100 text-obsidian-900">Featured</Chip>}
                  <Chip className="bg-obsidian-100 text-slate-700">{t.category.charAt(0) + t.category.slice(1).toLowerCase()}</Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel id="content-destinations" title="Destinations" description="Destination pages under /destinations.">
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {list.destinations.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <button type="button" className="text-left text-base text-obsidian-900 hover:underline" onClick={() => open({ kind: "destination", id: d.id })}>
                {d.name}
              </button>
              <span className="text-sm text-slate-600">/destinations/{d.slug}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Form pieces

function Field({ id, label, hint, count, max, children }: { id: string; label: string; hint?: ReactNode; count?: number; max?: number; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={labelCls}>{label}</label>
        {count !== undefined && max !== undefined && (
          <span className={`text-sm tabular-nums ${count > max ? "text-red-700" : "text-slate-600"}`}>{count}/{max}</span>
        )}
      </div>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

function ImagePreview({ src }: { src: string }) {
  if (!/^\/media\/[A-Za-z0-9\-._~/%]+$/.test(src)) return null;
  // eslint-disable-next-line @next/next/no-img-element -- admin preview of a path being typed
  return <img src={src} alt="" className="mt-2 h-28 w-44 rounded-lg object-cover ring-1 ring-obsidian-900/10" />;
}

function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <Panel id="content-history" title="History" description="Every saved change, newest first, with what it was before.">
      {entries.length === 0 ? (
        <Empty>No changes saved here yet.</Empty>
      ) : (
        <ul className="divide-y divide-obsidian-900/[0.06]">
          {entries.map((h) => (
            <li key={h.id} className="px-6 py-4">
              <p className="text-sm text-slate-600">
                {when(h.createdAt)} · {h.user?.name ?? "System"}
              </p>
              <ul className="mt-1 space-y-1">
                {Object.entries(h.details.changes ?? {}).map(([key, change]) => (
                  <li key={key} className="text-sm text-obsidian-900">
                    <details>
                      <summary className="cursor-pointer">{FIELD_LABEL[key] ?? key}</summary>
                      <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-obsidian-50 p-3 text-slate-700">
                        <span className="block text-slate-500">Before</span>
                        {typeof change.from === "string" ? change.from : JSON.stringify(change.from, null, 2)}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SaveBar({ dirty, busy, canWrite, onSave, notice, error }: { dirty: string[]; busy: boolean; canWrite: boolean; onSave: () => void; notice: string; error: string }) {
  // Publishes its height as --vc-bottom-bar-h (like the tour page's booking bar) so the floating
  // concierge button sits above the bar instead of covering the Save button.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--vc-bottom-bar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--vc-bottom-bar-h");
    };
  }, []);
  return (
    <div ref={ref} className="sticky bottom-0 z-10 -mx-page border-t border-obsidian-900/[0.07] bg-white/95 px-page py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className={`text-sm ${error ? "text-red-700" : "text-slate-700"}`}>
          {error || notice || (dirty.length ? `Unsaved: ${dirty.map((d) => FIELD_LABEL[d] ?? d).join(", ")}` : "No unsaved changes.")}
        </p>
        {canWrite && (
          <button type="button" className={primaryBtn} disabled={busy || dirty.length === 0} onClick={onSave}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Tour editor

type TourForm = Omit<TourContent, "highlights" | "inclusions" | "exclusions" | "whatToBring" | "galleryImages" | "tabs"> & {
  highlights: string;
  inclusions: string;
  exclusions: string;
  whatToBring: string;
  galleryImages: string;
  tabs: string;
};

const toForm = (t: TourContent): TourForm => ({
  ...t,
  highlights: t.highlights.join("\n"),
  inclusions: t.inclusions.join("\n"),
  exclusions: t.exclusions.join("\n"),
  whatToBring: t.whatToBring.join("\n"),
  galleryImages: t.galleryImages.join("\n"),
  tabs: JSON.stringify(t.tabs, null, 2),
});

/** The form's value for each saved field, in the shape the API takes. */
function tourFields(f: TourForm): { fields: Record<string, unknown>; tabsError: string } {
  let tabs: unknown = [];
  let tabsError = "";
  try {
    tabs = JSON.parse(f.tabs || "[]");
    if (!Array.isArray(tabs)) throw new Error();
  } catch {
    tabsError = "The itinerary and detail tabs aren't valid JSON. Undo your last change there, or ask for help.";
  }
  return {
    tabsError,
    fields: {
      title: f.title,
      summary: f.summary,
      description: f.description,
      durationHours: Number(f.durationHours),
      isFeatured: f.isFeatured,
      sortOrder: Number(f.sortOrder),
      highlights: lines(f.highlights),
      inclusions: lines(f.inclusions),
      exclusions: lines(f.exclusions),
      whatToBring: lines(f.whatToBring),
      facts: f.facts.filter((x) => x.label.trim() || x.value.trim()),
      faqs: f.faqs.filter((x) => x.question.trim() || x.answer.trim()),
      tabs,
      featuredImage: f.featuredImage.trim(),
      galleryImages: lines(f.galleryImages),
      crossSells: f.crossSells,
    },
  };
}

function TourEditor({ id, canWrite, back }: { id: string; canWrite: boolean; back: ReactNode }) {
  const [saved, setSaved] = useState<TourContent | null>(null);
  const [form, setForm] = useState<TourForm | null>(null);
  const [others, setOthers] = useState<{ slug: string; title: string }[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = (data: { tour: TourContent; otherTours: { slug: string; title: string }[]; history: HistoryEntry[] }) => {
    setSaved(data.tour);
    setForm(toForm(data.tour));
    setOthers(data.otherTours);
    setHistory(data.history);
  };

  useEffect(() => {
    void contentApi<{ tour: TourContent; otherTours: { slug: string; title: string }[]; history: HistoryEntry[] }>(`/tours/${id}`).then((res) => {
      if (!res.ok) return setError(errorOf(res.data, "Couldn't load this tour."));
      apply(res.data);
    });
  }, [id]);

  const { dirty, fields, tabsError } = useMemo(() => {
    if (!form || !saved) return { dirty: [] as string[], fields: {}, tabsError: "" };
    const now = tourFields(form);
    const was = tourFields(toForm(saved)).fields;
    const dirty = Object.keys(now.fields).filter((k) => JSON.stringify(now.fields[k]) !== JSON.stringify(was[k]));
    return { dirty, fields: Object.fromEntries(dirty.map((k) => [k, now.fields[k]])), tabsError: now.tabsError };
  }, [form, saved]);

  if (error && !form) return <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800">{error}</p>;
  if (!form || !saved) return <Loading />;

  const set = <K extends keyof TourForm>(key: K, value: TourForm[K]) => {
    setNotice("");
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };
  const ro = !canWrite;

  async function save() {
    if (tabsError) return setError(tabsError);
    setBusy(true);
    const res = await contentApi<{ tour: TourContent; otherTours: { slug: string; title: string }[]; history: HistoryEntry[]; changed: string[] }>(`/tours/${id}`, "PATCH", {
      fields,
      expectedUpdatedAt: saved!.updatedAt,
    });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save."));
    setError("");
    apply(res.data);
    setNotice(`Saved ${res.data.changed.map((c) => FIELD_LABEL[c] ?? c).join(", ")}. The tour page shows it now.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <Link href={`/${saved.slug}`} target="_blank" className={quietBtn}>
          View tour page <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <Panel
        id="tour-basics"
        title={saved.title}
        description={`/${saved.slug} · ${saved.destination.name}. The address, price, dates and booking settings aren't edited here.`}
      >
        <div className="grid gap-5 px-6 py-5">
          <Field id="t-title" label="Title (the page heading)" count={form.title.length} max={150}>
            <input id="t-title" className={field} readOnly={ro} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field id="t-summary" label="Summary (cards and listings)" count={form.summary.length} max={400}>
            <textarea id="t-summary" rows={3} className={field} readOnly={ro} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <Field id="t-description" label="Description" hint="Plain text. Each line becomes a paragraph; “Label: text” lines show as a list." count={form.description.length} max={20000}>
            <textarea id="t-description" rows={10} className={field} readOnly={ro} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="t-duration" label="Duration (hours)">
              <input id="t-duration" type="number" min={0.25} step={0.25} className={field} readOnly={ro} value={form.durationHours} onChange={(e) => set("durationHours", Number(e.target.value))} />
            </Field>
            <Field id="t-order" label="Display order" hint="Lower numbers show first.">
              <input id="t-order" type="number" min={0} className={field} readOnly={ro} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
            </Field>
            <div className="flex items-center gap-3 pt-7">
              <input id="t-featured" type="checkbox" className="h-5 w-5" disabled={ro} checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              <label htmlFor="t-featured" className="text-base text-obsidian-900">Featured on the home page</label>
            </div>
          </div>
        </div>
      </Panel>

      <Panel id="tour-lists" title="Lists" description="One item per line.">
        <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
          {(
            [
              ["highlights", "Highlights"],
              ["inclusions", "Included"],
              ["exclusions", "Not included"],
              ["whatToBring", "What to bring"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} id={`t-${key}`} label={label}>
              <textarea id={`t-${key}`} rows={6} className={field} readOnly={ro} value={form[key]} onChange={(e) => set(key, e.target.value)} />
            </Field>
          ))}
        </div>
      </Panel>

      <Panel id="tour-facts" title="Key facts" description="Up to 8 short facts shown at the top of the page, such as Duration or Pickup.">
        <div className="space-y-3 px-6 py-5">
          {form.facts.map((fact, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Field id={`t-fact-l-${i}`} label={`Fact ${i + 1} label`}>
                <input id={`t-fact-l-${i}`} className={field} readOnly={ro} value={fact.label} onChange={(e) => set("facts", form.facts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </Field>
              <Field id={`t-fact-v-${i}`} label={`Fact ${i + 1} value`}>
                <input id={`t-fact-v-${i}`} className={field} readOnly={ro} value={fact.value} onChange={(e) => set("facts", form.facts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              </Field>
              {!ro && (
                <button type="button" className={quietBtn} onClick={() => set("facts", form.facts.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Remove fact {i + 1}</span>
                </button>
              )}
            </div>
          ))}
          {!ro && form.facts.length < 8 && (
            <button type="button" className={quietBtn} onClick={() => set("facts", [...form.facts, { label: "", value: "" }])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add fact
            </button>
          )}
        </div>
      </Panel>

      <Panel id="tour-faqs" title="FAQs" description="Shown on the tour page and marked up for search engines as FAQs.">
        <div className="space-y-5 px-6 py-5">
          {form.faqs.map((faq, i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-obsidian-50/70 p-4">
              <Field id={`t-faq-q-${i}`} label={`Question ${i + 1}`}>
                <input id={`t-faq-q-${i}`} className={field} readOnly={ro} value={faq.question} onChange={(e) => set("faqs", form.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              </Field>
              <Field id={`t-faq-a-${i}`} label={`Answer ${i + 1}`}>
                <textarea id={`t-faq-a-${i}`} rows={3} className={field} readOnly={ro} value={faq.answer} onChange={(e) => set("faqs", form.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
              </Field>
              {!ro && (
                <button type="button" className={quietBtn} onClick={() => set("faqs", form.faqs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove question {i + 1}
                </button>
              )}
            </div>
          ))}
          {!ro && (
            <button type="button" className={quietBtn} onClick={() => set("faqs", [...form.faqs, { question: "", answer: "" }])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add question
            </button>
          )}
        </div>
      </Panel>

      <Panel id="tour-images" title="Photos" description="Site images under /media/ (photos are added to the media library by a developer for now).">
        <div className="grid gap-5 px-6 py-5">
          <Field id="t-featured-image" label="Featured image">
            <input id="t-featured-image" className={field} readOnly={ro} value={form.featuredImage} onChange={(e) => set("featuredImage", e.target.value)} />
            <ImagePreview src={form.featuredImage} />
          </Field>
          <Field id="t-gallery" label="Gallery (one image per line)">
            <textarea id="t-gallery" rows={6} className={`${field} font-mono text-sm`} readOnly={ro} value={form.galleryImages} onChange={(e) => set("galleryImages", e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {lines(form.galleryImages).slice(0, 12).map((src) => (
              <ImagePreview key={src} src={src} />
            ))}
          </div>
        </div>
      </Panel>

      <Panel id="tour-related" title="Related tours" description="Suggested at the bottom of this tour's page (up to 12).">
        <fieldset className="grid gap-2 px-6 py-5 sm:grid-cols-2">
          <legend className="sr-only">Related tours</legend>
          {others.map((o) => (
            <label key={o.slug} className="flex items-center gap-3 text-base text-obsidian-900">
              <input
                type="checkbox"
                className="h-5 w-5"
                disabled={ro}
                checked={form.crossSells.includes(o.slug)}
                onChange={(e) => set("crossSells", e.target.checked ? [...form.crossSells, o.slug] : form.crossSells.filter((s) => s !== o.slug))}
              />
              {o.title}
            </label>
          ))}
        </fieldset>
      </Panel>

      <Panel
        id="tour-tabs"
        title="Itinerary and detail tabs (advanced)"
        description="The tabbed sections on the tour page, as JSON: [{label, sections: [{heading, body[], items[], steps[{time, text}], stops[{name, text}], note}]}]. Saving checks the structure."
      >
        <div className="px-6 py-5">
          <label htmlFor="t-tabs" className="sr-only">Tabs JSON</label>
          <textarea id="t-tabs" rows={14} spellCheck={false} className={`${field} font-mono text-sm`} readOnly={ro} value={form.tabs} onChange={(e) => set("tabs", e.target.value)} />
          {tabsError && <p role="alert" className="mt-2 text-sm text-red-700">{tabsError}</p>}
        </div>
      </Panel>

      <History entries={history} />
      <SaveBar dirty={dirty} busy={busy} canWrite={canWrite} onSave={save} notice={notice} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Destination editor

function DestinationEditor({ id, canWrite, back }: { id: string; canWrite: boolean; back: ReactNode }) {
  const [saved, setSaved] = useState<DestinationContent | null>(null);
  const [form, setForm] = useState<DestinationContent | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = (data: { destination: DestinationContent; history: HistoryEntry[] }) => {
    setSaved(data.destination);
    setForm(data.destination);
    setHistory(data.history);
  };

  useEffect(() => {
    void contentApi<{ destination: DestinationContent; history: HistoryEntry[] }>(`/destinations/${id}`).then((res) => {
      if (!res.ok) return setError(errorOf(res.data, "Couldn't load this destination."));
      apply(res.data);
    });
  }, [id]);

  if (error && !form) return <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800">{error}</p>;
  if (!form || !saved) return <Loading />;

  const keys = ["name", "province", "region", "description", "heroImage", "isFeatured"] as const;
  const dirty = keys.filter((k) => form[k] !== saved[k]);
  const set = <K extends keyof DestinationContent>(key: K, value: DestinationContent[K]) => {
    setNotice("");
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };
  const ro = !canWrite;

  async function save() {
    setBusy(true);
    const res = await contentApi<{ destination: DestinationContent; history: HistoryEntry[]; changed: string[] }>(`/destinations/${id}`, "PATCH", {
      fields: Object.fromEntries(dirty.map((k) => [k, form![k]])),
      ...(history[0] ? { expectedUpdatedAt: history[0].createdAt } : {}),
    });
    setBusy(false);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't save."));
    setError("");
    apply(res.data);
    setNotice(`Saved ${res.data.changed.map((c) => FIELD_LABEL[c] ?? c).join(", ")}.`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <Link href={`/destinations/${saved.slug}`} target="_blank" className={quietBtn}>
          View destination page <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <Panel id="destination-basics" title={saved.name} description={`/destinations/${saved.slug}`}>
        <div className="grid gap-5 px-6 py-5">
          <Field id="d-name" label="Name" count={form.name.length} max={80}>
            <input id="d-name" className={field} readOnly={ro} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="d-province" label="Province">
              <input id="d-province" className={field} readOnly={ro} value={form.province} onChange={(e) => set("province", e.target.value)} />
            </Field>
            <Field id="d-region" label="Region">
              <input id="d-region" className={field} readOnly={ro} value={form.region} onChange={(e) => set("region", e.target.value)} />
            </Field>
          </div>
          <Field id="d-description" label="Description" count={form.description.length} max={20000}>
            <textarea id="d-description" rows={10} className={field} readOnly={ro} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field id="d-hero" label="Hero image" hint="A site image under /media/.">
            <input id="d-hero" className={field} readOnly={ro} value={form.heroImage} onChange={(e) => set("heroImage", e.target.value)} />
            <ImagePreview src={form.heroImage} />
          </Field>
          <div className="flex items-center gap-3">
            <input id="d-featured" type="checkbox" className="h-5 w-5" disabled={ro} checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
            <label htmlFor="d-featured" className="text-base text-obsidian-900">Featured</label>
          </div>
        </div>
      </Panel>
      <History entries={history} />
      <SaveBar dirty={[...dirty]} busy={busy} canWrite={canWrite} onSave={save} notice={notice} error={error} />
    </div>
  );
}
