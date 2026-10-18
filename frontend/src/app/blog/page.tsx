// Blog index, laid out like a travel magazine: a lead story on a dark band, the editor's picks
// (posts marked Featured in the SEO portal or in Webflow's "Featured?" switch), then every other post
// newest first, 12 a page (/blog?page=2 …). Posts come from the SEO portal's published blog posts,
// each at its Webflow address /blog-post/<slug>; drafts never reach this list (the backend returns
// published posts only), so a newly published post appears here within a minute with no code change.
// Guides keep their own list at /guides.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { seoFetch, siteOrigin, withSeo } from "@/lib/seo/server";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";
import { LeadStory, PostCard, type PostSummary } from "@/components/blog/posts";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;
const PICKS = 3;

type Props = { searchParams: Promise<{ page?: string | string[] }> };

/** ?page=N as a number; null when it isn't a plain positive whole number. */
function pageOf(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return /^[1-9]\d{0,3}$/.test(v) ? Number(v) : null;
}

const time = (p: PostSummary) => (p.datePublished ? new Date(p.datePublished).getTime() : 0);

/** Splits the published posts into the lead story, the editor's picks and the rest (newest first). */
function arrange(posts: PostSummary[]) {
  const newest = [...posts].sort((a, b) => time(b) - time(a));
  const featured = newest.filter((p) => p.featured);
  const lead = featured[0] ?? newest[0] ?? null;
  const picks = featured.filter((p) => p !== lead).slice(0, PICKS);
  const shown = new Set([lead, ...picks]);
  return { lead, picks, rest: newest.filter((p) => !shown.has(p)) };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageOf((await searchParams).page) ?? 1;
  const meta = await withSeo("/blog", {
    title: "Banff blog | Vista Chase",
    description: "Stories, tips and seasonal updates for Banff and the Canadian Rockies from the Vista Chase team.",
    alternates: { canonical: "/blog" },
  });
  if (page === 1) return meta;
  // Later pages list different posts, so each is its own canonical page with its own title.
  const title = typeof meta.title === "string" ? meta.title : "Banff blog | Vista Chase";
  return { ...meta, title: `${title} (page ${page})`, alternates: { ...meta.alternates, canonical: `/blog?page=${page}` } };
}

export default async function BlogPage({ searchParams }: Props) {
  const page = pageOf((await searchParams).page);
  const body = await seoFetch<{ posts: PostSummary[] }>("/blog", 5000);
  const posts = body?.posts ?? [];
  const { lead, picks, rest } = arrange(posts);
  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  if (page === null || (body && page > pages)) notFound();
  const list = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const first = page === 1;

  return (
    <>
      <PageSeoExtras path="/blog" />
      <div className="bg-obsidian-50 text-obsidian-900">
        <BreadcrumbJsonLd origin={siteOrigin()} items={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]} />

        <section aria-label="Introduction" className="border-b border-obsidian-900/[0.06] bg-white">
          <div className="mx-auto max-w-3xl px-page pb-12 pt-10 text-center sm:pb-14 sm:pt-14">
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
                <li>
                  <Link href="/" className="hover:text-obsidian-900 hover:underline">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5" />
                </li>
                <li aria-current="page" className="text-obsidian-900">
                  Blog
                </li>
              </ol>
            </nav>
            <p className="text-xs uppercase tracking-[0.28em] text-ocean-600">Blogs</p>
            <h1 className="mt-4 text-balance text-4xl font-light tracking-tight text-obsidian-900 sm:text-6xl">The Vista Chase blog</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-700">Stories and planning tips from Banff and the Canadian Rockies.</p>
          </div>
        </section>

        {posts.length === 0 ? (
          <div className="mx-auto max-w-3xl px-page py-16 text-center text-slate-700">
            <p>
              No posts are published here yet. Our{" "}
              <Link href="/guides" className="text-ocean-600 underline">
                travel guides
              </Link>{" "}
              and{" "}
              <Link href="/faq" className="text-ocean-600 underline">
                FAQ
              </Link>{" "}
              cover the common planning questions.
            </p>
          </div>
        ) : (
          <>
            {first && lead && (
              <section aria-label="Lead story" className="bg-obsidian-950">
                <div className="mx-auto max-w-7xl px-page py-12 sm:py-16 lg:py-20">
                  <LeadStory post={lead} />
                </div>
              </section>
            )}

            {first && picks.length > 0 && (
              <section aria-labelledby="blog-picks" className="border-b border-obsidian-900/[0.06] bg-white">
                <div className="mx-auto max-w-7xl px-page py-14 sm:py-16">
                  <h2 id="blog-picks" className="text-center text-xs uppercase tracking-[0.28em] text-slate-600">
                    Editor&apos;s picks
                  </h2>
                  <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                    {picks.map((p) => (
                      <li key={p.path}>
                        <PostCard post={p} size="large" />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {list.length > 0 && (
              <section aria-labelledby="blog-latest">
                <div className="mx-auto max-w-7xl px-page py-14 sm:py-16">
                  <div className="text-center">
                    <h2 id="blog-latest" className="text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl">
                      Latest stories
                    </h2>
                    {pages > 1 && (
                      <p className="mt-2 text-sm text-slate-600">
                        Page {page} of {pages}
                      </p>
                    )}
                  </div>
                  <ul className="mt-10 grid gap-x-8 gap-y-12 border-t border-obsidian-900/[0.08] pt-10 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((p) => (
                      <li key={p.path}>
                        <PostCard post={p} />
                      </li>
                    ))}
                  </ul>
                  {pages > 1 && <Pagination page={page} pages={pages} />}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

const href = (n: number) => (n === 1 ? "/blog" : `/blog?page=${n}`);

function Pagination({ page, pages }: { page: number; pages: number }) {
  const step = "inline-flex h-11 items-center gap-2 rounded-full border border-obsidian-900/15 bg-white px-5 text-sm text-obsidian-900 hover:bg-obsidian-100";
  return (
    <nav aria-label="Blog pages" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={step} rel="prev">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Newer
        </Link>
      )}
      <ol className="flex flex-wrap items-center gap-1">
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <Link
              href={href(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm ${n === page ? "bg-obsidian-950 text-white" : "text-obsidian-900 hover:bg-obsidian-100"}`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ol>
      {page < pages && (
        <Link href={href(page + 1)} className={step} rel="next">
          Older
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
