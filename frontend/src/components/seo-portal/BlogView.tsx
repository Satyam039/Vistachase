"use client";

// Blog SEO: every post at /blog-post/<slug> with its checks (title, description, headings, alt
// text, Webflow images, internal links, dates, sitemap, BlogPosting schema), the Webflow import,
// and "new post". Posts open in the blog post editor (BlogPostEditor.tsx).

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Chip, Empty, Grid, Loading, Panel, STATUS_STYLE, Stat, day, errorOf, field, labelCls, portalApi, primaryBtn, quietBtn, words, type PublishStatus } from "@/components/admin/seo/shared";
import { Dropdown } from "@/components/forms/Dropdown";
import { PortalHeading, usePortal } from "@/components/seo-portal/PortalShell";
import { ImportPanel } from "@/components/seo-portal/ImportPanel";

interface Post {
  id: string;
  path: string;
  slug: string;
  label: string;
  status: PublishStatus;
  featured: boolean;
  featuredImage: string | null;
  thumbnailImage: string | null;
  ogImage: string | null;
  keywords: number;
  importSource: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  datePublished: string | null;
  dateModified: string | null;
  words: number;
  headings: { h2: number; h3: number; h4: number; problems: string[] };
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  linksViaRedirect: string[];
  linksUnknown: string[];
  inSitemap: boolean;
  blogPosting: boolean | null;
  hasDraft: boolean;
  blocking: number;
  openIssues: number;
  problems: string[];
}

interface Summary {
  total: number;
  expected: number;
  published: number;
  drafts: number;
  imported: number;
  noTitle: number;
  noDescription: number;
  headingProblems: number;
  altText: number;
  webflowImages: number;
  linksViaRedirect: number;
  linksUnknown: number;
  withDraftChanges: number;
}

const PROBLEMS: { value: string; label: string }[] = [
  { value: "", label: "All posts" },
  { value: "no-title", label: "No SEO title" },
  { value: "no-description", label: "No meta description" },
  { value: "headings", label: "Heading structure" },
  { value: "no-featured-image", label: "No featured image" },
  { value: "alt-text", label: "Images without alt text" },
  { value: "webflow-images", label: "Images still on Webflow" },
  { value: "links-redirect", label: "Links through a redirect" },
  { value: "links-unknown", label: "Links to unknown pages" },
  { value: "no-date", label: "No publish date" },
  { value: "not-in-sitemap", label: "Not in sitemap" },
  { value: "draft-changes", label: "Draft changes waiting" },
];
const PROBLEM_LABEL = Object.fromEntries(PROBLEMS.map((p) => [p.value, p.label]));

export function BlogView() {
  const { me } = usePortal();
  const uid = useId();
  const [data, setData] = useState<{ posts: Post[]; summary: Summary } | null>(null);
  const [problem, setProblem] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (problem) params.set("problem", problem);
    if (q.trim()) params.set("q", q.trim());
    const res = await portalApi<{ posts: Post[]; summary: Summary }>(`/blog?${params}`);
    if (res.ok) setData(res.data);
  }, [problem, q]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const s = data?.summary;
  return (
    <div className="space-y-6">
      <PortalHeading
        title="Blog SEO"
        actions={
          me.seo.manage && (
            <Link href="/seo/blog/new" className={primaryBtn}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New blog post
            </Link>
          )
        }
        intro={
          <>
            Blog posts live at /blog-post/&lt;address&gt; and are listed on <Link href="/blog" className="text-ocean-700 underline underline-offset-2">/blog</Link>. Open a post to write it (title, address, meta title and description, keywords, featured image and the content with images, links and tables) and publish it. Changing a published post&apos;s address redirects the old one. The BlogPosting column reads the last audit.
          </>
        }
      />
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Posts here" value={`${s.total}/${s.expected}`} hint={`${s.published} published · ${s.drafts} drafts · ${s.imported} imported`} />
          <Stat label="Missing title or description" value={s.noTitle + s.noDescription} hint={`${s.noTitle} titles · ${s.noDescription} descriptions`} tone={s.noTitle + s.noDescription ? "warn" : "good"} />
          <Stat label="Image problems" value={s.altText + s.webflowImages} hint={`${s.altText} alt text · ${s.webflowImages} on Webflow's CDN`} tone={s.altText + s.webflowImages ? "warn" : "good"} />
          <Stat label="Link problems" value={s.linksViaRedirect + s.linksUnknown} hint={`${s.linksViaRedirect} via redirect · ${s.linksUnknown} unknown`} tone={s.linksViaRedirect + s.linksUnknown ? "warn" : "good"} />
        </div>
      )}
      <Panel
        id={`${uid}-posts`}
        title="Posts"
        actions={
          me.seo.manage && (
            <Link href="/seo/blog/new" className={quietBtn}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New post
            </Link>
          )
        }
      >
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-q`} className={labelCls}>
              Search
            </label>
            <input id={`${uid}-q`} value={q} onChange={(e) => setQ(e.target.value)} className={field} />
          </div>
          <Dropdown id={`${uid}-problem`} label="Show" options={PROBLEMS} value={problem} onChange={setProblem} />
        </div>
        {!data ? (
          <Loading />
        ) : data.posts.length === 0 ? (
          s?.total ? (
            <Empty>No posts match.</Empty>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-base text-obsidian-900">No blog posts yet.</p>
              <p className="mt-1 text-sm text-slate-600">Write a new post, or bring the existing posts over from Webflow with the import below.</p>
              {me.seo.manage && (
                <Link href="/seo/blog/new" className={`${primaryBtn} mt-4`}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Write the first post
                </Link>
              )}
            </div>
          )
        ) : (
          <Grid label="Blog posts" head={[["Post"], ["Status"], ["Published"], ["Checks"], [""]]} minWidth="min-w-[56rem]">
            {data.posts.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-6 py-3">
                  <span className="flex gap-3">
                  {(p.thumbnailImage || p.featuredImage) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small preview of the post's image
                    <img src={(p.thumbnailImage || p.featuredImage) as string} alt="" loading="lazy" className="mt-1 h-14 w-20 shrink-0 rounded-lg object-cover ring-1 ring-obsidian-900/10" />
                  ) : (
                    <span className="mt-1 flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-obsidian-100 text-center text-sm text-slate-600">No image</span>
                  )}
                  <span className="min-w-0">
                  <span className="block text-base text-obsidian-900">
                    {p.label}
                    {p.featured && <span className="ml-2 text-sm text-slate-600">Featured</span>}
                  </span>
                  <span className="block font-mono text-sm text-slate-600">{p.path}</span>
                  <span className="text-sm text-slate-600">
                    {p.words} words · H2 {p.headings.h2} · H3 {p.headings.h3} · {p.images} images · {p.internalLinks} internal links · {p.keywords} {p.keywords === 1 ? "keyword" : "keywords"}
                  </span>
                  </span>
                  </span>
                </td>
                <td className="px-6 py-3">
                  <Chip className={STATUS_STYLE[p.status]}>{words(p.status)}</Chip>
                  {p.hasDraft && <span className="mt-1 block text-sm text-slate-600">Draft changes</span>}
                </td>
                <td className="px-6 py-3 text-sm text-slate-700">
                  {day(p.datePublished)}
                  {p.dateModified && <span className="block text-slate-600">mod. {day(p.dateModified)}</span>}
                </td>
                <td className="px-6 py-3 text-sm">
                  {p.problems.length === 0 ? (
                    <span className="text-ocean-700">No problems found</span>
                  ) : (
                    <ul className="space-y-0.5 text-slate-700">
                      {p.problems.map((k) => (
                        <li key={k}>{PROBLEM_LABEL[k] ?? k}</li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-1 block text-slate-600">BlogPosting: {p.blogPosting === null ? "Not audited" : p.blogPosting ? "found" : "not found"}</span>
                </td>
                <td className="px-6 py-3 text-right">
                  <Link href={`/seo/blog/${p.id}`} className="inline-flex h-10 items-center rounded-full border border-obsidian-900/10 px-4 text-sm text-obsidian-900 hover:bg-obsidian-50">
                    Edit post
                    <span className="sr-only"> {p.label}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </Grid>
        )}
      </Panel>
      <ImportPanel kind="BLOG_POSTS" />
    </div>
  );
}
