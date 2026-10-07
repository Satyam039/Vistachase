import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Compass, Shield, Ticket, Users, Sparkles } from "lucide-react";
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
    title: "Private Tours",
    tagline: "Your Day, Your Way",
    description: "Luxury, comfort, and total flexibility. Design your itinerary with a certified guide in a full-size GMC Yukon Denali XL or Mercedes Sprinter VIP.",
    image: "/media/site/dcb45221eefae27970a0c11f4f7fc0eb3edb65d1-1.webp",
    href: "/private-tours",
    icon: Sparkles,
    badge: "VIP Service",
  },
  {
    id: "shared",
    eyebrow: "MAX 12 GUESTS",
    title: "Shared Tours",
    tagline: "Small Groups, More Fun",
    description: "Explore Banff, Lake Louise, and Yoho National Park with curated scenic stops and expert local storytelling at remarkable value.",
    image: "/media/site/image-2025-11-04t210434-975.webp",
    href: "/shared-tours",
    icon: Users,
    badge: "#6 experience in Canada",
  },
  {
    id: "shuttles",
    eyebrow: "NO PERMIT HASSLE",
    title: "Lake Shuttles",
    tagline: "Skip the Traffic",
    description: "Guaranteed access to Moraine Lake and Lake Louise where private cars are strictly restricted. Direct sunrise and daily departures from Canmore and Banff.",
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    href: "/shuttles",
    icon: Compass,
    badge: "Guaranteed Access",
  },
  {
    id: "multiday",
    eyebrow: "AIRPORT TO PEAKS",
    title: "Multi-Day Packages",
    tagline: "Save More, Stress Less",
    description: "Turn your journey into a seamless 2 to 7-day Rockies adventure. Airport transfers, hotel logistics, and daily guided excursions completely coordinated.",
    image: "/media/videos/athabasca-falls-poster.webp",
    href: "/multi-day-tour-package-for-banff",
    icon: Shield,
    badge: "All-Inclusive",
  },
  {
    id: "tickets",
    eyebrow: "ADD TO YOUR DAY",
    title: "Banff Activity Tickets",
    tagline: "The Rockies' Classics",
    description: "Banff Gondola, Lake Minnewanka cruise, Columbia Icefield Skywalk and the Upper Hot Springs, timed around your tour with one request.",
    image: "/media/site/banff-gondola-hike.webp",
    href: "/banff-activity-tickets",
    icon: Ticket,
    badge: "New",
  },
];

// Bento layout: the two tour styles get the large tiles, the rest share the second row. Photos
// drift slowly against the scroll (data-parallax) and zoom on hover.
const SPAN = ["lg:col-span-3 lg:row-span-1 lg:h-[34rem]", "lg:col-span-3 lg:h-[34rem]", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"];

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
              <li key={category.id} className={`${SPAN[idx]} ${idx === 4 ? "sm:col-span-2 lg:col-span-2" : ""}`}>
                <Link
                  href={category.href}
                  className="group relative flex h-[26rem] flex-col justify-end overflow-hidden rounded-[2rem] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600 lg:h-full lg:min-h-[24rem]"
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 transition-transform duration-[1.4s] ease-out group-hover:scale-[1.06]">
                      <Image
                        src={category.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
                        className="object-cover"
                        data-parallax="6"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/90 via-obsidian-950/35 to-transparent" />
                  </div>

                  {category.badge && (
                    <span className="absolute left-5 top-5 rounded-full bg-white/95 px-3 py-1 text-xs text-obsidian-900">{category.badge}</span>
                  )}

                  <div className="relative p-6 sm:p-7">
                    <p className="mb-2 flex items-center gap-2 text-sm text-summit-300">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {category.tagline}
                    </p>
                    <h3 className="text-2xl font-light text-white sm:text-3xl">{category.title}</h3>
                    <p className="mt-2 max-w-md text-base font-light leading-relaxed text-slate-200 line-clamp-3">{category.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm">
                      <span className="border-b border-summit-500 pb-0.5">Explore {category.title.toLowerCase()}</span>
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
