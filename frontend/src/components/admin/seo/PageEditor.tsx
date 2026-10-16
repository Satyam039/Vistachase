"use client";

// SEO page editor (/admin/seo/pages/[id] and the SEO portal's /seo/pages/[id]): metadata overrides,
// guide and blog post content (CMS pages only), publishing, keyword mappings and the change log for
// one page. Every call goes through seoApi (/api/seo/admin/*); in the portal (mode="draft") edits to
// a published page are saved as a draft (/api/seo/portal/pages/:id/draft) and go live only when
// someone with publishing rights publishes the draft. Empty fields fall back to what the page shows today (the tour or
// destination record, else the last crawl), shown as placeholders.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { StaffSignIn } from "@/components/admin/AdminHeader";
import { ImageField } from "@/components/admin/seo/ImageField";
import { Dropdown } from "@/components/forms/Dropdown";
import {
  CheckList,
  Chip,
  Empty,
  Loading,
  Panel,
  SEVERITY_STYLE,
  STATUS_STYLE,
  TRACK_LABEL,
  dangerBtn,
  day,
  errorOf,
  field,
  labelCls,
  primaryBtn,
  quietBtn,
  portalApi,
  seoApi,
  when,
  words,
  type FieldCheck,
  type Keyword,
  type PageType,
  type PublishStatus,
  type Severity,
  type Track,
} from "@/components/admin/seo/shared";

// ---------------------------------------------------------------------------------------------
// Types (the GET /pages/:id payload)

type ConversionGoal = "BOOKING" | "ENQUIRY" | "CALL" | "NEWSLETTER" | "NONE";
type Role = "PRIMARY" | "SECONDARY";

interface Faq {
  question: string;
  answer: string;
}

interface Mapping {
  id: string;
  role: Role;
  keyword: {
    id: string;
    keyword: string;
    intent: Keyword["intent"];
    funnelStage: Keyword["funnelStage"];
    track: Track;
    searchVolume: number | null;
    volumeBasis: Keyword["volumeBasis"];
    archivedAt: string | null;
  };
}

interface Revision {
  id: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  note: string | null;
  userId: string | null;
  createdAt: string;
}

interface PageIssue {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  path: string | null;
}

interface SeoPage {
  id: string;
  path: string;
  pageType: PageType;
  source: "STATIC_ROUTE" | "TOUR" | "DESTINATION" | "CMS";
  label: string;
  status: PublishStatus;
  publishAt: string | null;
  publishedAt: string | null;
  important: boolean;
  seoTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  focusKeyword: string | null;
  secondaryKeywords: string[];
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  breadcrumbLabel: string | null;
  excerpt: string | null;
  body: string | null;
  answerSnippet: string | null;
  citationFact: string | null;
  faqs: unknown;
  authorName: string | null;
  authorBio: string | null;
  reviewedAt: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  imageTitle: string | null;
  imageCaption: string | null;
  imageFileName: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  conversionGoal: ConversionGoal;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  pillar: string | null;
  tags: string[];
  relatedPaths: string[];
  sitemapPriority: number | null;
  sitemapInclude: boolean;
  featured: boolean;
  thumbnailImage: string | null;
  thumbnailAlt: string | null;
  datePublished: string | null;
  dateModified: string | null;
  lastCrawledAt: string | null;
  updatedAt: string;
  mappings: Mapping[];
  revisions: Revision[];
  issues: PageIssue[];
}

interface LiveCrawl {
  status?: number;
  title?: string | null;
  description?: string | null;
  h1?: string[];
  canonical?: string | null;
  robots?: string | null;
  ogTitle?: string | null;
  ogImage?: string | null;
  wordCount?: number;
  internalLinks?: number;
  error?: string;
}

interface Defaults {
  title: string | null;
  description: string | null;
  h1: string | null;
  canonical: string | null;
  image: string | null;
}

interface Detail {
  page: SeoPage;
  live: LiveCrawl | null;
  defaults: Defaults;
  checks: FieldCheck[];
  completeness: number;
}

// ---------------------------------------------------------------------------------------------
// Form model: every control edits a string or boolean; lists are joined text until saving.

const TEXT_FIELDS = [
  "label", "seoTitle", "metaDescription", "h1", "focusKeyword", "canonicalUrl", "ogTitle", "ogDescription", "ogImage",
  "twitterTitle", "twitterDescription", "twitterImage", "breadcrumbLabel", "excerpt", "body", "answerSnippet", "citationFact",
  "authorName", "authorBio", "featuredImage", "featuredImageAlt", "imageTitle", "imageCaption", "imageFileName", "ctaText",
  "ctaUrl", "utmSource", "utmMedium", "utmCampaign", "pillar", "thumbnailImage", "thumbnailAlt",
] as const;
type TextKey = (typeof TEXT_FIELDS)[number];

/** Fields that only exist for CMS (guide) pages. */
const CMS_ONLY = new Set(["slug", "excerpt", "body", "answerSnippet", "citationFact", "faqs", "authorName", "authorBio", "reviewedAt", "relatedPaths", "pillar", "tags", "thumbnailImage", "thumbnailAlt", "datePublished", "dateModified", "featured"]);

type Form = Record<TextKey, string> & {
  slug: string;
  secondaryKeywords: string;
  tags: string;
  relatedPaths: string;
  reviewedAt: string;
  datePublished: string;
  dateModified: string;
  sitemapPriority: string;
  sitemapInclude: boolean;
  featured: boolean;
  conversionGoal: ConversionGoal;
  robotsIndex: boolean;
  robotsFollow: boolean;
  important: boolean;
  faqs: Faq[];
};

/** CMS pages live under /guides/ (guides) or /blog-post/ (blog posts migrated from Webflow). */
const BLOG_PREFIX = "/blog-post/";
const cmsPrefix = (path: string) => (path.startsWith(BLOG_PREFIX) ? BLOG_PREFIX : "/guides/");

function faqsOf(value: unknown): Faq[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({ question: typeof f.question === "string" ? f.question : "", answer: typeof f.answer === "string" ? f.answer : "" }));
}

function formOf(p: SeoPage): Form {
  const text = Object.fromEntries(TEXT_FIELDS.map((k) => [k, (p[k] as string | null) ?? ""])) as Record<TextKey, string>;
  return {
    ...text,
    slug: p.source === "CMS" && p.path.startsWith(cmsPrefix(p.path)) ? p.path.slice(cmsPrefix(p.path).length) : "",
    secondaryKeywords: p.secondaryKeywords.join(", "),
    tags: p.tags.join(", "),
    relatedPaths: p.relatedPaths.join("\n"),
    reviewedAt: p.reviewedAt ? p.reviewedAt.slice(0, 10) : "",
    datePublished: p.datePublished ? p.datePublished.slice(0, 10) : "",
    dateModified: p.dateModified ? p.dateModified.slice(0, 10) : "",
    sitemapPriority: p.sitemapPriority === null || p.sitemapPriority === undefined ? "" : String(p.sitemapPriority),
    sitemapInclude: p.sitemapInclude ?? true,
    featured: p.featured ?? false,
    conversionGoal: p.conversionGoal,
    robotsIndex: p.robotsIndex,
    robotsFollow: p.robotsFollow,
    important: p.important,
    faqs: faqsOf(p.faqs),
  };
}

const commaList = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
const lineList = (s: string) => s.split("\n").map((t) => t.trim()).filter(Boolean);

/** Only the fields that differ from the saved page, in the shape pageUpdateSchema accepts. */
function changesOf(form: Form, saved: Form, isCms: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(form) as (keyof Form)[]) {
    if (!isCms && CMS_ONLY.has(key)) continue;
    if (JSON.stringify(form[key]) === JSON.stringify(saved[key])) continue;
    const v = form[key];
    if (key === "secondaryKeywords" || key === "tags") out[key] = commaList(v as string);
    else if (key === "relatedPaths") out[key] = lineList(v as string);
    else if (key === "reviewedAt" || key === "datePublished" || key === "dateModified") out[key] = v === "" ? null : v;
    else if (key === "sitemapPriority") out[key] = v === "" ? null : Number(v);
    else if (key === "faqs") out[key] = (v as Faq[]).map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }));
    else out[key] = v;
  }
  return out;
}

/** The page as it would look with its draft applied (the draft holds API-shaped values). */
function withDraft(page: SeoPage, draft: Record<string, unknown> | null): SeoPage {
  if (!draft) return page;
  const { slug, ...rest } = draft;
  const merged = { ...page, ...rest } as SeoPage;
  if (typeof slug === "string" && page.source === "CMS") merged.path = `${cmsPrefix(page.path)}${slug}`;
  return merged;
}

interface DraftState {
  draft: Record<string, unknown> | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------------------------
// Small pieces

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function Counter({ id, count, min, max, unit, usingDefault }: { id: string; count: number; min: number; max: number; unit: "characters" | "words"; usingDefault: boolean }) {
  const inRange = count >= min && count <= max;
  return (
    <p id={id} className={`mt-1.5 text-sm ${inRange ? "text-ocean-700" : "text-slate-600"}`}>
      {count} {unit}
      {usingDefault ? " (current default)" : ""}
      {inRange ? " · within the target" : ` · aim for ${min} to ${max} ${unit}`}
    </p>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  describedBy,
  multiline,
  rows = 3,
  type = "text",
  className = "",
  mono,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | null;
  hint?: ReactNode;
  describedBy?: string;
  multiline?: boolean;
  rows?: number;
  type?: string;
  className?: string;
  mono?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const described = [describedBy, hintId].filter(Boolean).join(" ") || undefined;
  const cls = `${field} ${mono ? "font-mono text-sm" : ""}`;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? undefined} aria-describedby={described} className={cls} />
      ) : (
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? undefined} aria-describedby={described} className={cls} />
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}

function Toggle({ id, label, checked, onChange, hint }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-1 h-5 w-5 shrink-0 accent-ocean-600" />
      <div>
        <label htmlFor={id} className="text-base text-obsidian-900">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-slate-600">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-base text-obsidian-900">{children}</dd>
    </div>
  );
}

const SOURCE_LABEL: Record<SeoPage["source"], string> = {
  STATIC_ROUTE: "Site code",
  TOUR: "Tour record",
  DESTINATION: "Destination record",
  CMS: "Guide (edited here)",
};

const GOALS: { value: ConversionGoal; label: string }[] = [
  { value: "BOOKING", label: "Booking" },
  { value: "ENQUIRY", label: "Enquiry" },
  { value: "CALL", label: "Call" },
  { value: "NEWSLETTER", label: "Newsletter" },
  { value: "NONE", label: "None" },
];

// ---------------------------------------------------------------------------------------------
// Editor

export function SeoPageEditor({ id, mode = "direct", canPublish = true }: { id: string; mode?: "direct" | "draft"; canPublish?: boolean }) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [checks, setChecks] = useState<FieldCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [blocking, setBlocking] = useState<FieldCheck[]>([]);
  const [needsNoindexConfirm, setNeedsNoindexConfirm] = useState(false);
  const [confirmNoindex, setConfirmNoindex] = useState(false);

  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);

  const apply = useCallback((d: Detail, resetForm: boolean, draft: Record<string, unknown> | null = null) => {
    setDetail(d);
    setChecks(d.checks ?? []);
    if (resetForm) setForm(formOf(withDraft(d.page, draft)));
  }, []);

  /** Portal only: the page's pending draft, if any. */
  const loadDraft = useCallback(async () => {
    if (mode !== "draft") return null;
    const res = await portalApi<DraftState>(`/pages/${encodeURIComponent(id)}/draft`);
    const state = res.ok ? { draft: res.data.draft ?? null, changes: res.data.changes ?? {}, updatedAt: res.data.updatedAt ?? null } : null;
    setDraftState(state);
    return state;
  }, [id, mode]);

  const load = useCallback(
    async (resetForm: boolean) => {
      setLoading(true);
      setLoadError("");
      const res = await seoApi<Detail>(`/pages/${encodeURIComponent(id)}`);
      setLoading(false);
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        return;
      }
      setForbidden(false);
      if (!res.ok) {
        setLoadError(errorOf(res.data, "Couldn't load this page. Try again in a moment."));
        return;
      }
      const draft = await loadDraft();
      apply(res.data, resetForm, draft?.draft ?? null);
    },
    [id, apply, loadDraft],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const page = detail?.page ?? null;
  const isCms = page?.source === "CMS";
  // In the portal, edits to a published page go to its draft; the baseline is the draft version.
  const draftMode = mode === "draft" && page?.status === "PUBLISHED";
  const pendingDraft = draftMode ? draftState?.draft ?? null : null;
  const liveForm = useMemo(() => (page ? formOf(page) : null), [page]);
  const saved = useMemo(() => (page ? formOf(withDraft(page, pendingDraft)) : null), [page, pendingDraft]);
  const changes = useMemo(() => (form && saved ? changesOf(form, saved, isCms) : {}), [form, saved, isCms]);
  const dirty = Object.keys(changes).length > 0;
  const changesKey = JSON.stringify(changes);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Live checks: re-run /validate ~600ms after the last edit.
  const validateSeq = useRef(0);
  useEffect(() => {
    if (!detail) return;
    if (changesKey === "{}") {
      validateSeq.current++;
      setChecking(false);
      setChecks(detail.checks ?? []);
      setCheckNote("");
      return;
    }
    const seq = ++validateSeq.current;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      const res = await seoApi<{ checks: FieldCheck[] }>(`/pages/${encodeURIComponent(id)}/validate`, "POST", JSON.parse(changesKey));
      if (seq !== validateSeq.current) return;
      setChecking(false);
      if (res.ok) {
        setChecks(res.data.checks ?? []);
        setCheckNote("");
      } else {
        setCheckNote(errorOf(res.data, "Couldn't check these edits."));
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [changesKey, detail, id]);

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage("");
  }, []);

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    setBlocking([]);
    if (draftMode && form && liveForm) {
      // The draft holds every field that differs from the live page; fields put back to the live
      // value are sent too so the server drops them from the draft.
      const all = changesOf(form, {} as Form, isCms);
      const draftBody: Record<string, unknown> = { ...changesOf(form, liveForm, isCms) };
      for (const key of Object.keys(pendingDraft ?? {})) if (key in all) draftBody[key] = all[key];
      const res = await portalApi<DraftState>(`/pages/${encodeURIComponent(id)}/draft`, "PUT", draftBody);
      setSaving(false);
      if (res.ok) {
        const state = { draft: res.data.draft ?? null, changes: res.data.changes ?? {}, updatedAt: new Date().toISOString() };
        setDraftState(state);
        setForm(formOf(withDraft(page!, state.draft)));
        setMessage(state.draft ? "Draft saved. The live page is unchanged until the draft is published." : "No differences from the live page: the draft was cleared.");
        return;
      }
      if (res.status === 403) return setError(errorOf(res.data, "Your role can't save these fields."));
      if (res.status === 422 && res.data.checks) setBlocking(res.data.checks);
      setError(errorOf(res.data, "Couldn't save the draft. Try again in a moment."));
      return;
    }
    const body = needsNoindexConfirm && confirmNoindex ? { ...changes, confirmNoindex: true } : changes;
    const res = await seoApi<Detail & { changed: boolean }>(`/pages/${encodeURIComponent(id)}`, "PATCH", body);
    setSaving(false);
    if (res.ok) {
      apply(res.data, true);
      setNeedsNoindexConfirm(false);
      setConfirmNoindex(false);
      setMessage(res.data.changed ? "Saved." : "Nothing changed.");
      return;
    }
    if (res.status === 401 || res.status === 403) return setForbidden(true);
    if (res.status === 409 && /noindex/i.test(res.data.error ?? "")) setNeedsNoindexConfirm(true);
    if (res.status === 422 && res.data.checks) setBlocking(res.data.checks);
    setError(errorOf(res.data, "Couldn't save. Try again in a moment."));
  }

  async function publishPendingDraft() {
    setDraftBusy("publish");
    setError("");
    setMessage("");
    setBlocking([]);
    const res = await portalApi<Detail>(`/pages/${encodeURIComponent(id)}/draft/publish`, "POST", needsNoindexConfirm && confirmNoindex ? { confirmNoindex: true } : {});
    setDraftBusy(null);
    if (res.ok) {
      setDraftState({ draft: null, changes: {}, updatedAt: null });
      apply(res.data, true, null);
      setNeedsNoindexConfirm(false);
      setConfirmNoindex(false);
      setMessage("Draft published: the live page now shows these changes.");
      return;
    }
    if (res.status === 409 && /noindex/i.test(res.data.error ?? "")) setNeedsNoindexConfirm(true);
    if (res.status === 422 && res.data.checks) setBlocking(res.data.checks);
    setError(errorOf(res.data, "Couldn't publish the draft."));
  }

  async function discardPendingDraft() {
    if (!window.confirm("Discard the saved draft? The live page stays as it is.")) return;
    setDraftBusy("discard");
    const res = await portalApi(`/pages/${encodeURIComponent(id)}/draft`, "DELETE");
    setDraftBusy(null);
    if (res.ok) {
      setDraftState({ draft: null, changes: {}, updatedAt: null });
      if (page) setForm(formOf(page));
      setMessage("Draft discarded.");
    } else setError(errorOf(res.data, "Couldn't discard the draft."));
  }

  async function changeStatus(action: "publish" | "unpublish" | "schedule" | "archive") {
    setError("");
    setMessage("");
    setBlocking([]);
    let iso: string | undefined;
    if (action === "schedule") {
      const at = publishAt ? new Date(publishAt) : null;
      if (!at || Number.isNaN(at.getTime())) {
        setError("Pick a date and time to schedule publishing.");
        return;
      }
      iso = at.toISOString();
    }
    setStatusBusy(action);
    const res = await seoApi<Detail>(`/pages/${encodeURIComponent(id)}/status`, "POST", {
      action,
      ...(iso ? { publishAt: iso } : {}),
      ...(needsNoindexConfirm && confirmNoindex ? { confirmNoindex: true } : {}),
    });
    setStatusBusy(null);
    if (res.ok) {
      apply(res.data, false);
      setNeedsNoindexConfirm(false);
      setConfirmNoindex(false);
      setMessage({ publish: "Published.", unpublish: "Moved back to draft.", schedule: "Scheduled.", archive: "Archived." }[action]);
      return;
    }
    if (res.status === 401 || res.status === 403) return setForbidden(true);
    if (res.status === 409 && /noindex/i.test(res.data.error ?? "")) setNeedsNoindexConfirm(true);
    if (res.status === 422 && res.data.checks) setBlocking(res.data.checks);
    setError(errorOf(res.data, "Couldn't change the status. Try again in a moment."));
  }

  if (forbidden) return <StaffSignIn body="Sign in with an admin account to edit SEO." />;
  if (!detail || !form || !page) {
    return (
      <div className="space-y-4">
        {loadError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
            <span>{loadError}</span>
            <button type="button" onClick={() => void load(true)} className={quietBtn}>
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
            <p className="sr-only" role="status">
              {loading ? "Loading page…" : ""}
            </p>
            <Loading />
          </div>
        )}
      </div>
    );
  }

  const { live, defaults } = detail;
  const prefix = cmsPrefix(page.path);
  const isBlog = isCms && prefix === BLOG_PREFIX;
  const defTitle = defaults.title ?? live?.title ?? null;
  const defDescription = defaults.description ?? live?.description ?? null;
  const defH1 = defaults.h1 ?? live?.h1?.[0] ?? null;
  const defCanonical = defaults.canonical ?? live?.canonical ?? null;
  const defImage = defaults.image ?? live?.ogImage ?? null;

  const effTitle = form.seoTitle.trim() || defTitle || page.label;
  const effDescription = form.metaDescription.trim() || defDescription || "";
  const effOgTitle = form.ogTitle.trim() || live?.ogTitle || effTitle;
  const effOgDescription = form.ogDescription.trim() || effDescription;
  const effOgImage = form.ogImage.trim() || form.featuredImage.trim() || defImage;

  const urlPath = (isCms && form.slug ? `${prefix}${form.slug}` : page.path).split("/").filter(Boolean);
  const snippetText = form.answerSnippet;

  return (
    <div className="space-y-6">
      {/* Header block */}
      <section aria-labelledby={f("summary")} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={f("summary")} className="text-2xl font-light text-obsidian-900">
              {page.label}
            </h2>
            <a href={page.path} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 break-all font-mono text-sm text-ocean-700 underline-offset-4 hover:underline">
              {page.path}
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">(opens the live page in a new tab)</span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={STATUS_STYLE[page.status]}>{words(page.status)}</Chip>
            {page.status === "SCHEDULED" && page.publishAt && <span className="text-sm text-slate-600">for {when(page.publishAt)}</span>}
            <button type="button" onClick={() => void load(false)} disabled={loading} className={quietBtn}>
              <RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="Page type">{words(page.pageType)}</Fact>
          <Fact label="Source">{SOURCE_LABEL[page.source]}</Fact>
          <Fact label="Completeness">{detail.completeness}%</Fact>
          <Fact label="Last crawled">{page.lastCrawledAt ? when(page.lastCrawledAt) : "Not crawled yet"}</Fact>
          <Fact label="Live status">{live?.status ? `HTTP ${live.status}` : live?.error ? live.error : "–"}</Fact>
        </dl>
        <div className="mt-6">
          <h3 className="text-base text-obsidian-900">Open issues</h3>
          {page.issues.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No open issues from the last audit.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {page.issues.map((i) => (
                <li key={i.id} className="flex items-start gap-3 text-sm">
                  <Chip className={SEVERITY_STYLE[i.severity]}>{words(i.severity)}</Chip>
                  <span className="pt-1 text-slate-700">
                    {i.message}
                    <span className="ml-2 text-slate-600">({words(i.type)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Feedback */}
      {error && (
        <div role="alert" className="space-y-3 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          <p>{error}</p>
          {blocking.length > 0 && <CheckList checks={blocking} />}
        </div>
      )}
      {needsNoindexConfirm && (
        <div className="rounded-2xl bg-summit-100 px-5 py-4 ring-1 ring-summit-300">
          <Toggle
            id={f("confirm-noindex")}
            label="I understand this key page will be hidden from search results (noindex)."
            checked={confirmNoindex}
            onChange={setConfirmNoindex}
            hint="Tick this, then save or publish again."
          />
        </div>
      )}
      <p aria-live="polite" className={message ? "rounded-2xl bg-ocean-50 px-5 py-3 text-sm text-ocean-800" : "sr-only"}>
        {message}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* Search result */}
          <Panel id={f("search")} title="Search result" description="What search engines show. Empty fields keep the value shown in grey, which is what the page uses today.">
            <div className="grid gap-5 px-6 py-6">
              <div>
                <TextField id={f("seoTitle")} label="SEO title" value={form.seoTitle} onChange={(v) => set("seoTitle", v)} placeholder={defTitle} describedBy={f("seoTitle-count")} />
                <Counter id={f("seoTitle-count")} count={effTitle.length} min={50} max={60} unit="characters" usingDefault={!form.seoTitle.trim()} />
              </div>
              <div>
                <TextField
                  id={f("metaDescription")}
                  label="Meta description"
                  value={form.metaDescription}
                  onChange={(v) => set("metaDescription", v)}
                  placeholder={defDescription}
                  describedBy={f("metaDescription-count")}
                  multiline
                />
                <Counter id={f("metaDescription-count")} count={effDescription.length} min={150} max={160} unit="characters" usingDefault={!form.metaDescription.trim()} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField id={f("focusKeyword")} label="Focus keyword" value={form.focusKeyword} onChange={(v) => set("focusKeyword", v)} />
                <TextField id={f("secondaryKeywords")} label="Secondary keywords" value={form.secondaryKeywords} onChange={(v) => set("secondaryKeywords", v)} hint="Separate with commas." />
              </div>
              <TextField id={f("h1")} label="Main heading (H1)" value={form.h1} onChange={(v) => set("h1", v)} placeholder={defH1} />
              <TextField id={f("canonicalUrl")} label="Canonical URL" value={form.canonicalUrl} onChange={(v) => set("canonicalUrl", v)} placeholder={defCanonical} mono />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField id={f("breadcrumbLabel")} label="Breadcrumb label" value={form.breadcrumbLabel} onChange={(v) => set("breadcrumbLabel", v)} placeholder={page.label} />
                <TextField
                  id={f("sitemapPriority")}
                  label="Sitemap priority"
                  type="number"
                  value={form.sitemapPriority}
                  onChange={(v) => set("sitemapPriority", v)}
                  hint="0 to 1. Leave empty for the default."
                />
              </div>
              <fieldset className="space-y-3">
                <legend className={labelCls}>Robots</legend>
                <Toggle id={f("robotsIndex")} label="Allow search engines to index this page" checked={form.robotsIndex} onChange={(v) => set("robotsIndex", v)} hint={live?.robots ? `Live page robots tag: ${live.robots}` : undefined} />
                <Toggle id={f("robotsFollow")} label="Allow search engines to follow its links" checked={form.robotsFollow} onChange={(v) => set("robotsFollow", v)} />
                <Toggle id={f("sitemapInclude")} label="List this page in sitemap.xml" checked={form.sitemapInclude} onChange={(v) => set("sitemapInclude", v)} hint="Noindex pages are never listed, whatever this says." />
              </fieldset>
            </div>
          </Panel>

          {/* Social */}
          <Panel id={f("social")} title="Social sharing" description="Shown when the page is shared. Empty fields use the search title, description and image.">
            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <TextField id={f("ogTitle")} label="Open Graph title" value={form.ogTitle} onChange={(v) => set("ogTitle", v)} placeholder={live?.ogTitle ?? effTitle} />
              <TextField id={f("twitterTitle")} label="X (Twitter) title" value={form.twitterTitle} onChange={(v) => set("twitterTitle", v)} placeholder={effOgTitle} />
              <TextField id={f("ogDescription")} label="Open Graph description" value={form.ogDescription} onChange={(v) => set("ogDescription", v)} placeholder={effDescription} multiline />
              <TextField id={f("twitterDescription")} label="X (Twitter) description" value={form.twitterDescription} onChange={(v) => set("twitterDescription", v)} placeholder={effOgDescription} multiline />
              <div className="sm:col-span-2">
                <ImageField
                  id={f("ogImage")}
                  label="Open Graph image"
                  value={form.ogImage}
                  onChange={(v) => set("ogImage", v)}
                  fallback={form.featuredImage || defImage}
                  fallbackLabel={form.featuredImage ? "Featured image" : "Default"}
                  hint="The picture shown when this page is shared on Facebook, LinkedIn, WhatsApp and similar. Best at 1200 × 630 px. Empty uses the featured image, or the site default."
                />
              </div>
              <TextField id={f("twitterImage")} label="X (Twitter) image" value={form.twitterImage} onChange={(v) => set("twitterImage", v)} placeholder={effOgImage} mono />
            </div>
          </Panel>

          {/* Content */}
          {isCms ? (
            <Panel id={f("content")} title="Content" description={isBlog ? "The blog post's visible content." : "The guide's visible content."}>
              <div className="grid gap-5 px-6 py-6">
                <TextField
                  id={f("slug")}
                  label={isBlog ? "Post address (URL slug)" : "Address (slug)"}
                  value={form.slug}
                  onChange={(v) => set("slug", v)}
                  hint={
                    isBlog
                      ? `The post lives at ${prefix}${form.slug || "…"}. You can change it: on a published post the old address then redirects (301) to the new one. Posts brought over from Webflow should keep their Webflow address.`
                      : `The page lives at ${prefix}${form.slug || "…"}. Changing it on a published guide redirects the old address.`
                  }
                  mono
                />
                <TextField id={f("excerpt")} label="Excerpt" value={form.excerpt} onChange={(v) => set("excerpt", v)} multiline rows={2} />
                <TextField
                  id={f("body")}
                  label="Body"
                  value={form.body}
                  onChange={(v) => set("body", v)}
                  multiline
                  rows={14}
                  mono
                  hint="Supports ##, ### and #### headings, - lists, **bold**, [links](/path) and ![alt text](/media/…) images. Everything else shows as plain text."
                />
                {isBlog && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField id={f("datePublished")} label="Originally published" type="date" value={form.datePublished} onChange={(v) => set("datePublished", v)} hint="Keep the Webflow date (Created On)." />
                    <TextField id={f("dateModified")} label="Last modified" type="date" value={form.dateModified} onChange={(v) => set("dateModified", v)} hint="Updated automatically when the post's content changes." />
                    <div className="sm:col-span-2">
                      <ImageField
                        id={f("thumbnailImage")}
                        label="Thumbnail image"
                        value={form.thumbnailImage}
                        onChange={(v) => set("thumbnailImage", v)}
                        onUploaded={({ alt }) => alt && !form.thumbnailAlt.trim() && set("thumbnailAlt", alt)}
                        fallback={form.featuredImage || null}
                        fallbackLabel="Featured image"
                        aspect="aspect-square"
                        hint="Shown on the /blog list. Empty uses the featured image."
                      />
                    </div>
                    <TextField id={f("thumbnailAlt")} label="Thumbnail alt text" value={form.thumbnailAlt} onChange={(v) => set("thumbnailAlt", v)} className="sm:col-span-2" />
                    <div className="sm:col-span-2">
                      <Toggle id={f("featured")} label="Featured post" checked={form.featured} onChange={(v) => set("featured", v)} hint="Featured posts are listed first on /blog." />
                    </div>
                  </div>
                )}
                <div>
                  <TextField
                    id={f("answerSnippet")}
                    label="Answer snippet (short direct answer)"
                    value={form.answerSnippet}
                    onChange={(v) => set("answerSnippet", v)}
                    describedBy={f("answerSnippet-count")}
                    multiline
                  />
                  <Counter id={f("answerSnippet-count")} count={countWords(snippetText)} min={40} max={60} unit="words" usingDefault={false} />
                </div>
                <TextField id={f("citationFact")} label="Citation fact" value={form.citationFact} onChange={(v) => set("citationFact", v)} hint="One clear, checkable fact others can quote." />
                <FaqEditor idBase={f("faq")} faqs={form.faqs} onChange={(v) => set("faqs", v)} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField id={f("authorName")} label="Author name" value={form.authorName} onChange={(v) => set("authorName", v)} />
                  <TextField id={f("reviewedAt")} label="Reviewed on" type="date" value={form.reviewedAt} onChange={(v) => set("reviewedAt", v)} />
                </div>
                <TextField id={f("authorBio")} label="Author bio" value={form.authorBio} onChange={(v) => set("authorBio", v)} multiline rows={2} />
                <TextField id={f("relatedPaths")} label="Related pages" value={form.relatedPaths} onChange={(v) => set("relatedPaths", v)} multiline rows={3} hint="One site path per line, like /private-tours." mono />
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField id={f("pillar")} label="Pillar" value={form.pillar} onChange={(v) => set("pillar", v)} />
                  <TextField id={f("tags")} label="Tags" value={form.tags} onChange={(v) => set("tags", v)} hint="Separate with commas." />
                </div>
              </div>
            </Panel>
          ) : (
            <p className="rounded-2xl bg-ocean-50 px-5 py-4 text-sm text-ocean-800">
              This page&apos;s visible content comes from the {page.source === "STATIC_ROUTE" ? "site code" : page.source === "TOUR" ? "tour record" : "destination record"}, so only the metadata fields here apply to it.
            </p>
          )}

          {/* Image */}
          <Panel id={f("image")} title={isBlog ? "Featured image" : "Image"} description={isBlog ? "The picture at the top of the post, on its card on /blog, and when it is shared (unless a separate Open Graph image is set)." : "The page's featured image and how it is described."}>
            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ImageField
                  id={f("featuredImage")}
                  label="Featured image"
                  value={form.featuredImage}
                  onChange={(v) => set("featuredImage", v)}
                  onUploaded={({ alt }) => alt && !form.featuredImageAlt.trim() && set("featuredImageAlt", alt)}
                  fallback={defaults.image}
                  aspect="aspect-video"
                  hint={isBlog ? "Best at least 1600 px wide. Pick from the library or upload a JPEG, PNG or WebP (up to 8 MB); uploads are converted to WebP." : "A /media/… path or https:// address, or pick or upload one."}
                />
              </div>
              <TextField id={f("featuredImageAlt")} label="Alt text" value={form.featuredImageAlt} onChange={(v) => set("featuredImageAlt", v)} className="sm:col-span-2" />
              <TextField id={f("imageTitle")} label="Image title" value={form.imageTitle} onChange={(v) => set("imageTitle", v)} />
              <TextField id={f("imageFileName")} label="File name" value={form.imageFileName} onChange={(v) => set("imageFileName", v)} hint="Like lake-louise-sunrise.webp." mono />
              <TextField id={f("imageCaption")} label="Caption" value={form.imageCaption} onChange={(v) => set("imageCaption", v)} className="sm:col-span-2" />
            </div>
          </Panel>

          {/* Conversion */}
          <Panel id={f("conversion")} title="Conversion" description="The call to action and campaign tags for links from this page.">
            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <TextField id={f("ctaText")} label="Button text" value={form.ctaText} onChange={(v) => set("ctaText", v)} />
              <TextField id={f("ctaUrl")} label="Button link" value={form.ctaUrl} onChange={(v) => set("ctaUrl", v)} mono />
              <Dropdown id={f("conversionGoal")} label="Conversion goal" options={GOALS} value={form.conversionGoal} onChange={(v) => set("conversionGoal", v as ConversionGoal)} />
              <TextField id={f("utmSource")} label="UTM source" value={form.utmSource} onChange={(v) => set("utmSource", v)} mono />
              <TextField id={f("utmMedium")} label="UTM medium" value={form.utmMedium} onChange={(v) => set("utmMedium", v)} mono />
              <TextField id={f("utmCampaign")} label="UTM campaign" value={form.utmCampaign} onChange={(v) => set("utmCampaign", v)} mono />
            </div>
          </Panel>

          {/* Internal */}
          <Panel id={f("internal")} title="Internal" description="Only staff see these.">
            <div className="grid gap-5 px-6 py-6">
              <TextField id={f("label")} label="Dashboard label" value={form.label} onChange={(v) => set("label", v)} />
              <Toggle
                id={f("important")}
                label="Key page"
                checked={form.important}
                onChange={(v) => set("important", v)}
                hint="Key pages need an explicit confirmation before they can be hidden from search (noindex)."
              />
            </div>
          </Panel>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-6">
          <div className="space-y-6 lg:sticky lg:top-[calc(var(--vc-header-h,0px)+1.5rem)]">
            <section aria-labelledby={f("save-heading")} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
              <h2 id={f("save-heading")} className="text-xl text-obsidian-900">
                {draftMode ? "Save draft" : "Save"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {dirty ? `${Object.keys(changes).length} unsaved ${Object.keys(changes).length === 1 ? "change" : "changes"}.` : "No unsaved changes."}
                {draftMode && " This page is live, so your changes are saved as a draft first."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void save()} disabled={!dirty || saving} className={primaryBtn}>
                  {saving ? "Saving…" : draftMode ? "Save draft" : "Save changes"}
                </button>
                <button type="button" onClick={() => {
                    setForm(formOf(withDraft(page, pendingDraft)));
                    setNeedsNoindexConfirm(false);
                    setConfirmNoindex(false);
                    setBlocking([]);
                  }} disabled={!dirty || saving} className={quietBtn}>
                  Discard
                </button>
              </div>
            </section>

            {draftMode && pendingDraft && (
              <section aria-labelledby={f("draft-heading")} className="rounded-[1.75rem] bg-summit-100 p-6 ring-1 ring-summit-300">
                <h2 id={f("draft-heading")} className="text-xl text-obsidian-900">
                  Draft waiting to publish
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  {Object.keys(draftState?.changes ?? {}).length} field{Object.keys(draftState?.changes ?? {}).length === 1 ? "" : "s"} differ from the live page
                  {draftState?.updatedAt ? `, saved ${when(draftState.updatedAt)}` : ""}.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {Object.entries(draftState?.changes ?? {}).slice(0, 12).map(([k, c]) => (
                    <li key={k} className="break-words">
                      <span className="text-obsidian-900">{k}</span>: {clip(String(c.to ?? "(empty)"), 80)}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canPublish && (
                    <button type="button" onClick={() => void publishPendingDraft()} disabled={draftBusy !== null || dirty} className={primaryBtn}>
                      {draftBusy === "publish" ? "Publishing…" : "Publish draft"}
                    </button>
                  )}
                  <button type="button" onClick={() => void discardPendingDraft()} disabled={draftBusy !== null} className={quietBtn}>
                    Discard draft
                  </button>
                </div>
                {!canPublish && <p className="mt-3 text-sm text-slate-700">An SEO manager or admin publishes drafts.</p>}
                {dirty && canPublish && <p className="mt-3 text-sm text-slate-700">Save your edits to the draft before publishing it.</p>}
              </section>
            )}

            <section aria-labelledby={f("preview-heading")} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
              <h2 id={f("preview-heading")} className="text-xl text-obsidian-900">
                Search preview
              </h2>
              <p className="mt-1 text-sm text-slate-600">An approximation; search engines may rewrite it.</p>
              <div className="mt-4 rounded-2xl border border-obsidian-900/10 p-4">
                <p className="truncate text-sm text-slate-700">
                  vistachase.com{urlPath.length > 0 ? ` › ${urlPath.join(" › ")}` : ""}
                </p>
                <p className="mt-1 text-lg leading-snug text-ocean-700">{clip(effTitle, 60)}</p>
                <p className="mt-1 text-sm text-slate-700">{effDescription ? clip(effDescription, 160) : <span className="text-slate-500">No description: search engines will pick text from the page.</span>}</p>
              </div>
              {!form.robotsIndex && <p className="mt-3 text-sm text-red-700">Set to noindex: this page won&apos;t appear in search results.</p>}
            </section>

            <section aria-labelledby={f("social-preview-heading")} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
              <h2 id={f("social-preview-heading")} className="text-xl text-obsidian-900">
                Social preview
              </h2>
              <p className="mt-1 text-sm text-slate-600">Roughly how a shared link looks (Open Graph).</p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-obsidian-900/10">
                {effOgImage && /^\/media\//.test(effOgImage) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={effOgImage} alt="" className="aspect-[1.91/1] w-full bg-obsidian-100 object-cover" />
                ) : (
                  <p className="flex aspect-[1.91/1] items-center justify-center bg-obsidian-100 px-4 text-center text-sm text-slate-600">
                    {effOgImage ? "Image hosted elsewhere (not previewed here)." : "No image: platforms may pick one or show none."}
                  </p>
                )}
                <div className="p-4">
                  <p className="text-sm uppercase text-slate-600">vistachase.com</p>
                  <p className="mt-1 text-base text-obsidian-900">{clip(effOgTitle, 70)}</p>
                  <p className="mt-1 text-sm text-slate-700">{clip(effOgDescription, 120)}</p>
                </div>
              </div>
            </section>

            <section aria-labelledby={f("checks-heading")} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07]">
              <div className="flex items-center justify-between gap-3">
                <h2 id={f("checks-heading")} className="text-xl text-obsidian-900">
                  Checks
                </h2>
                {checking && <span className="text-sm text-slate-600">Checking…</span>}
              </div>
              <div className="mt-4" aria-live="polite">
                <CheckList checks={checks} />
                {checkNote && <p className="mt-3 text-sm text-red-700">{checkNote}</p>}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Publishing */}
      <Panel id={f("publishing")} title="Publishing" description="Overrides apply on the live site only while the page is published.">
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm text-slate-600">
            Status: <span className="text-obsidian-900">{words(page.status)}</span>
            {page.publishedAt ? ` · last published ${when(page.publishedAt)}` : ""}
            {dirty ? " · save your edits first: publishing uses the saved version." : ""}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" onClick={() => void changeStatus("publish")} disabled={statusBusy !== null || page.status === "PUBLISHED"} className={primaryBtn}>
              {statusBusy === "publish" ? "Publishing…" : "Publish"}
            </button>
            <button type="button" onClick={() => void changeStatus("unpublish")} disabled={statusBusy !== null || page.status === "DRAFT"} className={quietBtn}>
              {statusBusy === "unpublish" ? "Working…" : "Unpublish (to draft)"}
            </button>
            {isCms && (
              <button type="button" onClick={() => void changeStatus("archive")} disabled={statusBusy !== null || page.status === "ARCHIVED"} className={dangerBtn}>
                {statusBusy === "archive" ? "Archiving…" : "Archive"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={f("publishAt")} className={labelCls}>
                Publish at (your time zone)
              </label>
              <input id={f("publishAt")} type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className={`${field} sm:w-64`} />
            </div>
            <button type="button" onClick={() => void changeStatus("schedule")} disabled={statusBusy !== null || !publishAt} className={quietBtn}>
              {statusBusy === "schedule" ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>
      </Panel>

      <KeywordsPanel pageId={page.id} mappings={page.mappings} idBase={f("kw")} onChanged={() => void load(false)} />

      {/* Revisions */}
      <Panel id={f("revisions")} title="Change log" description="The last 30 changes to this page.">
        {page.revisions.length === 0 ? (
          <Empty>No changes recorded yet.</Empty>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06]">
            {page.revisions.map((r) => {
              const fields = Object.keys(r.changes ?? {});
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-base text-obsidian-900">{words(r.action)}</p>
                    {fields.length > 0 && <p className="mt-0.5 break-words text-sm text-slate-600">{fields.join(", ")}</p>}
                    {r.note && <p className="mt-0.5 text-sm text-slate-600">{r.note}</p>}
                  </div>
                  <time dateTime={r.createdAt} className="text-sm text-slate-600">
                    {when(r.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="text-sm text-slate-600">Last updated {day(page.updatedAt)}.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// FAQs

function FaqEditor({ idBase, faqs, onChange }: { idBase: string; faqs: Faq[]; onChange: (v: Faq[]) => void }) {
  const update = (i: number, patch: Partial<Faq>) => onChange(faqs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <fieldset className="space-y-4">
      <legend className={labelCls}>Frequently asked questions</legend>
      {faqs.length === 0 && <p className="text-sm text-slate-600">No questions yet.</p>}
      {faqs.map((q, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-obsidian-900/10 p-4">
          <TextField id={`${idBase}-q-${i}`} label={`Question ${i + 1}`} value={q.question} onChange={(v) => update(i, { question: v })} />
          <TextField id={`${idBase}-a-${i}`} label={`Answer ${i + 1}`} value={q.answer} onChange={(v) => update(i, { answer: v })} multiline />
          <button type="button" onClick={() => onChange(faqs.filter((_, j) => j !== i))} className={dangerBtn}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove question {i + 1}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...faqs, { question: "", answer: "" }])} className={quietBtn}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add a question
      </button>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Keywords

function KeywordsPanel({ pageId, mappings, idBase, onChanged }: { pageId: string; mappings: Mapping[]; idBase: string; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Keyword[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const res = await seoApi<{ keywords: Keyword[] }>(`/keywords?q=${encodeURIComponent(term)}&pageSize=20`);
      if (cancelled) return;
      setSearching(false);
      if (res.ok) {
        setResults(res.data.keywords ?? []);
        setError("");
      } else setError(errorOf(res.data, "Couldn't search keywords."));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  async function map(k: Keyword, role: Role) {
    setBusy(`${k.id}-${role}`);
    setError("");
    setNotice("");
    setWarnings([]);
    const res = await seoApi<{ warnings?: string[] }>(`/keywords/${encodeURIComponent(k.id)}/mappings`, "POST", { pageId, role });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't map that keyword."));
    setWarnings(res.data.warnings ?? []);
    setNotice(`Mapped “${k.keyword}” as ${role === "PRIMARY" ? "primary" : "secondary"}.`);
    onChanged();
  }

  /** A keyword that isn't in the sheet yet: create it there and map it here in one step. */
  async function addNew(role: Role) {
    const keyword = q.trim();
    setBusy(`new-${role}`);
    setError("");
    setNotice("");
    setWarnings([]);
    const res = await portalApi<{ warnings?: string[]; created?: boolean }>(`/pages/${encodeURIComponent(pageId)}/keywords`, "POST", { keyword, role });
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't add that keyword."));
    setWarnings(res.data.warnings ?? []);
    setNotice(`Added “${keyword}” as ${role === "PRIMARY" ? "primary" : "secondary"}${res.data.created ? " (new in the keyword sheet, unverified)" : ""}.`);
    setQ("");
    onChanged();
  }

  async function unmap(m: Mapping) {
    setBusy(m.id);
    setError("");
    setNotice("");
    setWarnings([]);
    const res = await seoApi(`/mappings/${encodeURIComponent(m.id)}`, "DELETE");
    setBusy(null);
    if (!res.ok) return setError(errorOf(res.data, "Couldn't remove that keyword."));
    setNotice(`Removed “${m.keyword.keyword}”.`);
    onChanged();
  }

  const mappedIds = new Set(mappings.map((m) => m.keyword.id));
  const sorted = [...mappings].sort((a, b) => (a.role === b.role ? a.keyword.keyword.localeCompare(b.keyword.keyword) : a.role === "PRIMARY" ? -1 : 1));

  return (
    <Panel id={`${idBase}-panel`} title="Keywords" description="Keywords this page targets. A keyword should be the primary of one page only.">
      <div className="space-y-5 px-6 py-6">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <div aria-live="polite" className="space-y-2">
          {notice && <p className="text-sm text-ocean-800">{notice}</p>}
          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-2xl bg-summit-100 px-4 py-3 text-sm text-obsidian-900">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-slate-600">No keywords mapped to this page yet.</p>
        ) : (
          <ul className="divide-y divide-obsidian-900/[0.06] rounded-2xl border border-obsidian-900/10">
            {sorted.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-base text-obsidian-900">
                    {m.keyword.keyword}
                    <Chip className={m.role === "PRIMARY" ? "bg-ocean-50 text-ocean-800" : "bg-obsidian-100 text-slate-700"}>{words(m.role)}</Chip>
                    {m.keyword.archivedAt && <Chip className="bg-red-50 text-red-800">Archived</Chip>}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {words(m.keyword.intent)} · {TRACK_LABEL[m.keyword.track]}
                  </p>
                </div>
                <button type="button" onClick={() => void unmap(m)} disabled={busy !== null} className={dangerBtn}>
                  {busy === m.id ? "Removing…" : "Remove"}
                  <span className="sr-only"> {m.keyword.keyword}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label htmlFor={`${idBase}-search`} className={labelCls}>
            Find a keyword to add
          </label>
          <input id={`${idBase}-search`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters" className={`${field} sm:max-w-md`} />
          <p className="mt-1.5 text-sm text-slate-600" aria-live="polite">
            {searching ? "Searching…" : results ? `${results.length} ${results.length === 1 ? "keyword" : "keywords"} found.` : ""}
          </p>
          {results && results.length > 0 && (
            <ul className="mt-3 divide-y divide-obsidian-900/[0.06] rounded-2xl border border-obsidian-900/10">
              {results.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-base text-obsidian-900">{k.keyword}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {words(k.intent)} · {TRACK_LABEL[k.track]}
                      {mappedIds.has(k.id) ? " · already on this page" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void map(k, "PRIMARY")} disabled={busy !== null} className={quietBtn}>
                      {busy === `${k.id}-PRIMARY` ? "Mapping…" : "Map as primary"}
                      <span className="sr-only"> {k.keyword}</span>
                    </button>
                    <button type="button" onClick={() => void map(k, "SECONDARY")} disabled={busy !== null} className={quietBtn}>
                      {busy === `${k.id}-SECONDARY` ? "Mapping…" : "Map as secondary"}
                      <span className="sr-only"> {k.keyword}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {results && q.trim().length >= 2 && !results.some((k) => k.keyword.trim().toLowerCase() === q.trim().toLowerCase().replace(/\s+/g, " ")) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-obsidian-900/15 px-4 py-3">
              <span className="mr-1 text-sm text-slate-700">
                Not in the keyword sheet yet. Add <span className="text-obsidian-900">“{q.trim()}”</span> to this page as
              </span>
              <button type="button" onClick={() => void addNew("PRIMARY")} disabled={busy !== null} className={quietBtn}>
                {busy === "new-PRIMARY" ? "Adding…" : "primary"}
              </button>
              <button type="button" onClick={() => void addNew("SECONDARY")} disabled={busy !== null} className={quietBtn}>
                {busy === "new-SECONDARY" ? "Adding…" : "secondary"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
