// Blog posts at their Webflow addresses (/blog-post/<slug>), migrated in the SEO portal or written
// there. Only published posts render; drafts and unknown slugs 404. Structured data: BlogPosting
// (headline, original dates, author, image, publisher @id) and BreadcrumbList, FAQPage only when the
// post shows FAQs, plus any JSON-LD published for this post in the SEO portal. When a published
// block already describes the post (BlogPosting or Article), the generated one is left out.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronRight } from "lucide-react";
import { mergeSeo, seoFetch, siteOrigin, type SeoMeta } from "@/lib/seo/server";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { GuideMarkdown, inline, safeHref } from "@/components/seo/GuideMarkdown";

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
  const image = post.featuredImage && safeHref(post.featuredImage)?.startsWith("/media/") ? post.featuredImage : null;
  const abs = (p: string) => (p.startsWith("/") ? `${origin}${p}` : p);
  const published = post.datePublished ?? post.publishedAt;
  const modified = post.dateModified ?? post.updatedAt;
  const blocks = Array.isArray(post.schema) ? post.schema : [];
  const hasPostingBlock = blocks.some((b) => typesOf(b).some((t) => t === "BlogPosting" || t === "Article"));
  const cta = post.ctaText && post.ctaUrl ? safeHref(post.ctaUrl) : null;
  const socialImage = post.ogImage ?? post.featuredImage;

  return (
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

      <section aria-label="Introduction" className="border-b border-obsidian-900/[0.06] bg-white">
        <div className="mx-auto max-w-3xl px-page pb-10 pt-10 text-center sm:pt-14">
          <nav aria-label="Breadcrumb" className="mb-5">
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
          <h1 className="text-balance text-4xl font-light tracking-tight text-obsidian-900 sm:text-5xl">{heading}</h1>
          {post.excerpt && <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-slate-700">{post.excerpt}</p>}
          <p className="mt-4 text-sm text-slate-600">
            {post.authorName && <>By {post.authorName} · </>}
            {published ? <time dateTime={published}>{date(published)}</time> : null}
            {published && post.dateModified && post.dateModified.slice(0, 10) !== published.slice(0, 10) && (
              <>
                {" "}
                · Updated <time dateTime={post.dateModified}>{date(post.dateModified)}</time>
              </>
            )}
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl space-y-8 px-page py-12">
        {image && (
          <figure>
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-obsidian-100">
              <Image src={image} alt={post.featuredImageAlt ?? ""} title={post.imageTitle ?? undefined} fill sizes="(min-width: 768px) 48rem, 100vw" className="object-cover" priority />
            </div>
            {post.imageCaption && <figcaption className="mt-2 text-sm text-slate-600">{post.imageCaption}</figcaption>}
          </figure>
        )}

        {post.answerSnippet && (
          <section aria-label="In short" className="rounded-2xl border border-obsidian-900/[0.06] bg-white p-6">
            <p className="mb-2 text-sm text-slate-600">In short</p>
            <p className="text-lg font-light leading-relaxed text-obsidian-900">{inline(post.answerSnippet, "a")}</p>
          </section>
        )}

        {post.body && <GuideMarkdown body={post.body} />}

        {faqs.length > 0 && (
          <section aria-labelledby="post-faq" className="space-y-4">
            <h2 id="post-faq" className="text-2xl font-light text-obsidian-900">
              Frequently asked questions
            </h2>
            {faqs.map((f, i) => (
              <details key={i} className="rounded-xl border border-obsidian-900/[0.08] bg-white p-4">
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
          <section aria-label="About the author" className="rounded-2xl border border-obsidian-900/[0.06] bg-white p-6 text-sm text-slate-700">
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

        <p className="border-t border-obsidian-900/[0.06] pt-6">
          <Link href="/blog" className="text-ocean-600 underline underline-offset-2 hover:text-obsidian-900">
            More from the blog
          </Link>
        </p>
      </article>
    </div>
  );
}
