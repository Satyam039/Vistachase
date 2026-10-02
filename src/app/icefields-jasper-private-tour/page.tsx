import { notFound } from "next/navigation";
import { getTourBySlug } from "@/modules/tours/tour.repository";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Icefields Parkway & Jasper Full-Day Private Tour | Vista Chase",
  description:
    "Traverse one of the world's top scenic drives: Peyto Lake, Bow Lake, Columbia Icefield & Athabasca Glacier in luxury private SUV.",
  alternates: {
    canonical: "/icefields-jasper-private-tour",
  },
};

export default async function IcefieldsJasperTourPage() {
  const tour = await getTourBySlug("icefields-jasper-private-tour");
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
