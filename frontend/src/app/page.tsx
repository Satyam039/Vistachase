import React from "react";
import { ServicesHero, type HeroSlide } from "@/components/cinematic/ServicesHero";
import { fromPrice, priceUnitLabel } from "@/lib/tours";
import { getCategoryExtras, getTours } from "@/lib/api/catalog";
import type { TourWithAvailability } from "@/lib/api/types";
import { SERVICES } from "@/lib/services";
import { TrustRow } from "@/components/home/TrustRow";
import { TopExperiences } from "@/components/home/TopExperiences";
import { ExperienceCategories } from "@/components/cinematic/ExperienceCategories";
import { DestinationStoryStream } from "@/components/cinematic/DestinationStoryStream";
import { PlanAheadGuaranteedAccess } from "@/components/cinematic/PlanAheadGuaranteedAccess";
import { WhyTravelersLove } from "@/components/cinematic/WhyTravelersLove";
import { VerifiedAwardSection } from "@/components/cinematic/VerifiedAwardSection";
import { GuestTestimonials } from "@/components/cinematic/GuestTestimonials";
import { LiveTrackingTeaser } from "@/components/cinematic/LiveTrackingTeaser";
import { TrustBar } from "@/components/cinematic/TrustBar";

export const metadata = {
  title: "Vista Chase | Luxury Private Tours & Shuttles • Banff & Lake Louise",
  description:
    "Banff's premier tour operator. Ranked #6 Experience in Canada by TripAdvisor Best of the Best 2026. Guaranteed Moraine Lake access, luxury private SUV tours & shuttles.",
  openGraph: {
    title: "Vista Chase | Canadian Rockies Luxury Tours & Shuttles",
    description:
      "Ranked #6 Experience in Canada by TripAdvisor 2026. Explore Banff, Lake Louise & Moraine Lake in comfort.",
    images: [
      {
        url: "/media/site/hero-background-image-3.webp",
        width: 1200,
        height: 630,
        alt: "Vista Chase Canadian Rockies",
      },
    ],
  },
};

export default async function HomePage() {
  let tours: TourWithAvailability[] = [];
  try {
    tours = await getTours();
  } catch (err) {
    console.warn("[HomePage] getTours failed, fallback to empty array:", err);
  }

  let reviews: any[] = [];
  try {
    const extras = await getCategoryExtras(tours);
    reviews = extras?.reviews || [];
  } catch (err) {
    console.warn("[HomePage] getCategoryExtras failed:", err);
  }

  const slides: HeroSlide[] = SERVICES.map((service) => ({
    ...service,
    tours: (tours || [])
      .filter((t) => t.category === service.category)
      .slice(0, 3)
      .map((t) => ({
        slug: t.slug,
        title: t.title,
        rating: t.rating,
        reviewCount: t.reviewCount,
        price: fromPrice(t),
        unit: t.category === "TICKET" ? "per ticket" : priceUnitLabel(t),
      })),
  }));

  return (
    <div className="flex w-full flex-col bg-white selection:bg-summit-500 selection:text-obsidian-900">
      <ServicesHero slides={slides} />
      <TrustRow />
      <TopExperiences tours={tours} />
      <ExperienceCategories />
      <DestinationStoryStream />
      <PlanAheadGuaranteedAccess />
      <WhyTravelersLove />
      <VerifiedAwardSection />
      <GuestTestimonials reviews={reviews} />
      <LiveTrackingTeaser />
      <TrustBar />
    </div>
  );
}
