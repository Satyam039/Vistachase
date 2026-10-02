"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Menu, X, ChevronDown, Phone, MapPin, Sparkles, User, Calendar } from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-forest-950/90 backdrop-blur-md border-b border-white/10 text-white">
      {/* Top Banner Notice */}
      <div className="bg-forest-900 border-b border-forest-800 py-1.5 px-4 text-xs font-medium text-slate-300 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Moraine Lake Road is closed to private vehicles — <strong>Guaranteed access via Vista Chase</strong></span>
        </div>
        <div className="hidden sm:flex items-center gap-6">
          <Link href="/pickup-finder" className="hover:text-gold-400 transition-colors flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-gold-400" />
            <span>Pickup Finder</span>
          </Link>
          <a href="tel:+18257349456" className="hover:text-gold-400 transition-colors flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-gold-400" />
            <span>+1 (825) 734-9456</span>
          </a>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-forest-950 shadow-glow font-bold text-xl group-hover:scale-105 transition-transform">
            VC
          </div>
          <div>
            <span className="font-display font-bold text-2xl tracking-wider text-white group-hover:text-gold-300 transition-colors">
              VISTA CHASE
            </span>
            <span className="block text-[10px] tracking-widest text-gold-400 font-semibold uppercase">
              Canadian Rockies • Banff
            </span>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-8">
          <Link href="/" className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
            Home
          </Link>

          {/* Services Dropdown */}
          <div className="relative group" onMouseLeave={() => setServicesOpen(false)}>
            <button
              onClick={() => setServicesOpen(!servicesOpen)}
              onMouseEnter={() => setServicesOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-200 hover:text-white transition-colors py-2"
            >
              <span>Experiences</span>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-gold-400 transition-colors" />
            </button>

            {servicesOpen && (
              <div className="absolute top-full left-0 w-64 rounded-2xl bg-forest-900 border border-forest-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <Link
                  href="/shuttles"
                  onClick={() => setServicesOpen(false)}
                  className="flex flex-col p-3 rounded-xl hover:bg-forest-800/80 transition-colors"
                >
                  <span className="font-semibold text-sm text-gold-300">Shuttles</span>
                  <span className="text-xs text-slate-400">Moraine Lake &amp; Lake Louise guaranteed seats</span>
                </Link>
                <Link
                  href="/shared-tours"
                  onClick={() => setServicesOpen(false)}
                  className="flex flex-col p-3 rounded-xl hover:bg-forest-800/80 transition-colors"
                >
                  <span className="font-semibold text-sm text-white">Shared Tours</span>
                  <span className="text-xs text-slate-400">Award-winning small groups (Max 12)</span>
                </Link>
                <Link
                  href="/private-tours"
                  onClick={() => setServicesOpen(false)}
                  className="flex flex-col p-3 rounded-xl hover:bg-forest-800/80 transition-colors"
                >
                  <span className="font-semibold text-sm text-white">Private SUV Tours</span>
                  <span className="text-xs text-slate-400">Luxury GMC Yukon XL &amp; custom route</span>
                </Link>
                <Link
                  href="/multi-day-tour-package-for-banff"
                  onClick={() => setServicesOpen(false)}
                  className="flex flex-col p-3 rounded-xl hover:bg-forest-800/80 transition-colors"
                >
                  <span className="font-semibold text-sm text-white">Multi-Day Packages</span>
                  <span className="text-xs text-slate-400">Airport transfers + 3-5 days guiding</span>
                </Link>
              </div>
            )}
          </div>

          <Link href="/destinations" className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
            Destinations
          </Link>
          <Link href="/pickup-finder" className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
            Pickup Finder
          </Link>
          <Link href="/gallery" className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
            Gallery
          </Link>
          <Link href="/about-us" className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
            About
          </Link>
          <Link href="/contact-us" className="text-sm font-medium text-slate-200 hover:text-white transition-colors">
            Contact
          </Link>
        </div>

        {/* Right CTA / Action */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/concierge"
            className="p-2.5 rounded-xl text-slate-300 hover:text-gold-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-2 text-xs font-semibold"
            title="Rockies AI Concierge"
          >
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span>AI Concierge</span>
          </Link>
          <Link
            href="/account/trips"
            className="p-2.5 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="My Trips"
          >
            <User className="w-4 h-4" />
          </Link>
          <Link
            href="/banff-highlights-tour"
            className="px-5 py-2.5 rounded-xl font-semibold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-sm flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Tours</span>
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/banff-highlights-tour"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-forest-950 gold-gradient"
          >
            Book Now
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-white" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-forest-900 border-b border-forest-800 px-4 pt-3 pb-6 space-y-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Home
          </Link>
          <Link
            href="/shuttles"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-semibold text-gold-300"
          >
            Lake Louise &amp; Moraine Lake Shuttles
          </Link>
          <Link
            href="/shared-tours"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Shared Small-Group Tours
          </Link>
          <Link
            href="/private-tours"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Private SUV Tours
          </Link>
          <Link
            href="/multi-day-tour-package-for-banff"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Multi-Day Packages
          </Link>
          <Link
            href="/destinations"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Destinations
          </Link>
          <Link
            href="/pickup-finder"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-emerald-400 hover:text-emerald-300"
          >
            Hotel Pickup Finder
          </Link>
          <Link
            href="/concierge"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-gold-400 hover:text-gold-300"
          >
            AI Travel Concierge &amp; Voice Hold
          </Link>
          <Link
            href="/account/trips"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            My Trips &amp; Digital Voucher
          </Link>
          <Link
            href="/about-us"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            About Vista Chase
          </Link>
          <Link
            href="/contact-us"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Contact &amp; Support
          </Link>
        </div>
      )}
    </header>
  );
}
