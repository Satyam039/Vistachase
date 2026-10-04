import React from "react";
import { CinematicHero } from "@/components/cinematic/CinematicHero";
import { VerifiedAwardSection } from "@/components/cinematic/VerifiedAwardSection";
import { PlanAheadGuaranteedAccess } from "@/components/cinematic/PlanAheadGuaranteedAccess";
import { ExperienceCategories } from "@/components/cinematic/ExperienceCategories";
import { DestinationStoryStream } from "@/components/cinematic/DestinationStoryStream";
import { WhyTravelersLove } from "@/components/cinematic/WhyTravelersLove";
import { FeaturedExperiences } from "@/components/cinematic/FeaturedExperiences";
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

export default function HomePage() {
  return (
    <div className="flex flex-col w-full bg-obsidian-50 selection:bg-summit-500 selection:text-obsidian-900">
      {/* 01: Full-Screen Cinematic Hero */}
      <CinematicHero
        videoSrc="/media/videos/lake-louise-summer.mp4"
        videoSrcHd="/media/videos/lake-louise-summer-1080.mp4"
        posterImage="/media/videos/lake-louise-summer-poster.webp"
      />

      {/* 02: Official TripAdvisor Best of the Best #6 Canada Award */}
      <VerifiedAwardSection />

      {/* 03: Plan Ahead & Guaranteed Access (Avoid Parking Restrictions) */}
      <PlanAheadGuaranteedAccess />

      {/* 04: Four Experience Pillars (Private, Shared, Shuttles, Multi-Day) */}
      <ExperienceCategories />

      {/* 05: Continuous Scroll-Driven Destination Story Stream */}
      <DestinationStoryStream />

      {/* 06: Why Travelers Choose Vista Chase (6 Core Pillars) */}
      <WhyTravelersLove />

      {/* 07: Featured Experiences with Bókun Availability */}
      <FeaturedExperiences />

      {/* 08: Verified Traveler Testimonials & Reviews */}
      <GuestTestimonials />

      {/* 09: Live GPS Corridor Tracking Teaser (WhatsApp T-60) */}
      <LiveTrackingTeaser />

      {/* 10: Verified Partner & OTA Trust Bar */}
      <TrustBar />

      {/* 11: Final Cinematic Rockies Call to Action */}
      <CinematicFinalCta />
    </div>
  );
}
