"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Compass, Shield, Users, Sparkles } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

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
    image: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/69108a62d2ab543e335612b6_dcb45221eefae27970a0c11f4f7fc0eb3edb65d1%20(1).jpg",
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
    image: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/690a1613098a903d97414ebd_Image%20-%202025-11-04T210434.975.png",
    href: "/shared-tours",
    icon: Users,
    badge: "TripAdvisor Top 10",
  },
  {
    id: "shuttles",
    eyebrow: "NO PERMIT HASSLE",
    title: "Lake Shuttles",
    tagline: "Skip the Traffic",
    description: "Guaranteed access to Moraine Lake and Lake Louise where private cars are strictly restricted. Direct sunrise and daily departures from Canmore and Banff.",
    image: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/68e75d228ead1330ef50075f_Moraine-Lake-Perfect-Reflection.webp",
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
    image: "https://cdn.prod.website-files.com/68b7e25c3eb9527f343084ae/691010a937bd1626bd437647_Horse%20Background%20Image%20V3.png",
    href: "/multi-day-tour-package-for-banff",
    icon: Shield,
    badge: "All-Inclusive",
  },
];

export function ExperienceCategories() {
  return (
    <section id="experiences" className="py-24 sm:py-32 bg-obsidian-50 text-obsidian-900">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        {/* Header Section */}
        <div className="max-w-3xl mb-16">
          <ScrollReveal delay={100} yOffset={16}>
            <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-ocean-600">
              FOUR WAYS TO JOURNEY
            </span>
          </ScrollReveal>
          <ScrollReveal delay={200} yOffset={20}>
            <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-obsidian-900 font-display">
              Tailored Mountain Experiences
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={300} yOffset={16}>
            <p className="mt-4 text-base sm:text-lg text-slate-600 font-light leading-relaxed">
              Every traveler moves differently. Whether you seek total private seclusion, high-energy small-group discovery, or seamless lake shuttle access.
            </p>
          </ScrollReveal>
        </div>

        {/* 4 Pillar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {CATEGORIES.map((category, idx) => {
            const Icon = category.icon;
            return (
              <ScrollReveal key={category.id} delay={150 * (idx + 1)} yOffset={28}>
                <Link
                  href={category.href}
                  className="group relative flex flex-col justify-between h-[480px] sm:h-[520px] rounded-xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-black/5"
                >
                  {/* Background Image with Dark Vignette */}
                  <div className="absolute inset-0 z-0">
                    <Image
                      src={category.image}
                      alt={category.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/60 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-85" />
                  </div>

                  {/* Top Badge */}
                  <div className="relative z-10 p-6 flex justify-between items-start">
                    <div className="p-2.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-summit-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    {category.badge && (
                      <span className="px-2.5 py-1 rounded text-[11px] font-bold tracking-wider uppercase bg-summit-500 text-obsidian-900 shadow-sm">
                        {category.badge}
                      </span>
                    )}
                  </div>

                  {/* Bottom Content */}
                  <div className="relative z-10 p-6 text-white">
                    <span className="text-xs font-semibold tracking-[0.16em] uppercase text-summit-300 mb-1 block">
                      {category.tagline}
                    </span>
                    <h3 className="text-2xl font-bold font-display group-hover:text-summit-300 transition-colors duration-300">
                      {category.title}
                    </h3>
                    <p className="mt-2.5 text-sm text-slate-300/90 leading-relaxed font-light line-clamp-3">
                      {category.description}
                    </p>

                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-summit-400 transition-colors">
                      <span>Explore Options</span>
                      <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
