import React from "react";
import { ServicesHero, type HeroSlide } from "@/components/cinematic/ServicesHero";
import { fromPrice, priceUnitLabel } from "@/lib/tours";
import { getTours } from "@/lib/api/catalog";
import type { TourWithAvailability } from "@/lib/api/types";
import { SERVICES } from "@/lib/services";
import { HeroSearch } from "@/components/home/HeroSearch";
import { TrustRow } from "@/components/home/TrustRow";
import { TopExperiences } from "@/components/home/TopExperiences";
import { ExperienceCategories } from "@/components/cinematic/ExperienceCategories";
import { VerifiedAwardSection } from "@/components/cinematic/VerifiedAwardSection";
import { PlanAheadGuaranteedAccess } from "@/components/cinematic/PlanAheadGuaranteedAccess";
import { SharedTourStory } from "@/components/cinematic/SharedTourStory";
import { PrivateTourStory } from "@/components/cinematic/PrivateTourStory";
import { ShuttleStory } from "@/components/cinematic/ShuttleStory";
import { ActivityTicketsStory } from "@/components/cinematic/ActivityTicketsStory";
import { SharedVsPrivateSlider } from "@/components/cinematic/SharedVsPrivateSlider";
import { ServiceComparisonMatrix } from "@/components/cinematic/ServiceComparisonMatrix";
import { DestinationStoryStream } from "@/components/cinematic/DestinationStoryStream";
import { WhyTravelersLove } from "@/components/cinematic/WhyTravelersLove";
import { GuestTestimonials } from "@/components/cinematic/GuestTestimonials";
import { LiveTrackingTeaser } from "@/components/cinematic/LiveTrackingTeaser";
import { TrustBar } from "@/components/cinematic/TrustBar";
import { CinematicFinalCta } from "@/components/cinematic/CinematicFinalCta";

export const metadata = {
  title: "Vista Chase | Luxury Private Tours & Shuttles • Banff & Lake Louise",
  description:
    "Banff's premier tour operator. Ranked #6 Experience in Canada by TripAdvisor Best of the Best 2025. Guaranteed Moraine Lake access, luxury private SUV tours & shuttles.",
  openGraph: {
    title: "Vista Chase | Canadian Rockies Luxury Tours & Shuttles",
    description:
      "Ranked #6 Experience in Canada by TripAdvisor 2025. Explore Banff, Lake Louise & Moraine Lake in comfort.",
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
      {/* 01: Interactive Services Hero with Ambient Video & Live Tour Cards */}
      <ServicesHero slides={slides} />

      {/* 02: Quick Availability Search & Reassurance Trust Row */}
      <div className="bg-white">
        <HeroSearch />
        <TrustRow />
      </div>

      {/* 03: Official TripAdvisor Best of the Best #6 Canada Award */}
      <VerifiedAwardSection />

      {/* 04: Top Experiences Live Catalog Rail & Filter Chips */}
      <TopExperiences tours={tours} />

      {/* 05: Plan Ahead & Guaranteed Access (Avoid Moraine Lake Parking Restrictions) */}
      <PlanAheadGuaranteedAccess />

      {/* 06: Shared Small-Group Tours Storytelling */}
      <SharedTourStory />

      {/* 07: Private Luxury Tours Storytelling */}
      <PrivateTourStory />

      {/* 08: Shuttle Service Storytelling */}
      <ShuttleStory />

      {/* 09: Rockies Attraction & Activity Tickets */}
      <ActivityTicketsStory />

      {/* 10: Shared vs Private Interactive Pointer / Slider */}
      <SharedVsPrivateSlider />

      {/* 11: Complete Service Comparison Matrix */}
      <ServiceComparisonMatrix />

      {/* 12: Browse Experience Categories */}
      <ExperienceCategories />

      {/* 13: Continuous Scroll-Driven Destination Story Stream */}
      <DestinationStoryStream />

      {/* 14: Why Travelers Choose Vista Chase (6 Core Pillars) */}
      <WhyTravelersLove />

      {/* 15: Verified Traveler Testimonials & Reviews */}
      <GuestTestimonials />

      {/* 16: Live GPS Corridor Tracking Teaser (WhatsApp T-60 Dispatch) */}
      <LiveTrackingTeaser />

      {/* 17: Verified Partner & OTA Trust Bar */}
      <TrustBar />

      {/* 18: Final Cinematic Rockies Call to Action */}
      <CinematicFinalCta />
    </div>
  );
}
