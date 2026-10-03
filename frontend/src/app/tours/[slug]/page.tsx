import { notFound } from "next/navigation";
import { getTourBySlug } from "@/lib/api/catalog";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const tour = await getTourBySlug(params.slug);
  if (!tour) return { title: "Tour Not Found | Vista Chase" };
  return {
    title: `${tour.title} | Vista Chase`,
    description: tour.summary,
    alternates: {
      canonical: `/${tour.slug}`,
    },
  };
}

export default async function GenericTourSlugPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}) {
  const params = await paramsPromise;
  const tour = await getTourBySlug(params.slug);
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
