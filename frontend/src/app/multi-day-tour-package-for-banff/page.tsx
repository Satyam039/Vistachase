import { notFound } from "next/navigation";
import { getTourBySlug } from "@/lib/api/catalog";
import { TourDetailView } from "@/components/tours/TourDetailView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete Canadian Rockies Multi-Day Luxury Tour Package | Vista Chase",
  description:
    "Seamless multi-day travel from Calgary Airport (YYC) pickup, guaranteed Moraine Lake sunrise shuttle, Lake Louise, Yoho, and hotel transfers bundled.",
  alternates: {
    canonical: "/multi-day-tour-package-for-banff",
  },
};

export default async function MultiDayPackagePage() {
  const tour = await getTourBySlug("multi-day-tour-package-for-banff");
  if (!tour) notFound();
  return <TourDetailView tour={tour} />;
}
