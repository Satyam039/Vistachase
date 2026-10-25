// Blog posts at their Webflow addresses (/blog-post/<slug>), migrated in the SEO portal or written
// there. Only published posts render; drafts and unknown slugs 404. Structured data: BlogPosting
// (headline, original dates, author, image, publisher @id) and BreadcrumbList, FAQPage only when the
// post shows FAQs, plus any JSON-LD published for this post in the SEO portal. When a published
// block already describes the post (BlogPosting or Article), the generated one is left out.
//
// Magazine layout (the print-magazine page the team supplied): a kicker line and a large upper-case
// serif headline between rules, a short summary line, the opening paragraphs beside a large lead image,
// then the rest of the post set in ruled newspaper columns (three on desktop, two on tablets, one on
// phones), quotes as hand-written pull quotes, then FAQ, links and "More stories" from the blog. The
// columns run in "spreads" of a few hundred words, so a reader never scrolls a full page down one
// column and back up for the next. Webflow posts often open their body with the post's own title
// and hero image; when they do, those are shown once (as the headline and the lead image) instead of
// twice. That happens only on the page: the stored post is never changed.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronRight } from "lucide-react";
import { mergeSeo, seoFetch, siteOrigin, type SeoMeta } from "@/lib/seo/server";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { GuideBlock, guideRootClass, inline, parseGuide, plainText, safeHref, type Block } from "@/components/seo/GuideMarkdown";
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
  tags?: string[] | null;
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

const wordsIn = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Rough reading weight of a block in words, so images and tables count for the room they take. */
function weightOf(b: Block): number {
  switch (b.kind) {
    case "img":
      return 140;
    case "table":
      return 30 + b.rows.length * 20;
    case "ul":
    case "ol":
      return b.items.reduce((n, item) => n + wordsIn(item) + 4, 0);
    case "quote":
      return wordsIn(b.text) * 2 + 10;
    default:
      return wordsIn(b.text);
  }
}

const isHeading = (b: Block) => b.kind === "h2" || b.kind === "h3" || b.kind === "h4";

/** The opening paragraphs that sit beside the lead image (about as tall as the image), and the rest.
 *  With no lead image (limit 0) everything goes to the columns. */
function leadOf(blocks: Block[], limit: number) {
  let i = 0;
  let words = 0;
  while (limit > 0 && i < blocks.length && blocks[i].kind === "p" && (i === 0 || words + weightOf(blocks[i]) <= limit)) words += weightOf(blocks[i++]);
  return { lead: blocks.slice(0, i), rest: blocks.slice(i) };
}

const SPREAD_WORDS = 650;

/** The body cut into spreads of about SPREAD_WORDS, at a heading where possible and never just after one. */
function spreadsOf(blocks: Block[]): Block[][] {
  const spreads: Block[][] = [];
  let cur: Block[] = [];
  let words = 0;
  for (const b of blocks) {
    const prev = cur[cur.length - 1];
    const cut = cur.length > 0 && !(prev && isHeading(prev)) && (isHeading(b) ? words >= SPREAD_WORDS * 0.6 : words >= SPREAD_WORDS * 1.15);
    if (cut) {
      spreads.push(cur);
      cur = [];
      words = 0;
    }
    cur.push(b);
    words += weightOf(b);
  }
  if (cur.length) spreads.push(cur);
  return spreads;
}

/** A heading travels with the block after it, so a column never ends on a heading. */
function unitsOf(blocks: Block[]): Block[][] {
  const units: Block[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (isHeading(blocks[i]) && i + 1 < blocks.length && !isHeading(blocks[i + 1]) && weightOf(blocks[i + 1]) < 220) {
      units.push([blocks[i], blocks[i + 1]]);
      i++;
    } else units.push([blocks[i]]);
  }
  return units;
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
  const heading = plainText(post.h1 ?? post.label);
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
  const { lead, rest } = leadOf(parseGuide(opening.body), hero ? 150 : 0);
  const spreads = spreadsOf(rest);
  const bodyWords = rest.reduce((n, b) => n + weightOf(b), 0);
  // A short summary reads as the headline's sub-line; a long one opens the text column instead.
  const subline = post.excerpt && post.excerpt.length <= 170 ? post.excerpt : null;
  const tags = (post.tags ?? []).filter(Boolean).slice(0, 3);
  const kicker = tags.length ? tags.join("  •  ") : "The Vista Chase journal  •  Banff & the Canadian Rockies";

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

        <article className="bg-paper">
          <header className="mx-auto max-w-6xl px-page pb-8 pt-8 sm:pt-10">
            <nav aria-label="Breadcrumb" className="mb-6">
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
            <Ruled>
              <p className="text-center font-magazine text-xs uppercase tracking-[0.28em] text-obsidian-900">{kicker}</p>
            </Ruled>
            <h1 className="mx-auto mt-4 max-w-5xl text-balance text-center font-magazine text-4xl font-medium uppercase leading-[1.02] tracking-tight text-obsidian-900 sm:text-6xl lg:text-7xl">{heading}</h1>
            {subline && <p className="mx-auto mt-4 max-w-3xl text-balance text-center font-magazine text-base italic leading-relaxed text-obsidian-800 sm:text-lg">{subline}</p>}
            <div className="mt-5">
              <Ruled>
                <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-magazine text-xs uppercase tracking-[0.24em] text-obsidian-900 sm:text-sm">
                  {published ? <time dateTime={published}>{date(published)}</time> : <span>Vista Chase</span>}
                  {minutes && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>{minutes} min read</span>
                    </>
                  )}
                  {post.authorName && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>By {post.authorName}</span>
                    </>
                  )}
                </p>
              </Ruled>
            </div>
            {published && post.dateModified && post.dateModified.slice(0, 10) !== published.slice(0, 10) && (
              <p className="mt-3 text-center text-sm text-slate-600">
                Updated <time dateTime={post.dateModified}>{date(post.dateModified)}</time>
              </p>
            )}
          </header>

          <div className="mx-auto max-w-6xl px-page pb-14">
            {/* Opening: the summary and the first paragraphs beside the lead image. */}
            <div className={`grid gap-8 ${hero ? "lg:grid-cols-3" : ""}`}>
              <div className={`space-y-5 ${hero ? "lg:order-1" : "mx-auto max-w-3xl"}`}>
                {post.excerpt && !subline && <p className="font-magazine text-lg italic leading-relaxed text-obsidian-900">{post.excerpt}</p>}
                {post.answerSnippet && (
                  <section aria-label="In short" className="border-t border-obsidian-900/60 pt-4">
                    <p className="mb-2 font-magazine text-sm font-medium uppercase tracking-wide text-obsidian-900">In short</p>
                    <p className="font-magazine leading-[1.7] text-obsidian-800">{inline(post.answerSnippet, "a")}</p>
                  </section>
                )}
                {lead.length > 0 && (
                  <div className={guideRootClass("magazine")}>
                    {lead.map((b, i) => (
                      <GuideBlock key={i} block={b} index={i} variant="magazine" />
                    ))}
                  </div>
                )}
              </div>
              {hero && (
                <figure className="order-first lg:order-2 lg:col-span-2">
                  <div className="relative aspect-[4/3] overflow-hidden bg-obsidian-200">
                    <PostImage src={hero.src} alt={hero.alt} sizes="(min-width: 1152px) 46rem, 100vw" priority />
                  </div>
                  {post.imageCaption && <figcaption className="mt-2 font-magazine text-sm italic text-slate-700">{post.imageCaption}</figcaption>}
                </figure>
              )}
            </div>

            {/* The rest in ruled columns, a spread at a time. */}
            {spreads.map((spread, s) => (
              <div
                key={s}
                className={`mt-6 border-obsidian-900/60 md:mt-10 md:border-t md:pt-6 ${bodyWords < 300 ? "mx-auto max-w-3xl" : "gap-10 [column-rule:1px_solid_theme(colors.obsidian.300)] md:columns-2 lg:columns-3"} ${guideRootClass("magazine").replace("space-y-4", "")}`}
              >
                {unitsOf(spread).map((unit, u) => (
                  <div key={u} className={`mb-4 ${unit.length > 1 || unit[0].kind !== "p" ? "break-inside-avoid" : ""}`}>
                    {unit.map((b, i) => (
                      <GuideBlock
                        key={i}
                        block={b}
                        index={s * 1000 + u * 10 + i}
                        variant="magazine"
                        className={isHeading(b) ? `mb-2 ${u > 0 && b.kind === "h2" ? "mt-6 border-t border-obsidian-900/40 pt-4" : ""}` : ""}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {faqs.length > 0 && (
              <section aria-labelledby="post-faq" className="mx-auto mt-6 max-w-3xl space-y-4 border-t border-obsidian-900/60 pt-6">
                <h2 id="post-faq" className="font-magazine text-2xl font-medium uppercase tracking-wide text-obsidian-900">
                  Frequently asked questions
                </h2>
                {faqs.map((f, i) => (
                  <details key={i} className="border-b border-obsidian-900/20 pb-3">
                    <summary className="cursor-pointer font-magazine text-obsidian-900">{f.question}</summary>
                    <p className="mt-2 font-magazine leading-relaxed text-obsidian-800">{f.answer}</p>
                  </details>
                ))}
              </section>
            )}

            {(cta || (post.authorName && post.authorBio) || post.related.length > 0) && (
              <div className="mx-auto mt-10 max-w-3xl space-y-8 border-t border-obsidian-900/60 pt-6">
                {cta && post.ctaText && (
                  <p>
                    <Link href={cta} className="inline-flex items-center gap-2 rounded-full bg-obsidian-950 px-6 py-3 text-white hover:bg-obsidian-900">
                      {post.ctaText}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </p>
                )}
                {post.authorName && post.authorBio && (
                  <section aria-label="About the author" className="font-magazine text-sm text-obsidian-800">
                    <p className="text-obsidian-900">{post.authorName}</p>
                    <p className="mt-1">{post.authorBio}</p>
                  </section>
                )}
                {post.related.length > 0 && (
                  <nav aria-labelledby="post-related">
                    <h2 id="post-related" className="mb-3 font-magazine text-lg font-medium uppercase tracking-wide text-obsidian-900">
                      Related
                    </h2>
                    <ul className="list-disc space-y-1.5 pl-6 font-magazine marker:text-ocean-600">
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
            )}
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

/** A line of text between two horizontal rules, like a magazine's masthead lines. */
function Ruled({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-obsidian-900/70" />
      <div className="max-w-[80%]">{children}</div>
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-obsidian-900/70" />
    </div>
  );
}
