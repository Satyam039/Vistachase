// Every vistachase.com product lives at a top-level URL (/banff-highlights-tour,
// /winter-special, …). Static routes such as /about-us take precedence over this
// segment; anything that isn't a tour slug falls through to the 404 page.
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTourBySlug, getTours } from "@/lib/api/catalog";
import { TourDetailView } from "@/components/tours/TourDetailView";

type Props = { params: Promise<{ slug: string }> };

// generateMetadata and the page share one backend request per render.
const loadTour = cache((slug: string) => getTourBySlug(slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tour = await loadTour(slug);
  if (!tour) return { title: "Page not found | Vista Chase" };
  const title = tour.metaTitle ?? `${tour.title} | Vista Chase`;
  const description = tour.metaDescription ?? tour.summary;
  return {
    title,
    description,
    alternates: { canonical: `/${tour.slug}` },
    openGraph: { title, description, images: tour.featuredImage ? [tour.featuredImage] : undefined },
  };
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const tour = await loadTour(slug);
  if (!tour) notFound();

  const related = tour.crossSells.length > 0 ? await getTours() : [];
  const bySlug = new Map(related.map((t) => [t.slug, t]));
  const crossSells = tour.crossSells.flatMap((s) => bySlug.get(s) ?? []);

  return <TourDetailView tour={tour} related={crossSells} />;
}
