// Blog posts at their Webflow addresses (/blog-post/<slug>), migrated in the SEO portal or written
// there. Only published posts render; drafts and unknown slugs 404. Structured data: BlogPosting
// (headline, original dates, author, image, publisher @id) and BreadcrumbList, FAQPage only when the
// post shows FAQs, plus any JSON-LD published for this post in the SEO portal. When a published
// block already describes the post (BlogPosting or Article), the generated one is left out.
//
// Magazine layout: headline, standfirst and byline, a large lead image, the body in a reading column,
// then "More stories" from the blog. Webflow posts often open their body with the post's own title
// and hero image; when they do, those are shown once (as the headline and the lead image) instead of
// twice. That happens only on the page: the stored post is never changed.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronRight } from "lucide-react";
import { mergeSeo, seoFetch, siteOrigin, type SeoMeta } from "@/lib/seo/server";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { GuideMarkdown, inline, safeHref } from "@/components/seo/GuideMarkdown";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { PostCard, PostImage, postImageSrc, type PostSummary } from "@/components/blog/posts";

interface Post extends SeoMeta {
  label: string;
  excerpt: string | null;
  body: string | null;
  answerSnippet: string | null;
  faqs: { question: string; answer: string }[] | null;
  authorName: string | null;
  authorBio: string | null;
  publishedAt: string | null;
  datePublished: string | null;
  dateModified: string | null;
  thumbnailImage: string | null;
  thumbnailAlt: string | null;
  imageCaption: string | null;
  imageTitle: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  schema: Record<string, unknown>[];
  related: { path: string; label: string }[];
}

type Props = { params: Promise<{ slug: string }> };

const loadPost = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const body = await seoFetch<{ post: Post }>(`/blog/${slug}`, 5000);
  return body?.post ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: "Page not found | Vista Chase" };
  const title = post.seoTitle ?? `${post.label} | Vista Chase`;
  const description = post.metaDescription ?? post.excerpt ?? undefined;
  const published = post.datePublished ?? post.publishedAt ?? undefined;
  return mergeSeo(
    {
      title,
      description,
      alternates: { canonical: post.path },
      openGraph: { type: "article", title, description, url: post.path, ...(published ? { publishedTime: published } : {}), ...(post.dateModified ? { modifiedTime: post.dateModified } : {}) },
      twitter: { card: "summary_large_image" },
    },
    post,
  );
}

const MORE_STORIES = 3;

const plain = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Takes a leading heading that repeats the headline and a leading image off the body, so the page
 * shows them once. The image becomes the lead image when the post has no main image, and is dropped
 * when it is the main image itself.
 */
function openingOf(body: string, headline: string, mainImage: string | null) {
  const lines = body.replace(/\r/g, "").split("\n");
  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && !lines[i].trim()) i++;
  };
  skipBlank();
  const heading = /^#{1,4}\s+(.+)$/.exec(lines[i]?.trim() ?? "");
  if (heading && plain(heading[1]) === plain(headline)) {
    i++;
    skipBlank();
  }
  let lead: { src: string; alt: string } | null = null;
  const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(lines[i]?.trim() ?? "");
  const src = img ? postImageSrc(img[2]) : null;
  if (img && src && (!mainImage || src === mainImage)) {
    if (!mainImage) lead = { src, alt: img[1] };
    i++;
  }
  return { body: lines.slice(i).join("\n"), lead };
}

const readingMinutes = (body: string) => Math.max(1, Math.round(body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").split(/\s+/).filter(Boolean).length / 220));

const date = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });
const typesOf = (block: Record<string, unknown>): string[] => {
  const graph = Array.isArray(block["@graph"]) ? (block["@graph"] as Record<string, unknown>[]) : [block];
  return graph.flatMap((n) => (Array.isArray(n?.["@type"]) ? (n["@type"] as string[]) : typeof n?.["@type"] === "string" ? [n["@type"] as string] : []));
};

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const origin = siteOrigin();
  const heading = post.h1 ?? post.label;
  const faqs = Array.isArray(post.faqs) ? post.faqs : [];
  const mainImage = post.featuredImage ? postImageSrc(post.featuredImage) : null;
  const opening = post.body ? openingOf(post.body, heading, mainImage) : { body: "", lead: null };
  const hero = mainImage ? { src: mainImage, alt: post.featuredImageAlt ?? "" } : opening.lead;
  const abs = (p: string) => (p.startsWith("/") ? `${origin}${p}` : p);
  const published = post.datePublished ?? post.publishedAt;
  const modified = post.dateModified ?? post.updatedAt;
  const blocks = Array.isArray(post.schema) ? post.schema : [];
  const hasPostingBlock = blocks.some((b) => typesOf(b).some((t) => t === "BlogPosting" || t === "Article"));
  const cta = post.ctaText && post.ctaUrl ? safeHref(post.ctaUrl) : null;
  const socialImage = post.ogImage ?? post.featuredImage ?? hero?.src ?? null;
  const minutes = post.body ? readingMinutes(post.body) : null;

  // More stories: featured posts first, then the newest, never this one.
  const list = await seoFetch<{ posts: PostSummary[] }>("/blog", 5000);
  const more = (list?.posts ?? []).filter((p) => p.path !== post.path).slice(0, MORE_STORIES);

  return (
    <>
      <PageSeoExtras path={`/blog-post/${slug}`} schema={false} />
      <div className="bg-obsidian-50 text-obsidian-900">
        {!hasPostingBlock && (
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              "@id": `${origin}${post.path}#post`,
              headline: heading,
              ...(post.metaDescription || post.excerpt ? { description: post.metaDescription ?? post.excerpt } : {}),
              mainEntityOfPage: `${origin}${post.path}`,
              ...(socialImage && safeHref(socialImage) ? { image: abs(socialImage) } : {}),
              ...(published ? { datePublished: published } : {}),
              dateModified: modified,
              author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@id": "https://www.vistachase.com/#organization" },
              publisher: { "@id": "https://www.vistachase.com/#organization" },
            }}
          />
        )}
        {blocks.map((b, i) => (
          <JsonLd key={i} data={b} />
        ))}
        <BreadcrumbJsonLd
          origin={origin}
          items={[
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.breadcrumbLabel ?? post.label, path: post.path },
          ]}
        />
        {faqs.length > 0 && (
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
            }}
          />
        )}

        <article>
          <header className="bg-white">
            <div className="mx-auto max-w-4xl px-page pb-10 pt-10 text-center sm:pb-14 sm:pt-14">
              <nav aria-label="Breadcrumb" className="mb-8">
                <ol className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
                  <li>
                    <Link href="/" className="hover:text-obsidian-900 hover:underline">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li>
                    <Link href="/blog" className="hover:text-obsidian-900 hover:underline">
                      Blog
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li aria-current="page" className="text-obsidian-900">
                    {post.breadcrumbLabel ?? post.label}
                  </li>
                </ol>
              </nav>
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.2em] text-slate-600">
                {published ? <time dateTime={published}>{date(published)}</time> : <span>Blog</span>}
                {minutes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{minutes} min read</span>
                  </>
                )}
              </p>
              <h1 className="mt-5 text-balance text-4xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-5xl lg:text-6xl">{heading}</h1>
              {post.excerpt && <p className="mx-auto mt-6 max-w-2xl text-balance text-xl font-light leading-relaxed text-slate-700">{post.excerpt}</p>}
              {(post.authorName || (published && post.dateModified && post.dateModified.slice(0, 10) !== published.slice(0, 10))) && (
                <p className="mt-6 text-sm text-slate-600">
                  {post.authorName && <>By {post.authorName}</>}
                  {post.authorName && published && post.dateModified && post.dateModified.slice(0, 10) !== published.slice(0, 10) && " · "}
                  {published && post.dateModified && post.dateModified.slice(0, 10) !== published.slice(0, 10) && (
                    <>
                      Updated <time dateTime={post.dateModified}>{date(post.dateModified)}</time>
                    </>
                  )}
                </p>
              )}
            </div>
            {hero && (
              <figure className="mx-auto max-w-6xl px-page pb-2">
                <div className="relative aspect-[16/9] overflow-hidden bg-obsidian-100">
                  <PostImage src={hero.src} alt={hero.alt} sizes="(min-width: 1152px) 72rem, 100vw" priority />
                </div>
                {post.imageCaption && <figcaption className="mt-3 text-center text-sm text-slate-600">{post.imageCaption}</figcaption>}
              </figure>
            )}
          </header>

          <div className="bg-white">
            <div className="mx-auto max-w-[44rem] space-y-10 px-page pb-16 pt-12 sm:pb-20">
              {post.answerSnippet && (
                <section aria-label="In short" className="border-y border-obsidian-900/[0.08] py-6">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-ocean-600">In short</p>
                  <p className="text-xl font-light leading-relaxed text-obsidian-900">{inline(post.answerSnippet, "a")}</p>
                </section>
              )}

              {opening.body && <GuideMarkdown body={opening.body} variant="article" />}

              {faqs.length > 0 && (
                <section aria-labelledby="post-faq" className="space-y-4">
                  <h2 id="post-faq" className="text-3xl font-light tracking-tight text-obsidian-900">
                    Frequently asked questions
                  </h2>
                  {faqs.map((f, i) => (
                    <details key={i} className="rounded-xl border border-obsidian-900/[0.08] bg-obsidian-50 p-4">
                      <summary className="cursor-pointer text-obsidian-900">{f.question}</summary>
                      <p className="mt-2 leading-relaxed text-slate-700">{f.answer}</p>
                    </details>
                  ))}
                </section>
              )}

              {cta && post.ctaText && (
                <p>
                  <Link href={cta} className="inline-flex items-center gap-2 rounded-full bg-obsidian-950 px-6 py-3 text-white hover:bg-obsidian-900">
                    {post.ctaText}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </p>
              )}

              {post.authorName && post.authorBio && (
                <section aria-label="About the author" className="border-t border-obsidian-900/[0.08] pt-6 text-sm text-slate-700">
                  <p className="text-obsidian-900">{post.authorName}</p>
                  <p className="mt-1">{post.authorBio}</p>
                </section>
              )}

              {post.related.length > 0 && (
                <nav aria-labelledby="post-related">
                  <h2 id="post-related" className="mb-3 text-lg text-obsidian-900">
                    Related
                  </h2>
                  <ul className="list-disc space-y-1.5 pl-6 marker:text-ocean-600">
                    {post.related.map((r) => (
                      <li key={r.path}>
                        <Link href={r.path} className="text-ocean-600 underline underline-offset-2 hover:text-obsidian-900">
                          {r.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>
          </div>
        </article>

        <section aria-labelledby="post-more" className="border-t border-obsidian-900/[0.06]">
          <div className="mx-auto max-w-7xl px-page py-14 sm:py-16">
            <h2 id="post-more" className="text-center text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
              More stories
            </h2>
            {more.length > 0 && (
              <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {more.map((p) => (
                  <li key={p.path}>
                    <PostCard post={p} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-12 text-center">
              <Link href="/blog" className="inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/15 bg-white px-6 text-sm text-obsidian-900 hover:bg-obsidian-100">
                All blog posts
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
