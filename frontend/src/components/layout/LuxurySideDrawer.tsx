"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronDown,
  Sparkles,
  MapPin,
  Calendar,
  Phone,
  Bus,
  Users,
  CarFront,
  CalendarDays,
  Ticket,
  HelpCircle,
  Compass,
  Briefcase,
  Star,
  ArrowRight,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

interface LuxurySideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LuxurySideDrawer({ isOpen, onClose }: LuxurySideDrawerProps) {
  const pathname = usePathname();
  const [experiencesOpen, setExperiencesOpen] = useState(true);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className={`fixed inset-0 bg-obsidian-950/70 backdrop-blur-md z-40 transition-opacity duration-400 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer from Left */}
      <aside
        id="side-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Vista Chase Navigation Menu"
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-[460px] bg-ocean-950/98 backdrop-blur-2xl border-r border-white/10 shadow-2xl flex flex-col justify-between transform transition-transform duration-500 ease-out text-white overflow-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Header of Drawer */}
        <div className="p-6 sm:p-8 border-b border-white/10 flex items-center justify-between">
          <Link href="/" onClick={onClose} className="flex items-center gap-3 group">
            <BrandMark size={36} />
            <div>
              <span className="text-xl font-serif font-light tracking-wide text-white group-hover:text-summit-300 transition-colors block leading-tight">
                Vista Chase
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-summit-400 font-sans block">
                Canadian Rockies • Banff
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:border-summit-500 hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 divide-y divide-white/5 font-sans">
          {/* Main Links */}
          <div className="space-y-4 pt-2">
            <div>
              <Link
                href="/"
                className="text-2xl sm:text-3xl font-serif font-light tracking-tight text-white hover:text-summit-300 transition-colors flex items-center justify-between group"
              >
                <span>Home</span>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-summit-400 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>

            {/* EXPERIENCES (Expandable) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setExperiencesOpen(!experiencesOpen)}
                className="w-full text-left text-2xl sm:text-3xl font-serif font-light tracking-tight text-white hover:text-summit-300 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span>Experiences</span>
                  <span className="text-[11px] font-sans font-medium uppercase tracking-widest text-summit-400 bg-summit-500/10 border border-summit-500/30 px-2 py-0.5 rounded-full">
                    Guaranteed
                  </span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-white/50 group-hover:text-summit-400 transition-transform duration-300 ${
                    experiencesOpen ? "rotate-180 text-summit-400" : ""
                  }`}
                />
              </button>

              {experiencesOpen && (
                <div className="mt-3 pl-3 space-y-2.5 border-l border-summit-500/30 ml-1.5 py-1">
                  <Link
                    href="/shared-tours"
                    className="flex items-center gap-3 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-summit-400 group-hover:scale-105 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-100 block">Shared Tours</span>
                      <span className="text-xs text-slate-400 block font-light">Small groups (max 12), TripAdvisor #6</span>
                    </div>
                  </Link>

                  <Link
                    href="/private-tours"
                    className="flex items-center gap-3 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-summit-400 group-hover:scale-105 transition-transform">
                      <CarFront className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-100 block">Private SUV Tours</span>
                      <span className="text-xs text-slate-400 block font-light">Bespoke itinerary, GMC Yukon XL VIP</span>
                    </div>
                  </Link>

                  <Link
                    href="/shuttles"
                    className="flex items-center gap-3 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-summit-400 group-hover:scale-105 transition-transform">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-100 block">Lake Shuttles</span>
                      <span className="text-xs text-slate-400 block font-light">Guaranteed Moraine & Lake Louise seats</span>
                    </div>
                  </Link>

                  <Link
                    href="/#activity-tickets"
                    className="flex items-center gap-3 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-summit-400 group-hover:scale-105 transition-transform">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-100 block">Activity Tickets & Add-Ons</span>
                      <span className="text-xs text-slate-400 block font-light">Banff Gondola & Minnewanka Cruise</span>
                    </div>
                  </Link>

                  <Link
                    href="/multi-day-tour-package-for-banff"
                    className="flex items-center gap-3 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-summit-400 group-hover:scale-105 transition-transform">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-100 block">Multi-Day Packages</span>
                      <span className="text-xs text-slate-400 block font-light">Airport transfers + multi-day guiding</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* DESTINATIONS (Expandable) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDestinationsOpen(!destinationsOpen)}
                className="w-full text-left text-2xl sm:text-3xl font-serif font-light tracking-tight text-white hover:text-summit-300 transition-colors flex items-center justify-between group"
              >
                <span>Destinations</span>
                <ChevronDown
                  className={`w-5 h-5 text-white/50 group-hover:text-summit-400 transition-transform duration-300 ${
                    destinationsOpen ? "rotate-180 text-summit-400" : ""
                  }`}
                />
              </button>

              {destinationsOpen && (
                <div className="mt-3 pl-3 space-y-2 border-l border-white/20 ml-1.5 py-1 text-sm text-slate-300">
                  <Link href="/destinations/banff-national-park" className="block py-1.5 hover:text-summit-300">
                    Banff National Park
                  </Link>
                  <Link href="/destinations/lake-louise" className="block py-1.5 hover:text-summit-300">
                    Lake Louise & Moraine Lake
                  </Link>
                  <Link href="/destinations/icefields-parkway" className="block py-1.5 hover:text-summit-300">
                    Icefields Parkway & Athabasca Glacier
                  </Link>
                  <Link href="/destinations/yoho" className="block py-1.5 hover:text-summit-300">
                    Yoho National Park & Emerald Lake
                  </Link>
                  <Link href="/destinations" className="block py-1.5 text-summit-400 font-medium">
                    View All Destinations →
                  </Link>
                </div>
              )}
            </div>

            {/* PLAN YOUR TRIP (Expandable) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPlanningOpen(!planningOpen)}
                className="w-full text-left text-2xl sm:text-3xl font-serif font-light tracking-tight text-white hover:text-summit-300 transition-colors flex items-center justify-between group"
              >
                <span>Plan Your Trip</span>
                <ChevronDown
                  className={`w-5 h-5 text-white/50 group-hover:text-summit-400 transition-transform duration-300 ${
                    planningOpen ? "rotate-180 text-summit-400" : ""
                  }`}
                />
              </button>

              {planningOpen && (
                <div className="mt-3 pl-3 space-y-2.5 border-l border-white/20 ml-1.5 py-1">
                  <Link href="/pickup-finder" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white">
                    <MapPin className="w-4 h-4 text-summit-400" />
                    <span>Hotel Pickup Finder</span>
                  </Link>
                  <Link href="/faq" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white">
                    <HelpCircle className="w-4 h-4 text-summit-400" />
                    <span>FAQ & 24h Cancellation Policy</span>
                  </Link>
                  <Link href="/concierge" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white">
                    <Sparkles className="w-4 h-4 text-summit-400" />
                    <span>AI Mountain Concierge</span>
                  </Link>
                  <Link href="/contact-us" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-white">
                    <Phone className="w-4 h-4 text-summit-400" />
                    <span>Contact & Private Dispatch</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Links: About, Gallery, Reviews, Affiliates */}
          <div className="pt-6 space-y-3">
            <Link
              href="/about-us"
              className="text-lg font-serif font-light text-slate-200 hover:text-summit-300 transition-colors block"
            >
              About Vista Chase
            </Link>
            <Link
              href="/gallery"
              className="text-lg font-serif font-light text-slate-200 hover:text-summit-300 transition-colors block"
            >
              Canadian Rockies Gallery
            </Link>
            <Link
              href="/#reviews"
              className="text-lg font-serif font-light text-slate-200 hover:text-summit-300 transition-colors block"
            >
              Verified Reviews & Awards
            </Link>
            <Link
              href="/affiliates"
              className="text-lg font-serif font-light text-summit-300 hover:text-summit-200 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-summit-400" />
                <span>Affiliates & Travel Trade</span>
              </div>
              <span className="text-[10px] font-sans uppercase tracking-widest text-obsidian-900 bg-summit-500 px-2 py-0.5 rounded-full font-bold">
                Bókun Agent
              </span>
            </Link>
          </div>
        </div>

        {/* Footer Area with Trust & Direct Booking CTA */}
        <div className="p-6 sm:p-8 border-t border-white/10 bg-black/30 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-summit-500 text-summit-500" />
              <span className="font-semibold text-white">5.0 / 5.0</span>
              <span>· TripAdvisor & Google</span>
            </div>
            <a
              href="tel:+18257349456"
              className="hover:text-summit-300 text-slate-300 flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-summit-400" />
              <span>+1 (825) 734-9456</span>
            </a>
          </div>

          <Link
            href="/banff-highlights-tour"
            onClick={onClose}
            className="w-full py-4 rounded-xl golden-summit-btn text-obsidian-900 text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:shadow-summit-500/20"
          >
            <span>Book Experience Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </aside>
    </>
  );
}
