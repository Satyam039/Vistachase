"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
  ChevronRight,
  Coffee,
  Car,
  ChevronDown,
  Info,
  CheckCircle2,
  Compass,
} from "lucide-react";
import { fromPrice, isVehicleTour, departureFits } from "@/components/tours/TourCard";
import type { DepartureAvailability, TourWithAvailability } from "@/lib/api/types";

const CATEGORY = {
  SHARED: { label: "Shared Tours", href: "/shared-tours", sub: "Small Group · Max 12 Guests" },
  PRIVATE: { label: "Private Tours", href: "/private-tours", sub: "Dedicated SUV · Up to 6 Guests" },
  MULTIDAY: { label: "Multi-Day Packages", href: "/search?category=MULTIDAY", sub: "Complete Rockies Itineraries" },
  SHUTTLE: { label: "Commercial Shuttles", href: "/shuttles", sub: "Guaranteed Access · Door-to-Door" },
} as const;

const money = (amount: number) =>
  `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function formatDeparture(departure: DepartureAvailability) {
  const parsed = new Date(`${departure.date}T00:00:00`);
  const day = Number.isNaN(parsed.getTime())
    ? departure.date
    : parsed.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${departure.departureTime}`;
}

export function TourDetailView({ tour }: { tour: TourWithAvailability }) {
  const categoryKey = tour.category as keyof typeof CATEGORY;
  const categoryInfo = CATEGORY[categoryKey] ?? CATEGORY.SHARED;
  const isPrivate = tour.category === "PRIVATE";
  const price = fromPrice(tour);

  const images = Array.from(new Set([tour.featuredImage, ...tour.galleryImages].filter(Boolean)));
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  // Booking state (Connected to Bókun System of Record)
  const isVehicle = isVehicleTour(tour);
  const bookableDepartures = tour.departures.filter((d) => departureFits(tour, d, 1));
  const [selectedDepartureId, setSelectedDepartureId] = useState(bookableDepartures[0]?.id ?? "");
  const currentDeparture = tour.departures.find((d) => d.id === selectedDepartureId);
  const maxAvailableSeats = isVehicle ? currentDeparture?.capacityTotal : currentDeparture?.seatsAvailable;
  const maxPartySize = Math.max(1, Math.min(maxAvailableSeats ?? tour.maxGroupSize, tour.maxGroupSize));
  const [partySize, setPartySize] = useState(Math.min(2, maxPartySize));

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Schema.org structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.summary,
    touristType: isPrivate ? "Private Group" : "Small Group",
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: tour.currency,
      availability: "https://schema.org/InStock",
    },
    provider: {
      "@type": "TouristInformationCenter",
      name: "Vista Chase",
      url: "https://www.vistachase.com",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: tour.rating.toString(),
      reviewCount: tour.reviewCount.toString(),
    },
  };

  const calculatedTotal = currentDeparture
    ? isVehicle
      ? currentDeparture.price
      : currentDeparture.price * partySize
    : price * partySize;

  const faqs = [
    {
      q: "How does Vista Chase guarantee access to Moraine Lake?",
      a: "Since Parks Canada restricted private vehicles on Moraine Lake Road, only certified commercial operators have authorized road access. Vista Chase holds commercial operating permits, guaranteeing your entry without waking up at 3:00 AM or relying on sold-out public transit.",
    },
    {
      q: "Where does pickup and drop-off take place?",
      a: "We offer complimentary door-to-door hotel and lodge pickups throughout Banff and Canmore, as well as select Lake Louise properties. If you are staying at an Airbnb or private rental, we arrange the closest convenient meeting point.",
    },
    {
      q: "What is your cancellation and weather policy?",
      a: "You may cancel or reschedule free of charge up to 48 hours prior to your scheduled departure time for a 100% full refund. In the rare event of extreme mountain road closures, you will be offered an alternative itinerary or full refund.",
    },
    {
      q: "Do I need a Parks Canada Discovery Pass?",
      a: "All visitors to Banff National Park require a Parks Canada National Park Pass. Passes can be purchased online through Parks Canada or at park entrance gates before departure.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1C1F23]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 01. EDITORIAL HEADER & BREADCRUMBS */}
      <section className="bg-[#0C1F21] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Breadcrumb nav */}
          <nav className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <Link href={categoryInfo.href} className="hover:text-white transition-colors">
              {categoryInfo.label}
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-[#FFE085] truncate max-w-[200px] sm:max-w-none">{tour.title}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[#FFE085] text-xs font-semibold uppercase tracking-wider border border-white/15">
                  <MapPin className="w-3.5 h-3.5 text-[#F5BF03]" />
                  {tour.destination.name}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3A9CA6]/20 text-[#3A9CA6] text-xs font-semibold border border-[#3A9CA6]/30">
                  {categoryInfo.sub}
                </span>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-xs text-slate-300 border border-white/10">
                  <Star className="w-3.5 h-3.5 fill-[#F5BF03] text-[#F5BF03]" />
                  <span className="font-bold text-white">{tour.rating.toFixed(1)}</span>
                  <span className="text-slate-400">({tour.reviewCount} reviews)</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-light tracking-tight text-white font-serif leading-[1.1]">
                {tour.title}
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl">
                {tour.summary}
              </p>
            </div>

            {/* Price Pill */}
            <div className="lg:text-right shrink-0 p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
              <span className="text-xs uppercase tracking-widest text-slate-400 block mb-1">
                {isPrivate ? "Private Vehicle From" : "Per Guest From"}
              </span>
              <div className="flex items-baseline lg:justify-end gap-1.5">
                <span className="text-3xl sm:text-4xl font-light text-white font-serif">{money(price)}</span>
                <span className="text-xs font-semibold text-[#FFE085] tracking-wider">{tour.currency} + GST</span>
              </div>
              <span className="text-[11px] text-emerald-400 block mt-1 flex items-center lg:justify-end gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Free 48-Hour Cancellation
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 02. KEY FACTS STRIP */}
      <section className="bg-[#1C1F23] text-white border-b border-white/10 py-5 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#FFE085]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 block">Duration</span>
              <span className="font-medium text-white">{tour.durationHours} Hours (Full Day)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#FFE085]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 block">Party Capacity</span>
              <span className="font-medium text-white">
                {isPrivate ? `Up to ${tour.maxGroupSize} Guests` : `Max ${tour.maxGroupSize} Guests (Intimate)`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#FFE085]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 block">Hotel Pickup</span>
              <span className="font-medium text-white">Banff &amp; Canmore Included</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#FFE085]">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-slate-400 block">Amenities</span>
              <span className="font-medium text-white">Hot Drinks &amp; Park Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* 03. MAIN EDITORIAL CONTENT + STICKY BÓKUN BOOKING PANEL */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* LEFT 7 COLUMNS: EDITORIAL STORY */}
          <div className="lg:col-span-7 space-y-16">
            {/* Visual Photo Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-[16/10] w-full rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-black/5">
                <Image
                  src={images[selectedPhoto] || tour.featuredImage}
                  alt={tour.title}
                  fill
                  priority
                  className="object-cover transition-transform duration-700 hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 700px"
                />
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium">
                  {selectedPhoto + 1} of {images.length} · Vista Chase Certified Experience
                </div>
              </div>

              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhoto(idx)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                        selectedPhoto === idx ? "border-[#F5BF03] scale-[0.98] ring-2 ring-[#F5BF03]/40" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Image src={img} alt="" fill className="object-cover" sizes="150px" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Experience Narrative */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-[#3A9CA6] font-bold">The Experience</span>
                <h2 className="text-3xl sm:text-4xl font-light font-serif text-[#1C1F23]">
                  {isPrivate ? "Your Day, Handcrafted to Your Mountain Rhythm" : "Small Groups, Greater Mountain Discoveries"}
                </h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-base sm:text-lg">
                <p>{tour.description}</p>
              </div>
            </div>

            {/* Destination Highlights */}
            {tour.highlights.length > 0 && (
              <div className="space-y-6 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
                <h3 className="text-xl font-serif font-medium text-[#1C1F23] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#F5BF03]" />
                  <span>Curated Tour Highlights</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tour.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#3A9CA6]/15 text-[#3A9CA6] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 leading-snug">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle & Mountain Comfort Showcase */}
            <div className="p-8 rounded-3xl bg-[#0C1F21] text-white space-y-6 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#FFE085]">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#3A9CA6] font-bold block">
                    Luxury Mountain Fleet
                  </span>
                  <h3 className="text-xl font-serif font-light text-white">
                    {isPrivate ? "GMC Yukon XL / Chevrolet Suburban" : "High-Roof Mercedes-Benz Sprinter"}
                  </h3>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Travel in supreme comfort with panoramic alpine windows, heated leather captain chairs, dual-zone climate
                control, onboard USB charging stations, and complimentary chilled mountain spring water.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#F5BF03]" /> Leather Seating
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#F5BF03]" /> Panoramic Glass
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#F5BF03]" /> Climate Control
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#F5BF03]" /> Onboard Wi-Fi
                </div>
              </div>
            </div>

            {/* Inclusions & What to Bring */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                <h4 className="text-base font-serif font-medium text-[#1C1F23] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> What&apos;s Included
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                  {tour.inclusions.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                <h4 className="text-base font-serif font-medium text-[#1C1F23] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#3A9CA6]" /> What to Bring
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                  {tour.whatToBring.length > 0 ? (
                    tour.whatToBring.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#3A9CA6] mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">• Comfortable layered walking clothing</li>
                      <li className="flex items-start gap-2">• Sturdy footwear or hiking shoes</li>
                      <li className="flex items-start gap-2">• Camera or smartphone for alpine photos</li>
                      <li className="flex items-start gap-2">• Parks Canada Discovery Pass (if owned)</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            {/* Guest Reviews */}
            <div className="space-y-6 pt-4">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-widest text-[#3A9CA6] font-bold">Verified Travelers</span>
                <h3 className="text-2xl font-serif font-light text-[#1C1F23]">What Guests Are Saying</h3>
              </div>
              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-1 text-[#F5BF03]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#F5BF03]" />
                  ))}
                </div>
                <blockquote className="text-base sm:text-lg italic text-slate-700 font-serif leading-relaxed">
                  &ldquo;Skipping the stress of Moraine Lake parking made our entire vacation. Our guide was warm,
                  knowledgeable, and got us the most incredible photos before the crowds arrived.&rdquo;
                </blockquote>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-[#1C1F23]">Emily &amp; Jason R.</span>
                  <span>TripAdvisor Verified Guest · Summer 2025</span>
                </div>
              </div>
            </div>

            {/* FAQ Accordion */}
            <div className="space-y-6 pt-4">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-widest text-[#3A9CA6] font-bold">Answers</span>
                <h3 className="text-2xl font-serif font-light text-[#1C1F23]">Frequently Asked Questions</h3>
              </div>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-medium text-slate-900 text-sm hover:text-[#3A9CA6] transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                          openFaq === idx ? "rotate-180 text-[#3A9CA6]" : "text-slate-400"
                        }`}
                      />
                    </button>
                    {openFaq === idx && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: STICKY BÓKUN BOOKING PANEL */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <span className="text-xs uppercase tracking-widest text-[#3A9CA6] font-bold block">
                  Reserve Departure
                </span>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-light font-serif text-[#1C1F23]">{money(price)}</span>
                    <span className="text-xs text-slate-500 ml-1.5">{isPrivate ? "per vehicle" : "per guest"} CAD</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    Instant Bókun Sync
                  </span>
                </div>
              </div>

              {/* Departure Selector */}
              {tour.departures.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <Calendar className="w-4 h-4 text-amber-700" />
                    <span>Dates on Request</span>
                  </div>
                  <p>
                    Upcoming seasonal dates are being scheduled. Our mountain concierge can arrange a custom date or
                    private vehicle for your party.
                  </p>
                  <Link
                    href="/concierge"
                    className="inline-flex items-center gap-1.5 font-bold text-amber-800 hover:text-amber-950 mt-1"
                  >
                    <span>Talk with AI Concierge</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      Choose Departure Date
                    </label>
                    <select
                      value={selectedDepartureId}
                      onChange={(e) => setSelectedDepartureId(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#3A9CA6]"
                    >
                      {tour.departures.map((d) => (
                        <option key={d.id} value={d.id} disabled={!departureFits(tour, d, 1)}>
                          {formatDeparture(d)} — {isVehicle ? `$${d.price} / vehicle` : `${d.seatsAvailable} seats left · $${d.price} CAD`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Guests / Party Size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
                      <label>Guests</label>
                      <span className="text-slate-400 font-normal">
                        {isVehicle ? `Vehicle seats up to ${maxPartySize}` : `Max ${maxPartySize} on this departure`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl border border-slate-300 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.max(1, partySize - 1))}
                        disabled={partySize <= 1}
                        className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="font-bold text-base text-slate-900">
                        {partySize} {partySize === 1 ? "Guest" : "Guests"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.min(maxPartySize, partySize + 1))}
                        disabled={partySize >= maxPartySize}
                        className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Price Calculation Breakdown */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>
                        {isVehicle ? "Private vehicle flat rate" : `${partySize} × ${money(currentDeparture?.price ?? price)} CAD`}
                      </span>
                      <span>{money(calculatedTotal)} CAD</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>GST (5%)</span>
                      <span>Calculated at checkout</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900 text-sm">
                      <span>Total Estimated</span>
                      <span className="text-base text-[#1C1F23] font-serif">{money(calculatedTotal)} CAD</span>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-3 pt-2">
                    <Link
                      href={`/book?departureId=${encodeURIComponent(selectedDepartureId || tour.departures[0]?.id || "")}&guests=${partySize}`}
                      className="w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-[#1C1F23] golden-summit-btn flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <span>Book Your Experience</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/concierge"
                      className="w-full py-3 rounded-xl font-medium text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-[#3A9CA6]" />
                      <span>Custom Inquiries &amp; Concierge</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Trust & Guarantee points */}
              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Official Parks Canada Commercial Access Partner</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Free 48-Hour Full Refund Guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#3A9CA6] shrink-0" />
                  <span>Bókun Booking of Record · WhatsApp Live Tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
