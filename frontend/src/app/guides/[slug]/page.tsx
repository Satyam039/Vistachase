// Travel guides written and published from the admin SEO dashboard (/admin/seo). Only published
// guides render; drafts and unknown slugs 404. Structured data describes only what is shown here:
// Article and BreadcrumbList always, FAQPage only when the guide shows FAQs.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronRight } from "lucide-react";
import { mergeSeo, seoFetch, siteOrigin, type SeoMeta } from "@/lib/seo/server";
import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { GuideMarkdown, inline, safeHref } from "@/components/seo/GuideMarkdown";
import { PageSeoExtras } from "@/components/seo/PageSeoExtras";

interface Guide extends SeoMeta {
  label: string;
  excerpt: string | null;
  body: string | null;
  answerSnippet: string | null;
  citationFact: string | null;
  faqs: { question: string; answer: string }[] | null;
  authorName: string | null;
  authorBio: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  imageTitle: string | null;
  imageCaption: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  related: { path: string; label: string }[];
  /** JSON-LD published for this guide in the SEO portal (validated there). */
  schema?: Record<string, unknown>[];
}

type Props = { params: Promise<{ slug: string }> };

const loadGuide = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const body = await seoFetch<{ guide: Guide }>(`/guides/${slug}`, 5000);
  return body?.guide ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide) return { title: "Page not found | Vista Chase" };
  const title = guide.seoTitle ?? `${guide.label} | Vista Chase`;
  const description = guide.metaDescription ?? guide.excerpt ?? undefined;
  return mergeSeo(
    {
      title,
      description,
      alternates: { canonical: guide.path },
      openGraph: { type: "article", title, description },
    },
    guide,
  );
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Edmonton" });

/** The call-to-action link with its UTM tags, or null when the link isn't safe. */
function ctaHref(guide: Guide) {
  const href = guide.ctaUrl ? safeHref(guide.ctaUrl) : null;
  if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  const url = new URL(href, "https://placeholder.invalid");
  if (guide.utmSource) url.searchParams.set("utm_source", guide.utmSource);
  if (guide.utmMedium) url.searchParams.set("utm_medium", guide.utmMedium);
  if (guide.utmCampaign) url.searchParams.set("utm_campaign", guide.utmCampaign);
  return href.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide) notFound();

  const origin = siteOrigin();
  const heading = guide.h1 ?? guide.label;
  const faqs = Array.isArray(guide.faqs) ? guide.faqs : [];
  const image = guide.featuredImage && safeHref(guide.featuredImage)?.startsWith("/media/") ? guide.featuredImage : null;
  const cta = guide.ctaText ? ctaHref(guide) : null;
  const abs = (p: string) => (p.startsWith("/") ? `${origin}${p}` : p);

  return (
    <>
      <PageSeoExtras path={`/guides/${slug}`} schema={false} />
    <div className="bg-obsidian-50 text-obsidian-900">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: heading,
          ...(guide.metaDescription || guide.excerpt ? { description: guide.metaDescription ?? guide.excerpt } : {}),
          mainEntityOfPage: `${origin}${guide.path}`,
          ...(image ? { image: abs(image) } : {}),
          ...(guide.publishedAt ? { datePublished: guide.publishedAt } : {}),
          dateModified: guide.updatedAt,
          ...(guide.authorName ? { author: { "@type": "Person", name: guide.authorName } } : {}),
          publisher: { "@id": "https://www.vistachase.com/#organization" },
        }}
      />
      <BreadcrumbJsonLd origin={origin} items={[{ name: "Home", path: "/" }, { name: guide.breadcrumbLabel ?? guide.label, path: guide.path }]} />
      {(Array.isArray(guide.schema) ? guide.schema : []).map((b, i) => (
        <JsonLd key={`schema-${i}`} data={b} />
      ))}
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
                {guide.breadcrumbLabel ?? guide.label}
              </li>
            </ol>
          </nav>
          <h1 className="text-balance text-4xl font-light tracking-tight text-obsidian-900 sm:text-5xl">{heading}</h1>
          {guide.excerpt && <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-slate-700">{guide.excerpt}</p>}
          <p className="mt-4 text-sm text-slate-600">
            {guide.authorName && <>By {guide.authorName} · </>}
            {guide.reviewedAt ? <>Reviewed {date(guide.reviewedAt)}</> : <>Updated {date(guide.updatedAt)}</>}
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl space-y-8 px-page py-12">
        {image && (
          <figure>
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-obsidian-100">
              <Image src={image} alt={guide.featuredImageAlt ?? ""} title={guide.imageTitle ?? undefined} fill sizes="(min-width: 768px) 48rem, 100vw" className="object-cover" priority />
            </div>
            {guide.imageCaption && <figcaption className="mt-2 text-sm text-slate-600">{guide.imageCaption}</figcaption>}
          </figure>
        )}

        {guide.answerSnippet && (
          <section aria-label="In short" className="rounded-2xl border border-obsidian-900/[0.06] bg-white p-6">
            <p className="mb-2 text-sm text-slate-600">In short</p>
            <p className="text-lg font-light leading-relaxed text-obsidian-900">{inline(guide.answerSnippet, "a")}</p>
          </section>
        )}

        {guide.body && <GuideMarkdown body={guide.body} />}

        {guide.citationFact && (
          <aside aria-label="Key fact" className="border-l-2 border-ocean-600 pl-4 text-slate-700">
            {inline(guide.citationFact, "c")}
          </aside>
        )}

        {faqs.length > 0 && (
          <section aria-labelledby="guide-faq" className="space-y-4">
            <h2 id="guide-faq" className="text-2xl font-light text-obsidian-900">
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

        {cta && guide.ctaText && (
          <p>
            <Link href={cta} className="inline-flex items-center gap-2 rounded-full bg-obsidian-950 px-6 py-3 text-white hover:bg-obsidian-900">
              {guide.ctaText}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>
        )}

        {guide.authorName && guide.authorBio && (
          <section aria-label="About the author" className="rounded-2xl border border-obsidian-900/[0.06] bg-white p-6 text-sm text-slate-700">
            <p className="text-obsidian-900">{guide.authorName}</p>
            <p className="mt-1">{guide.authorBio}</p>
          </section>
        )}

        {guide.related.length > 0 && (
          <nav aria-labelledby="guide-related">
            <h2 id="guide-related" className="mb-3 text-lg text-obsidian-900">
              Related
            </h2>
            <ul className="list-disc space-y-1.5 pl-6 marker:text-ocean-600">
              {guide.related.map((r) => (
                <li key={r.path}>
                  <Link href={r.path} className="text-ocean-600 underline underline-offset-2 hover:text-obsidian-900">
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
    </div>
    </>
  );
}
