import type React from "react";
import { MediaCard } from "@/components/cards/MediaCard";
import { Compass, Shield, Ticket, Users, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/home/SectionHeading";

interface CategoryCard {
  id: string;
  eyebrow: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const CATEGORIES: CategoryCard[] = [
  {
    id: "private",
    eyebrow: "EXCLUSIVE FLEET",
    title: "Private tours",
    tagline: "Your day, your way",
    description: "Your own guide and vehicle: a luxury SUV for up to 6 or an executive van for up to 13. Choose your stops and how long you stay.",
    image: "/media/site/dcb45221eefae27970a0c11f4f7fc0eb3edb65d1-1.webp",
    href: "/private-tours",
    icon: Sparkles,
    badge: "Priced per vehicle",
  },
  {
    id: "shared",
    eyebrow: "MAX 12 GUESTS",
    title: "Shared tours",
    tagline: "Small groups, big days out",
    description: "Banff, Lake Louise, Yoho and the Icefields Parkway in groups of up to 12, with hotel pickup and Parks Canada entry included.",
    image: "/media/site/image-2025-11-04t210434-975.webp",
    href: "/shared-tours",
    icon: Users,
    badge: "#6 experience in Canada",
  },
  {
    id: "shuttles",
    eyebrow: "NO PERMIT HASSLE",
    title: "Lake shuttles",
    tagline: "Skip the parking",
    description: "Private cars can't drive to Moraine Lake; our shuttles can. Sunrise and mid-day departures from Canmore and Banff.",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    href: "/shuttles",
    icon: Compass,
    badge: "Guaranteed access",
  },
  {
    id: "multiday",
    eyebrow: "AIRPORT TO PEAKS",
    title: "Multi-Day Journeys",
    tagline: "No rental car needed",
    description: "2 to 7 days across Banff, Yoho and Jasper with one dedicated guide and airport transfers.",
    image: "/media/videos/athabasca-falls-poster.webp",
    href: "/multi-day-tour-package-for-banff",
    icon: Shield,
    badge: "2–7 days",
  },
  {
    id: "tickets",
    eyebrow: "ADD TO YOUR DAY",
    title: "Activity tickets",
    tagline: "The Rockies' classics",
    description: "Banff Gondola, Lake Minnewanka cruise, Icefield Skywalk and Upper Hot Springs, timed around your tour.",
    image: "/media/site/banff-gondola-hike.webp",
    href: "/banff-activity-tickets",
    icon: Ticket,
    badge: "New",
  },
];

// The two tour styles get the wide cards in the first row, the rest share the second row. Every
// card is a MediaCard (photo on top, content panel below); photos drift slowly against the scroll
// (data-parallax) and zoom on hover. Cards in the same row share an aspect so their heights match.
const SPAN = ["lg:col-span-3", "lg:col-span-3", "lg:col-span-2", "lg:col-span-2", "sm:col-span-2 lg:col-span-2"];
const ASPECT = ["aspect-[5/4] lg:aspect-[16/9]", "aspect-[5/4] lg:aspect-[16/9]", "aspect-[5/4]", "aspect-[5/4]", "aspect-[5/4] sm:aspect-[21/9] lg:aspect-[5/4]"];

export function ExperienceCategories() {
  return (
    <section id="experiences" aria-labelledby="experiences-heading" className="bg-white py-20 text-obsidian-900 sm:py-28">
      <div className="mx-auto max-w-7xl px-page">
        <SectionHeading
          id="experiences-heading"
          eyebrow="Five ways to explore"
          title="Choose how you see the Rockies"
          intro="Join a small group, go private in your own vehicle, ride the lake shuttle, let us plan several days, or add the Rockies' classic attractions."
        />

        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6" data-stagger>
          {CATEGORIES.map((category, idx) => {
            const Icon = category.icon;
            return (
              <li key={category.id} className={SPAN[idx]}>
                <MediaCard
                  href={category.href}
                  image={category.image}
                  sizes={idx < 2 ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"}
                  aspect={ASPECT[idx]}
                  badge={category.badge}
                  eyebrow={category.tagline}
                  eyebrowIcon={Icon}
                  title={category.title}
                  description={category.description}
                  cta={`Explore ${category.title.toLowerCase()}`}
                  parallax
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
