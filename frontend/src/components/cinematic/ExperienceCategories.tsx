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
    id: "shared",
    eyebrow: "MAX 12 GUESTS",
    title: "Small-Group Tours",
    tagline: "Small groups, big days out",
    description: "Share the adventure with no more than 12 guests, led by a passionate guide.",
    image: "/media/site/image-2025-11-04t210434-975.webp",
    href: "/shared-tours",
    icon: Users,
    badge: "#6 experience in Canada",
  },
  {
    id: "private",
    eyebrow: "EXCLUSIVE FLEET",
    title: "Private Tours",
    tagline: "Your day, your way",
    description: "Your own guide and vehicle, with personal attention and flexibility to shape your day.",
    image: "/media/site/dcb45221eefae27970a0c11f4f7fc0eb3edb65d1-1.webp",
    href: "/private-tours",
    icon: Sparkles,
    badge: "Priced per vehicle",
  },
  {
    id: "shuttles",
    eyebrow: "NO PERMIT HASSLE",
    title: "Lake Shuttles",
    tagline: "Leave the driving to us",
    description:
      "Experience sunrise at Moraine Lake or enjoy a relaxed day exploring Moraine Lake and Lake Louise. Convenient departures from Banff and Canmore.",
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
    description:
      "Discover more of the Canadian Rockies with a thoughtfully planned journey across several days. For a fully tailored itinerary, our sister company Banff Elite can plan your journey.",
    image: "/media/videos/athabasca-falls-poster.webp",
    href: "/multi-day-tour-package-for-banff",
    icon: Shield,
  },
  {
    id: "tickets",
    eyebrow: "ADD TO YOUR DAY",
    title: "Attraction Tickets",
    tagline: "Add another highlight",
    description:
      "Take in mountain views by gondola, cruise Lake Minnewanka or discover the Columbia Icefield. Find an unforgettable addition to your Rockies visit.",
    image: "/media/site/banff-gondola-hike.webp",
    href: "/banff-activity-tickets",
    icon: Ticket,
    badge: "New",
  },
];

// The two tour styles (small-group, private) get the wide cards in the first row, the rest share the second row. Every
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
          title="Choose How You See the Rockies"
          intro="Join a small group, enjoy a private tour, take a lake shuttle or explore further on a multi-day journey. Complete your visit with unforgettable attractions."
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
                  cta={`Explore ${category.title}`}
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
