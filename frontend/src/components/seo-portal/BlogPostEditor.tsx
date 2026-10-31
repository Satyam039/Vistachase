"use client";

// One screen to write a blog post, like a Webflow CMS item: title, address, summary, the content
// (rich text with images, links and tables), featured image, meta title and description with a
// search preview, keywords, author and date, then Save draft or Publish. It uses the same page
// APIs as the full page editor: unpublished posts are saved directly; a published post's edits are
// kept as a draft until "Publish changes", so the live post never shows half-finished work.
// Also on this screen, like a Webflow CMS item: Featured switch, thumbnail, Open Graph title /
// description / image (each can stay "same as SEO"), sitemap indexing and the created / modified
// dates. FAQs, schema markup, site search and custom code stay on the full page editor ("More settings").

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Settings2, X } from "lucide-react";
import { ImageField } from "@/components/admin/seo/ImageField";
import { CheckList, Chip, STATUS_STYLE, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, seoApi, words, type FieldCheck, type PublishStatus } from "@/components/admin/seo/shared";
import { usePortal } from "@/components/seo-portal/PortalShell";
import { RichTextEditor } from "@/components/seo-portal/editor/RichTextEditor";
import { AiGenerate, type AiDraft } from "@/components/admin/seo/AiGenerate";

const BLOG_PREFIX = "/blog-post/";
/** The publish check refuses thinner posts (backend seo validation). */
const MIN_WORDS = 150;

interface Mapping {
  id: string;
  role: "PRIMARY" | "SECONDARY";
  keyword: { id: string; keyword: string };
}

interface PostPage {
  id: string;
  path: string;
  slug: string | null;
  label: string;
  status: PublishStatus;
  seoTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  body: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  authorName: string | null;
  datePublished: string | null;
  h1: string | null;
  featured: boolean;
  thumbnailImage: string | null;
  thumbnailAlt: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  robotsIndex: boolean;
  sitemapInclude: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  dateModified: string | null;
  mappings: Mapping[];
}

interface Form {
  label: string;
  slug: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  featuredImage: string;
  featuredImageAlt: string;
  authorName: string;
  datePublished: string;
  thumbnailImage: string;
  thumbnailAlt: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  featured: boolean;
  robotsIndex: boolean;
  sitemapInclude: boolean;
}

const EMPTY: Form = {
  label: "",
  slug: "",
  excerpt: "",
  body: "",
  seoTitle: "",
  metaDescription: "",
  featuredImage: "",
  featuredImageAlt: "",
  authorName: "",
  datePublished: "",
  thumbnailImage: "",
  thumbnailAlt: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  featured: false,
  robotsIndex: true,
  sitemapInclude: true,
};
const MANAGER_ONLY: (keyof Form)[] = ["label", "slug", "seoTitle", "metaDescription", "datePublished", "ogTitle", "ogDescription", "ogImage", "featured", "robotsIndex", "sitemapInclude"];
type TextKey = { [K in keyof Form]: Form[K] extends string ? K : never }[keyof Form];
type BoolKey = Exclude<keyof Form, TextKey>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const slugOf = (p: { slug: string | null; path: string }) => p.slug ?? p.path.replace(BLOG_PREFIX, "");

function formOf(p: PostPage, draft: Record<string, unknown> | null): Form {
  const v = (k: keyof PostPage & TextKey) => (draft && k in draft ? str(draft[k]) : str(p[k]));
  const b = (k: BoolKey, fallback: boolean) => (draft && k in draft ? Boolean(draft[k]) : typeof p[k] === "boolean" ? p[k] : fallback);
  return {
    label: v("label"),
    slug: draft && "slug" in draft ? str(draft.slug) : slugOf(p),
    excerpt: v("excerpt"),
    body: v("body"),
    seoTitle: v("seoTitle"),
    metaDescription: v("metaDescription"),
    featuredImage: v("featuredImage"),
    featuredImageAlt: v("featuredImageAlt"),
    authorName: v("authorName"),
    datePublished: v("datePublished").slice(0, 10),
    thumbnailImage: v("thumbnailImage"),
    thumbnailAlt: v("thumbnailAlt"),
    ogTitle: v("ogTitle"),
    ogDescription: v("ogDescription"),
    ogImage: v("ogImage"),
    featured: b("featured", false),
    robotsIndex: b("robotsIndex", true),
    sitemapInclude: b("sitemapInclude", true),
  };
}

/** A form value in the API's shape: empty text is null; the body keeps its own spacing. */
function apiValue(form: Form, key: keyof Form): string | boolean | null {
  const value = form[key];
  if (typeof value === "boolean") return value;
  if (key === "label" || key === "slug") return value.trim();
  if (key === "body") return form.body || null;
  return value.trim() || null;
}

/** The fields of `form` that differ from `base`, in the API's shape. */
function changesOf(form: Form, base: Form): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(form) as (keyof Form)[]) if (form[key] !== base[key]) out[key] = apiValue(form, key);
  return out;
}

/** "Lake Louise in Winter!" → "lake-louise-in-winter". */
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.trim().length;
  const tone = n === 0 ? "text-slate-600" : n < min || n > max ? "text-amber-800" : "text-emerald-800";
  return (
    <span className={`text-sm ${tone}`}>
      {n} characters{n > 0 && (n < min ? `: aim for ${min}–${max}` : n > max ? `: Google may cut it after about ${max}` : "")}
    </span>
  );
}

const shortDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "–");

/** A field that can reuse the SEO value (Webflow's "Same as SEO" box); ticked, the field stays empty. */
function SameAsInput({ id, label, sameLabel, value, inherited, onChange, disabled, multiline }: { id: string; label: string; sameLabel: string; value: string; inherited: string; onChange: (v: string) => void; disabled: boolean; multiline?: boolean }) {
  const [custom, setCustom] = useState(Boolean(value.trim()));
  const same = !custom && !value.trim();
  const props = { id, value: same ? "" : value, placeholder: inherited, disabled: disabled || same, onChange: (e: { target: { value: string } }) => onChange(e.target.value), maxLength: multiline ? 320 : 120 };
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {multiline ? <textarea rows={3} {...props} className={`${field} h-auto py-2.5 disabled:bg-obsidian-50`} /> : <input {...props} className={`${field} disabled:bg-obsidian-50`} />}
      <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={same}
          disabled={disabled}
          onChange={(e) => {
            setCustom(!e.target.checked);
            onChange(e.target.checked ? "" : inherited);
          }}
          className="h-4 w-4 accent-ocean-600"
        />
        {sameLabel}
      </label>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-none border border-obsidian-900/[0.08] bg-white p-5">
      <h2 className="text-base text-obsidian-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Keywords: saved straight to the keyword map for an existing post; held until the first save for a new one.

interface PendingKeyword {
  keyword: string;
  role: "PRIMARY" | "SECONDARY";
}

function KeywordsBox({
  idBase,
  disabled,
  mappings,
  pending,
  onAdd,
  onRole,
  onRemove,
  busy,
  error,
}: {
  idBase: string;
  disabled: boolean;
  mappings: { key: string; keyword: string; role: "PRIMARY" | "SECONDARY" }[];
  pending?: boolean;
  onAdd: (k: PendingKeyword) => void;
  onRole: (key: string, role: "PRIMARY" | "SECONDARY") => void;
  onRemove: (key: string) => void;
  busy: boolean;
  error: string;
}) {
  const [text, setText] = useState("");
  const [primary, setPrimary] = useState(mappings.length === 0);
  useEffect(() => setPrimary(mappings.length === 0), [mappings.length]);
  const add = () => {
    if (text.trim().length < 2) return;
    onAdd({ keyword: text.trim(), role: primary ? "PRIMARY" : "SECONDARY" });
    setText("");
  };
  return (
    <div className="space-y-3">
      {mappings.length === 0 ? (
        <p className="text-sm text-slate-600">No keywords yet. Add the main keyword first, then any secondary ones.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Keywords for this post">
          {mappings.map((m) => (
            <li key={m.key} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm ring-1 ${m.role === "PRIMARY" ? "bg-ocean-50 text-ocean-900 ring-ocean-600/30" : "bg-obsidian-50 text-obsidian-900 ring-obsidian-900/10"}`}>
              <span>{m.keyword}</span>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => onRole(m.key, m.role === "PRIMARY" ? "SECONDARY" : "PRIMARY")}
                className="rounded-full px-2 py-1 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                aria-label={`${m.keyword}: ${m.role === "PRIMARY" ? "primary, make secondary" : "secondary, make primary"}`}
              >
                {m.role === "PRIMARY" ? "Primary" : "Secondary"}
              </button>
              <button type="button" disabled={disabled || busy} onClick={() => onRemove(m.key)} className="rounded-full p-1.5 hover:bg-white disabled:opacity-60" aria-label={`Remove ${m.keyword}`}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor={`${idBase}-kw`} className={labelCls}>
              Add a keyword
            </label>
            <input
              id={`${idBase}-kw`}
              value={text}
              maxLength={120}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="banff in winter"
              className={field}
            />
          </div>
          <label className="inline-flex h-11 items-center gap-2 text-sm text-obsidian-900">
            <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="h-4 w-4 accent-ocean-600" />
            Primary keyword
          </label>
          <button type="button" onClick={add} disabled={busy || text.trim().length < 2} className={quietBtn}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>
      )}
      {pending && mappings.length > 0 && <p className="text-sm text-slate-600">These are added to the keyword map when you save the post.</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export function BlogPostEditor({ id }: { id: string | null }) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const { me } = usePortal();
  const canManage = me.seo.manage;
  const canWrite = canManage || me.seo.editContent;
  // A new post gets its id on the first save; the address bar then shows /seo/blog/<id> without a reload.
  const [postId, setPostId] = useState<string | null>(id);
  const isNew = postId === null;

  const [page, setPage] = useState<PostPage | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [editorKey, setEditorKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [blocking, setBlocking] = useState<FieldCheck[]>([]);
  const [pendingKeywords, setPendingKeywords] = useState<PendingKeyword[]>([]);
  const [kwBusy, setKwBusy] = useState(false);
  const [kwError, setKwError] = useState("");

  const load = useCallback(
    async (resetForm: boolean, which: string | null = postId) => {
      if (!which) return;
      const id = which;
      const res = await seoApi<{ page: PostPage }>(`/pages/${encodeURIComponent(id)}`);
      if (!res.ok) return setLoadError(errorOf(res.data, "Couldn't load this post."));
      if (!res.data.page.path.startsWith(BLOG_PREFIX)) return setLoadError("This isn't a blog post. Open it from Pages & metadata.");
      let d: Record<string, unknown> | null = null;
      if (res.data.page.status === "PUBLISHED") {
        const dr = await portalApi<{ draft: Record<string, unknown> | null }>(`/pages/${encodeURIComponent(id)}/draft`);
        d = dr.ok ? dr.data.draft ?? null : null;
      }
      setPage(res.data.page);
      setDraft(d);
      if (resetForm) {
        setForm(formOf(res.data.page, d));
        setEditorKey((k) => k + 1);
      }
    },
    [postId],
  );

  useEffect(() => {
    void load(true, id);
  }, [load, id]);

  const published = page?.status === "PUBLISHED";
  const live = useMemo(() => (page ? formOf(page, null) : EMPTY), [page]);
  const saved = useMemo(() => (page ? formOf(page, draft) : EMPTY), [page, draft]);
  const changes = useMemo(() => (form ? changesOf(form, saved) : {}), [form, saved]);
  const dirty = Object.keys(changes).length > 0 || (isNew && pendingKeywords.length > 0);
  const hasDraft = published && !!draft && Object.keys(draft).length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage("");
  }, []);

  /** Fields this role may not send are left out (the server refuses them anyway). */
  const allowed = (body: Record<string, unknown>) => (canManage ? body : Object.fromEntries(Object.entries(body).filter(([k]) => !MANAGER_ONLY.includes(k as keyof Form))));

  function failed(res: { status: number; data: { error?: string; fields?: Record<string, string[]>; checks?: FieldCheck[] } }, fallback: string) {
    if (res.status === 422 && res.data.checks) setBlocking(res.data.checks);
    setError(errorOf(res.data, fallback));
  }

  /** The post title is the page's H1 unless someone set a different H1 (imported posts may have). */
  function h1Patch(): Record<string, string> {
    if (!form) return {};
    const current = (draft && typeof draft.h1 === "string" ? draft.h1 : page?.h1) ?? "";
    const want = form.label.trim();
    return want && current !== want && (!current || current === saved.label) ? { h1: want } : {};
  }

  async function createPost(publish: boolean) {
    if (!form) return;
    const created = await portalApi<{ page: { id: string } }>("/blog", "POST", { label: form.label.trim(), slug: form.slug.trim() });
    if (!created.ok) return failed(created, "Couldn't create the post.");
    const newId = created.data.page.id;
    setPostId(newId);
    window.history.replaceState(null, "", `/seo/blog/${newId}`);
    const problems: string[] = [];
    const res = await seoApi(`/pages/${encodeURIComponent(newId)}`, "PATCH", { ...changesOf({ ...form, label: "", slug: "" }, EMPTY), h1: form.label.trim() });
    if (!res.ok) problems.push(errorOf(res.data, "Some fields weren't saved."));
    for (const k of pendingKeywords) {
      const kr = await portalApi(`/pages/${encodeURIComponent(newId)}/keywords`, "POST", k);
      if (!kr.ok) problems.push(`Keyword "${k.keyword}": ${errorOf(kr.data, "not added")}`);
    }
    setPendingKeywords([]);
    await load(true, newId);
    if (problems.length) return setError(`The post was created as a draft, but: ${problems.join(" ")}`);
    if (publish) {
      const pr = await seoApi(`/pages/${encodeURIComponent(newId)}/status`, "POST", { action: "publish" });
      if (!pr.ok) return failed(pr, "Saved as a draft, but it can't be published yet.");
      await load(true, newId);
      return setMessage("Published.");
    }
    setMessage("Draft saved.");
  }

  async function save(publish: boolean) {
    if (!form) return;
    setBusy(publish ? "publish" : "save");
    setError("");
    setMessage("");
    setBlocking([]);
    try {
      if (isNew) return await createPost(publish);
      if (!page) return;
      if (published) {
        if (dirty) {
          // The draft holds every field that differs from the live post (fields put back to the
          // live value are sent too, so the server drops them from the draft).
          const body: Record<string, unknown> = { ...changesOf(form, live), ...h1Patch() };
          for (const key of Object.keys(draft ?? {})) if (key in form && !(key in body)) body[key] = apiValue(form, key as keyof Form);
          const res = await portalApi<{ draft: Record<string, unknown> | null }>(`/pages/${encodeURIComponent(page.id)}/draft`, "PUT", allowed(body));
          if (!res.ok) return failed(res, "Couldn't save the changes.");
          setDraft(res.data.draft ?? null);
          if (!publish) return setMessage(res.data.draft ? "Changes saved as a draft. The live post is unchanged until you publish them." : "No differences from the live post.");
        }
        if (publish) {
          const res = await portalApi(`/pages/${encodeURIComponent(page.id)}/draft/publish`, "POST", {});
          if (!res.ok) return failed(res, "Couldn't publish the changes.");
          await load(true);
          return setMessage("Published: the live post now shows these changes.");
        }
        return;
      }
      const patch = allowed({ ...changes, ...h1Patch() });
      if (Object.keys(patch).length) {
        const res = await seoApi(`/pages/${encodeURIComponent(page.id)}`, "PATCH", patch);
        if (!res.ok) return failed(res, "Couldn't save the post.");
      }
      if (publish) {
        const res = await seoApi(`/pages/${encodeURIComponent(page.id)}/status`, "POST", { action: "publish" });
        if (!res.ok) {
          await load(true);
          return failed(res, "Saved as a draft, but it can't be published yet.");
        }
      }
      await load(true);
      setMessage(publish ? "Published." : "Draft saved.");
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    if (!page || !window.confirm("Take this post off the site? It goes back to draft and its address shows “not found” until it's published again.")) return;
    setError("");
    const res = await seoApi(`/pages/${encodeURIComponent(page.id)}/status`, "POST", { action: "unpublish" });
    if (!res.ok) return failed(res, "Couldn't unpublish the post.");
    await load(true);
    setMessage("Moved back to draft.");
  }

  // Keywords
  async function addKeyword(k: PendingKeyword) {
    setKwError("");
    if (isNew) {
      if (pendingKeywords.some((p) => p.keyword.toLowerCase() === k.keyword.toLowerCase())) return setKwError("That keyword is already on this post.");
      return setPendingKeywords((list) => [...(k.role === "PRIMARY" ? list.map((p) => ({ ...p, role: "SECONDARY" as const })) : list), k]);
    }
    if (!page) return;
    setKwBusy(true);
    const res = await portalApi<{ warnings?: string[] }>(`/pages/${encodeURIComponent(page.id)}/keywords`, "POST", k);
    setKwBusy(false);
    if (!res.ok) return setKwError(errorOf(res.data, "Couldn't add the keyword."));
    if (res.data.warnings?.length) setKwError(res.data.warnings.join(" "));
    await load(false);
  }
  async function keywordRole(key: string, role: "PRIMARY" | "SECONDARY") {
    setKwError("");
    if (isNew) return setPendingKeywords((list) => list.map((p) => (p.keyword === key ? { ...p, role } : role === "PRIMARY" ? { ...p, role: "SECONDARY" } : p)));
    if (!page) return;
    setKwBusy(true);
    const res = await portalApi<{ warnings?: string[] }>(`/pages/${encodeURIComponent(page.id)}/keywords/${encodeURIComponent(key)}`, "PATCH", { role });
    setKwBusy(false);
    if (!res.ok) return setKwError(errorOf(res.data, "Couldn't change the keyword."));
    if (res.data.warnings?.length) setKwError(res.data.warnings.join(" "));
    await load(false);
  }
  async function removeKeyword(key: string) {
    setKwError("");
    if (isNew) return setPendingKeywords((list) => list.filter((p) => p.keyword !== key));
    if (!page) return;
    setKwBusy(true);
    const res = await portalApi(`/pages/${encodeURIComponent(page.id)}/keywords/${encodeURIComponent(key)}`, "DELETE");
    setKwBusy(false);
    if (!res.ok) return setKwError(errorOf(res.data, "Couldn't remove the keyword."));
    await load(false);
  }

  if (loadError)
    return (
      <div className="space-y-4">
        <BackLink />
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 ring-1 ring-red-200">
          {loadError}
        </p>
      </div>
    );
  if (!form || (!isNew && !page))
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-slate-600">Loading the post…</p>
      </div>
    );

  const readOnly = !canWrite;
  const managerField = !canManage;
  const keywordRows = isNew
    ? pendingKeywords.map((p) => ({ key: p.keyword, keyword: p.keyword, role: p.role }))
    : [...(page?.mappings ?? [])]
        .sort((a, b) => (a.role === b.role ? a.keyword.keyword.localeCompare(b.keyword.keyword) : a.role === "PRIMARY" ? -1 : 1))
        .map((m) => ({ key: m.id, keyword: m.keyword.keyword, role: m.role }));
  const previewTitle = form.seoTitle.trim() || (form.label.trim() ? `${form.label.trim()} | Vista Chase` : "Post title | Vista Chase");
  const previewDescription = form.metaDescription.trim() || form.excerpt.trim() || "Add a meta description: the sentence or two Google shows under the title.";
  const seoDescription = form.metaDescription.trim() || form.excerpt.trim();
  const ogPreviewTitle = form.ogTitle.trim() || previewTitle;
  // AI Generate needs a saved post to read; it uses the words on screen, saved or not.
  const canGenerate = postId !== null && !readOnly && !managerField;
  const aiDraft = (): AiDraft => ({ label: form.label, h1: form.label, excerpt: form.excerpt, body: form.body, seoTitle: form.seoTitle, metaDescription: form.metaDescription });
  const ogPreviewDescription = form.ogDescription.trim() || seoDescription || "Add a meta description to show text here.";
  const ogPreviewImage = [form.ogImage, form.featuredImage].map((v) => v.trim()).find((v) => v.startsWith("/media/") || v.startsWith("https://")) ?? null;
  const wordCount = form.body.replace(/!\[[^\]]*\]\([^)]*\)|\]\([^)]*\)|[#>*|[\]-]/g, " ").split(/\s+/).filter(Boolean).length;
  const missing = [!form.metaDescription.trim() && "meta description", !form.featuredImage.trim() && "featured image", form.featuredImage.trim() && !form.featuredImageAlt.trim() && "featured image alt text", keywordRows.length === 0 && "keywords", !form.body.trim() ? "content" : wordCount < MIN_WORDS && `content (${MIN_WORDS - wordCount} more words)`].filter(Boolean) as string[];
  const status: PublishStatus = page?.status ?? "DRAFT";
  const canSave = !readOnly && form.label.trim().length >= 2 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug.trim());

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2">
          <Chip className={STATUS_STYLE[status]}>{isNew ? "New post" : words(status)}</Chip>
          {hasDraft && <Chip className="bg-amber-50 text-amber-900 ring-1 ring-amber-200">Unpublished changes</Chip>}
          {page && published && (
            <a href={page.path} target="_blank" rel="noopener" className={quietBtn}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View live post
            </a>
          )}
          {page && (
            <Link href={`/seo/pages/${page.id}`} className={quietBtn}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              More settings
            </Link>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-light tracking-tight text-obsidian-900">{isNew ? "New blog post" : form.label || "Untitled post"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {readOnly
            ? "Your role can read posts but not change them."
            : !canManage
              ? "You can edit the content, summary, featured image and author. An SEO manager sets the title, address, meta fields and keywords, and publishes."
              : published
                ? "This post is live. Your changes are saved as a draft until you press Publish changes."
                : "Save a draft at any time; the post appears on the site when you publish it."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Post">
            <div>
              <label htmlFor={f("label")} className={labelCls}>
                Post title
              </label>
              <input
                id={f("label")}
                required
                minLength={2}
                maxLength={120}
                value={form.label}
                disabled={readOnly || managerField}
                onChange={(e) => {
                  set("label", e.target.value);
                  if (!slugEdited) set("slug", slugify(e.target.value));
                }}
                placeholder="Lake Louise in winter: what to see and do"
                className={`${field} text-lg`}
                autoFocus={isNew}
              />
            </div>
            <div>
              <label htmlFor={f("slug")} className={labelCls}>
                Post address (URL slug)
              </label>
              <div className="flex items-stretch overflow-hidden rounded-xl border border-obsidian-900/15 bg-white focus-within:ring-2 focus-within:ring-ocean-600">
                <span className="flex items-center bg-obsidian-50 px-3 font-mono text-sm text-slate-600">{BLOG_PREFIX}</span>
                <input
                  id={f("slug")}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={80}
                  value={form.slug}
                  disabled={readOnly || managerField}
                  onChange={(e) => {
                    set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    setSlugEdited(true);
                  }}
                  aria-describedby={f("slug-hint")}
                  className="h-11 min-w-0 flex-1 px-3 font-mono text-sm outline-none disabled:bg-obsidian-50"
                />
              </div>
              <p id={f("slug-hint")} className="mt-1.5 text-sm text-slate-600">
                Lower-case words joined by hyphens.{published && " Changing it moves the post; the old address redirects (301) to the new one."}
              </p>
            </div>
            <div>
              <label htmlFor={f("excerpt")} className={labelCls}>
                Summary (shown under the title and on the blog list)
              </label>
              <textarea id={f("excerpt")} rows={2} maxLength={500} value={form.excerpt} disabled={readOnly} onChange={(e) => set("excerpt", e.target.value)} className={`${field} h-auto py-2.5`} />
            </div>
          </Section>

          <section className="space-y-2">
            <h2 id={f("body-label")} className="text-base text-obsidian-900">
              Content
            </h2>
            <RichTextEditor key={editorKey} id={f("body")} labelledBy={f("body-label")} value={form.body} onChange={(md) => set("body", md)} disabled={readOnly} />
            <p className={`text-sm ${wordCount < MIN_WORDS ? "text-amber-800" : "text-slate-600"}`} aria-live="polite">
              {wordCount} {wordCount === 1 ? "word" : "words"}
              {wordCount < MIN_WORDS && ` (a post needs at least ${MIN_WORDS} to be published)`}
            </p>
            <p className="text-sm text-slate-600">Start sections with Heading 2 (the post title is the page&apos;s only H1). Images go in at full width; links can point to any tour, page or post on the site.</p>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <Section title="Post settings">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={form.featured} disabled={readOnly || managerField} onChange={(e) => set("featured", e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-ocean-600" aria-describedby={f("featured-switch-hint")} />
              <span>
                <span className="block text-base text-obsidian-900">Featured</span>
                <span id={f("featured-switch-hint")} className="block text-sm text-slate-600">
                  Marks the post as featured (Webflow&apos;s Featured switch), for highlighting on the blog.
                </span>
              </span>
            </label>
            {page && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-600">Created</dt>
                  <dd className="text-obsidian-900">{shortDate(page.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Modified</dt>
                  <dd className="text-obsidian-900">{shortDate(page.dateModified ?? page.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Published</dt>
                  <dd className="text-obsidian-900">{published ? shortDate(page.datePublished ?? page.publishedAt) : "Not published"}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Status</dt>
                  <dd className="text-obsidian-900">{words(page.status)}{hasDraft ? ", changes in draft" : ""}</dd>
                </div>
              </dl>
            )}
          </Section>

          <Section title="Search engine listing" description="What Google shows for this post.">
            <div className="rounded-xl bg-obsidian-50 p-4" aria-label="Search result preview">
              <p className="truncate text-sm text-slate-600">www.vistachase.com › blog-post › {form.slug || "…"}</p>
              <p className="mt-1 line-clamp-2 text-lg leading-snug text-blue-800">{previewTitle}</p>
              <p className="mt-1 line-clamp-3 text-sm text-slate-700">{previewDescription}</p>
            </div>
            <div>
              <label htmlFor={f("seoTitle")} className={labelCls}>
                Meta title
              </label>
              <input id={f("seoTitle")} maxLength={120} value={form.seoTitle} disabled={readOnly || managerField} onChange={(e) => set("seoTitle", e.target.value)} placeholder={form.label ? `${form.label} | Vista Chase` : "Uses the post title when empty"} className={field} />
              <Counter value={form.seoTitle} min={30} max={60} />
              {canGenerate && postId && <AiGenerate id={f("seoTitle")} pageId={postId} field="seoTitle" label="meta title" draft={aiDraft} onUse={(v) => set("seoTitle", v)} />}
            </div>
            <div>
              <label htmlFor={f("metaDescription")} className={labelCls}>
                Meta description
              </label>
              <textarea id={f("metaDescription")} rows={3} maxLength={320} value={form.metaDescription} disabled={readOnly || managerField} onChange={(e) => set("metaDescription", e.target.value)} className={`${field} h-auto py-2.5`} />
              <Counter value={form.metaDescription} min={120} max={160} />
              {canGenerate && postId && <AiGenerate id={f("metaDescription")} pageId={postId} field="metaDescription" label="meta description" draft={aiDraft} onUse={(v) => set("metaDescription", v)} />}
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.robotsIndex && form.sitemapInclude}
                disabled={readOnly || managerField}
                onChange={(e) => {
                  set("robotsIndex", e.target.checked);
                  set("sitemapInclude", e.target.checked);
                }}
                className="mt-1 h-5 w-5 shrink-0 accent-ocean-600"
                aria-describedby={f("indexing-hint")}
              />
              <span>
                <span className="block text-base text-obsidian-900">Sitemap indexing</span>
                <span id={f("indexing-hint")} className="block text-sm text-slate-600">
                  {form.robotsIndex && form.sitemapInclude ? "Listed in sitemap.xml and open to search engines." : "Hidden from search engines (noindex) and left out of sitemap.xml."}
                </span>
              </span>
            </label>
          </Section>

          <Section title="Open Graph" description="How the post looks when it's shared on Facebook, LinkedIn, WhatsApp and similar.">
            <div className="overflow-hidden rounded-xl ring-1 ring-obsidian-900/10" aria-label="Share preview">
              {ogPreviewImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview of the share image
                <img src={ogPreviewImage} alt="" className="aspect-[1.91/1] w-full bg-obsidian-100 object-cover" />
              ) : (
                <p className="flex aspect-[1.91/1] items-center justify-center bg-obsidian-100 text-sm text-slate-600">No image yet</p>
              )}
              <div className="p-3">
                <p className="text-xs uppercase text-slate-600">vistachase.com</p>
                <p className="mt-1 line-clamp-2 text-base text-obsidian-900">{ogPreviewTitle}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ogPreviewDescription}</p>
              </div>
            </div>
            <div>
              <SameAsInput id={f("ogTitle")} label="Open Graph title" sameLabel="Same as meta title" value={form.ogTitle} inherited={previewTitle} onChange={(v) => set("ogTitle", v)} disabled={readOnly || managerField} />
              {canGenerate && postId && <AiGenerate id={f("ogTitle")} pageId={postId} field="ogTitle" label="Open Graph title" draft={aiDraft} onUse={(v) => set("ogTitle", v)} />}
            </div>
            <div>
              <SameAsInput id={f("ogDescription")} label="Open Graph description" sameLabel="Same as meta description" value={form.ogDescription} inherited={seoDescription} onChange={(v) => set("ogDescription", v)} disabled={readOnly || managerField} multiline />
              {canGenerate && postId && <AiGenerate id={f("ogDescription")} pageId={postId} field="ogDescription" label="Open Graph description" draft={aiDraft} onUse={(v) => set("ogDescription", v)} />}
            </div>
            <ImageField
              id={f("ogImage")}
              label="Open Graph image"
              value={form.ogImage}
              onChange={(v) => set("ogImage", v)}
              fallback={form.featuredImage || null}
              fallbackLabel="Featured image"
              stacked
              disabled={readOnly || managerField}
              hint="Best at 1200 × 630 px. Empty uses the featured image."
            />
          </Section>

          <Section title="Keywords" description="The main (primary) keyword and any secondary ones this post targets. They also appear in Keywords by page.">
            <KeywordsBox
              idBase={f("kw")}
              disabled={readOnly || managerField}
              mappings={keywordRows}
              pending={isNew}
              onAdd={(k) => void addKeyword(k)}
              onRole={(key, role) => void keywordRole(key, role)}
              onRemove={(key) => void removeKeyword(key)}
              busy={kwBusy}
              error={kwError}
            />
          </Section>

          <Section title="Featured image" description="Shown at the top of the post, on the blog list and when the post is shared.">
            <ImageField
              id={f("featured")}
              label="Image"
              value={form.featuredImage}
              onChange={(v) => set("featuredImage", v)}
              aspect="aspect-video"
              stacked
              disabled={readOnly}
              onUploaded={(img) => {
                if (!form.featuredImageAlt.trim() && img.alt) set("featuredImageAlt", img.alt);
              }}
            />
            <div>
              <label htmlFor={f("featuredAlt")} className={labelCls}>
                Alt text
              </label>
              <input id={f("featuredAlt")} maxLength={200} value={form.featuredImageAlt} disabled={readOnly} onChange={(e) => set("featuredImageAlt", e.target.value)} placeholder="Describe the image" className={field} />
            </div>
          </Section>

          <Section title="Thumbnail image" description="The smaller picture on the post's card in lists. Empty uses the featured image.">
            <ImageField id={f("thumb")} label="Thumbnail" value={form.thumbnailImage} onChange={(v) => set("thumbnailImage", v)} fallback={form.featuredImage || null} fallbackLabel="Featured image" stacked disabled={readOnly} />
            <div>
              <label htmlFor={f("thumbAlt")} className={labelCls}>
                Thumbnail alt text
              </label>
              <input id={f("thumbAlt")} maxLength={200} value={form.thumbnailAlt} disabled={readOnly} onChange={(e) => set("thumbnailAlt", e.target.value)} placeholder="Describe the thumbnail" className={field} />
            </div>
          </Section>

          <Section title="Author and date">
            <div>
              <label htmlFor={f("author")} className={labelCls}>
                Author
              </label>
              <input id={f("author")} maxLength={120} value={form.authorName} disabled={readOnly} onChange={(e) => set("authorName", e.target.value)} placeholder="Vista Chase team" className={field} />
            </div>
            <div>
              <label htmlFor={f("date")} className={labelCls}>
                Publish date (leave empty to use the day it&apos;s published)
              </label>
              <input id={f("date")} type="date" value={form.datePublished} disabled={readOnly || managerField} onChange={(e) => set("datePublished", e.target.value)} className={field} />
            </div>
          </Section>
        </div>
      </div>

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-obsidian-900/10 bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-none sm:border">
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!canSave || !!busy || (!dirty && !isNew)} className={quietBtn}>
              {busy === "save" ? "Saving…" : published ? "Save changes as draft" : "Save draft"}
            </button>
            {canManage && (
              <button type="button" onClick={() => void save(true)} disabled={!canSave || !!busy || (published && !dirty && !hasDraft)} className={primaryBtn}>
                {busy === "publish" ? "Publishing…" : published ? "Publish changes" : "Publish"}
              </button>
            )}
            {canManage && published && (
              <button type="button" onClick={() => void unpublish()} disabled={!!busy} className="text-sm text-slate-700 underline underline-offset-2 hover:text-obsidian-900">
                Unpublish
              </button>
            )}
            <div aria-live="polite" className="min-w-0 flex-1 text-sm">
              {message && <p className="text-ocean-800">{message}</p>}
              {!message && dirty && <p className="text-slate-600">Unsaved changes.</p>}
              {!message && !dirty && missing.length > 0 && <p className="text-slate-600">Still missing: {missing.join(", ")}.</p>}
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {blocking.length > 0 && (
            <div className="mt-3">
              <CheckList checks={blocking} />
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function BackLink() {
  return (
    <Link href="/seo/blog" className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/10 bg-white px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All posts
    </Link>
  );
}
