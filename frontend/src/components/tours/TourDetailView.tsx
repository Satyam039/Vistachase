"use client";

// Tour detail page (cinematic design). Content comes from the catalog imported from the live
// vistachase.com product pages: facts strip, the live tab structure (Overview / Inclusions or
// Selection / Itinerary or Process / Seasonal), FAQs and "Explore more" cross-sells. The booking
// panel follows tour.bookingMode: BOKUN tours book scheduled departures through /book; ENQUIRY
// tours (custom private tours, multi-day) collect a vehicle + party size for a tailored quote.

import { useState, type ComponentType } from "react";
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
  Send,
  Play,
} from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import {
  TourCard,
  departureFits,
  durationLabel,
  fromPrice,
  groupLabel,
  isVehicleTour,
  priceUnitLabel,
  reviewsLabel,
} from "@/components/tours/TourCard";
import type { DepartureAvailability, PageVideo, TourSection, TourWithAvailability } from "@/lib/api/types";

const CATEGORY = {
  SHARED: { label: "Shared Tours", href: "/shared-tours", sub: "Small Group · Max 12 Guests" },
  PRIVATE: { label: "Private Tours", href: "/private-tours", sub: "Private Vehicle · 6 or 13 Guests" },
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

const FACT_ICONS = [Clock, Users, MapPin, Coffee];

/** One heading block of a detail tab, rendered from the imported live-page copy. */
function TourSectionBlock({ section }: { section: TourSection }) {
  const isExcluded = /exclude|not included/i.test(section.heading);
  return (
    <div className="space-y-4">
      {section.heading && <h3 className="text-xl font-serif font-medium text-obsidian-900">{section.heading}</h3>}
      {section.body.map((paragraph) => (
        <p key={paragraph} className="text-slate-700 leading-relaxed text-base whitespace-pre-line">
          {paragraph}
        </p>
      ))}
      {section.items.length > 0 && (
        <ul className="space-y-2 text-sm text-slate-700">
          {section.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              {isExcluded ? (
                <X className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              )}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {section.stops.length > 0 && (
        <div className="space-y-3">
          {section.stops.map((stop) => (
            <div key={stop.name} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-obsidian-900">
                <MapPin className="w-4 h-4 text-ocean-600 shrink-0" />
                <span>{stop.name}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{stop.text}</p>
            </div>
          ))}
        </div>
      )}
      {section.steps.length > 0 && (
        <ol className="relative border-l-2 border-ocean-500/30 ml-2 space-y-5">
          {section.steps.map((step) => (
            <li key={`${step.time}-${step.text}`} className="pl-6 relative">
              <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-ocean-500" />
              <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold block">{step.time || "Then"}</span>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{step.text}</p>
            </li>
          ))}
        </ol>
      )}
      {section.note && <p className="text-xs text-slate-500 italic">Note: {section.note}</p>}
    </div>
  );
}

/** The live product page's tabs (FAQ is rendered separately as an accordion). */
function TourTabs({ tour }: { tour: TourWithAvailability }) {
  const tabs = tour.tabs.filter((t) => t.sections.length > 0);
  const [active, setActive] = useState(0);
  if (tabs.length === 0) return null;
  const tab = tabs[Math.min(active, tabs.length - 1)];

  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="Tour details" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map((t, idx) => (
          <button
            key={t.label}
            role="tab"
            type="button"
            id={`tour-tab-${idx}`}
            aria-selected={idx === active}
            aria-controls="tour-tab-panel"
            onClick={() => setActive(idx)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 -mb-px transition-colors ${
              idx === active ? "border-ocean-500 text-obsidian-900" : "border-transparent text-slate-500 hover:text-obsidian-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="tour-tab-panel" role="tabpanel" aria-labelledby={`tour-tab-${active}`} className="space-y-10">
        {tab.sections.map((section, i) => (
          <TourSectionBlock key={`${section.heading}-${i}`} section={section} />
        ))}
      </div>
    </div>
  );
}

/** Enquiry-only products: choose a vehicle and party size, then request a tailored quote. */
function EnquiryPanel({ tour }: { tour: TourWithAvailability }) {
  const [vehicleId, setVehicleId] = useState(tour.vehicleOptions[0]?.id ?? "");
  const vehicle = tour.vehicleOptions.find((v) => v.id === vehicleId);
  const maxGuests = vehicle?.seats ?? tour.maxGroupSize;
  const [guests, setGuests] = useState(2);
  const partySize = Math.min(guests, maxGuests);
  const params = new URLSearchParams({ tour: tour.slug, guests: String(partySize) });
  if (vehicle) params.set("vehicle", vehicle.id);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-ocean-500/10 border border-ocean-500/30 text-obsidian-900 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-bold">
          <Calendar className="w-4 h-4 text-ocean-600" />
          <span>Built Around Your Dates</span>
        </div>
        <p className="text-slate-700">
          Tell us your dates and must-see stops. We reply with a tailored plan and price, usually within a day.
        </p>
      </div>

      {tour.vehicleOptions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">Vehicle</span>
          <div role="radiogroup" aria-label="Vehicle" className="grid grid-cols-2 gap-2">
            {tour.vehicleOptions.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === vehicleId}
                onClick={() => setVehicleId(v.id)}
                className={`p-3 rounded-xl border text-left text-sm transition-colors ${
                  v.id === vehicleId
                    ? "border-ocean-500 bg-ocean-500/10 text-obsidian-900"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="font-semibold block">{v.label}</span>
                <span className="text-xs text-slate-600">Up to {v.seats} guests</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <PartySizeStepper value={partySize} max={maxGuests} onChange={setGuests} hint={`Up to ${maxGuests} guests`} />

      <div className="space-y-3 pt-2">
        <Link
          href={`/contact-us?${params.toString()}`}
          className="w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-obsidian-900 golden-summit-btn flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <Send className="w-4 h-4" />
          <span>Request This Tour</span>
        </Link>
        <Link
          href="/concierge"
          className="w-full py-3 rounded-xl font-medium text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-ocean-600" />
          <span>Plan with the AI Concierge</span>
        </Link>
      </div>
    </div>
  );
}

function PartySizeStepper({
  value,
  max,
  onChange,
  hint,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
        <span>Guests</span>
        <span className="text-slate-500 font-normal normal-case tracking-normal">{hint}</span>
      </div>
      <div className="flex items-center justify-between p-2 rounded-xl border border-slate-300 bg-slate-50">
        <button
          type="button"
          aria-label="Fewer guests"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          -
        </button>
        <span className="font-bold text-base text-slate-900" aria-live="polite">
          {value} {value === 1 ? "Guest" : "Guests"}
        </span>
        <button
          type="button"
          aria-label="More guests"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function TourDetailView({
  tour,
  related = [],
}: {
  tour: TourWithAvailability;
  /** Cross-sell tours ("Explore more"), in the order the live page lists them. */
  related?: TourWithAvailability[];
}) {
  const categoryKey = tour.category as keyof typeof CATEGORY;
  const categoryInfo = CATEGORY[categoryKey] ?? CATEGORY.SHARED;
  const isPrivate = tour.category === "PRIVATE" || tour.category === "MULTIDAY";
  const isEnquiry = tour.bookingMode === "ENQUIRY";
  const price = fromPrice(tour);
  const unitLabel = priceUnitLabel(tour);

  const images = Array.from(new Set([tour.featuredImage, ...tour.galleryImages].filter(Boolean)));
  // Gallery slides: the tour's clips first (backend/media/videos), then its photos.
  const slides: ({ kind: "video"; video: PageVideo } | { kind: "image"; src: string })[] = [
    ...tour.videos.map((video) => ({ kind: "video" as const, video })),
    ...images.map((src) => ({ kind: "image" as const, src })),
  ];
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  // Booking state (Connected to Bókun System of Record)
  const isVehicle = isVehicleTour(tour);
  const bookableDepartures = tour.departures.filter((d) => departureFits(tour, d, 1));
  const [selectedDepartureId, setSelectedDepartureId] = useState(bookableDepartures[0]?.id ?? "");
  const currentDeparture = tour.departures.find((d) => d.id === selectedDepartureId);
  const maxAvailableSeats = isVehicle ? currentDeparture?.capacityTotal : currentDeparture?.seatsAvailable;
  const maxPartySize = Math.max(1, Math.min(maxAvailableSeats ?? tour.maxGroupSize, tour.maxGroupSize));
  const [guests, setPartySize] = useState(2);
  const partySize = Math.min(guests, maxPartySize);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const faqs = tour.faqs.map((faq) => ({ q: faq.question, a: faq.answer }));

  // Schema.org structured data for SEO: the trip, plus its FAQ page
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: tour.title,
      description: tour.metaDescription ?? tour.summary,
      touristType: isPrivate ? "Private Group" : "Small Group",
      image: images,
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: tour.currency,
        availability: "https://schema.org/InStock",
        ...(tour.priceUnit === "GROUP" && {
          priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: tour.currency, unitText: "group" },
        }),
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
    },
    ...(tour.faqs.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: tour.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          },
        ]
      : []),
  ];

  const calculatedTotal = currentDeparture
    ? isVehicle
      ? currentDeparture.price
      : currentDeparture.price * partySize
    : price * partySize;

  // Facts strip: the live page's four facts, or generic ones when a tour has none.
  const facts: { label: string; value: string; icon: ComponentType<{ className?: string }> }[] =
    tour.facts.length > 0
      ? tour.facts.slice(0, 4).map((f, i) => ({ label: f.label, value: f.value, icon: FACT_ICONS[i % FACT_ICONS.length] }))
      : [
          { label: "Duration", value: durationLabel(tour), icon: Clock },
          { label: "Party Capacity", value: groupLabel(tour), icon: Users },
          { label: "Hotel Pickup", value: "Banff & Canmore Included", icon: MapPin },
          { label: "Amenities", value: "Hot Drinks & Park Access", icon: Coffee },
        ];

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 01. EDITORIAL HEADER & BREADCRUMBS */}
      <section className="bg-ocean-900 text-white pt-24 pb-12 px-4 sm:px-6 lg:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Breadcrumb nav */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-widest text-slate-300">
            <Link href="/" className="inline-flex min-h-6 items-center hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <Link href={categoryInfo.href} className="inline-flex min-h-6 items-center hover:text-white transition-colors">
              {categoryInfo.label}
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <span aria-current="page" className="text-summit-300 truncate max-w-[200px] sm:max-w-none">{tour.title}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
                  <MapPin className="w-3.5 h-3.5 text-summit-500" />
                  {tour.destination.name}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ocean-500/20 text-ocean-300 text-xs font-semibold border border-ocean-500/30">
                  {categoryInfo.sub}
                </span>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-xs text-slate-300 border border-white/10">
                  <Star className="w-3.5 h-3.5 fill-summit-500 text-summit-500" />
                  <span className="font-bold text-white">{tour.rating.toFixed(1)}</span>
                  <span className="text-slate-400">({reviewsLabel(tour)})</span>
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
                {tour.priceUnit === "GROUP" ? "Per Group From" : "Per Guest From"}
              </span>
              <div className="flex items-baseline lg:justify-end gap-1.5">
                <span className="text-3xl sm:text-4xl font-light text-white font-serif">{money(price)}</span>
                <span className="text-xs font-semibold text-summit-300 tracking-wider">{tour.currency} + GST</span>
              </div>
              <span className="text-[11px] text-emerald-400 block mt-1 flex items-center lg:justify-end gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Free cancellation up to 24 hours before
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 02. KEY FACTS STRIP */}
      <section className="bg-obsidian-900 text-white border-b border-white/10 py-5 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-summit-300">
                <fact.icon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-widest text-slate-400 block">{fact.label}</span>
                <span className="font-medium text-white">{fact.value}</span>
              </div>
            </div>
          ))}
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
                {(() => {
                  const slide = slides[selectedPhoto] ?? slides[0];
                  if (slide?.kind === "video") {
                    return (
                      <>
                        {/* Poster as the optimized main image, the clip plays over it */}
                        <Image
                          src={slide.video.poster}
                          alt={slide.video.alt}
                          fill
                          priority
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 700px"
                        />
                        <AmbientVideo
                          key={slide.video.id}
                          src={slide.video.src}
                          srcHd={slide.video.srcHd}
                          poster={slide.video.poster}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </>
                    );
                  }
                  return (
                    <Image
                      src={slide?.src || tour.featuredImage}
                      alt={tour.title}
                      fill
                      priority
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      sizes="(max-width: 1024px) 100vw, 700px"
                    />
                  );
                })()}
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium">
                  {selectedPhoto + 1} of {slides.length} · Vista Chase Certified Experience
                </div>
              </div>

              {slides.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {slides.map((slide, idx) => (
                    <button
                      key={slide.kind === "video" ? slide.video.id : slide.src}
                      type="button"
                      aria-label={
                        slide.kind === "video"
                          ? `Play video: ${slide.video.title}`
                          : `Show photo ${idx + 1} of ${slides.length}`
                      }
                      aria-pressed={selectedPhoto === idx}
                      onClick={() => setSelectedPhoto(idx)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                        selectedPhoto === idx ? "border-summit-500 scale-[0.98] ring-2 ring-summit-500/40" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={slide.kind === "video" ? slide.video.poster : slide.src}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="150px"
                      />
                      {slide.kind === "video" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25" aria-hidden="true">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-obsidian-900">
                            <Play className="h-4 w-4 translate-x-px" />
                          </span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Experience Narrative */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">The Experience</span>
                <h2 className="text-3xl sm:text-4xl font-light font-serif text-obsidian-900">
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
                <h3 className="text-xl font-serif font-medium text-obsidian-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-summit-500" />
                  <span>Curated Tour Highlights</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tour.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-ocean-500/15 text-ocean-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 leading-snug">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle & Mountain Comfort Showcase */}
            <div className="p-8 rounded-3xl bg-ocean-900 text-white space-y-6 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-summit-300">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-ocean-300 font-bold block">
                    Luxury Mountain Fleet
                  </span>
                  <h3 className="text-xl font-serif font-light text-white">
                    {tour.vehicleOptions.length > 0
                      ? tour.vehicleOptions.map((v) => `${v.label} (${v.seats} seats)`).join(" or ")
                      : isPrivate
                        ? "GMC Yukon XL / Chevrolet Suburban"
                        : "High-Roof Mercedes-Benz Sprinter"}
                  </h3>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Travel in supreme comfort with panoramic alpine windows, heated leather captain chairs, dual-zone climate
                control, onboard USB charging stations, and complimentary chilled mountain spring water.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-summit-500" /> Leather Seating
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-summit-500" /> Panoramic Glass
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-summit-500" /> Climate Control
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-summit-500" /> Onboard Wi-Fi
                </div>
              </div>
            </div>

            {/* Live product page tabs: Overview / Inclusions / Itinerary / Seasonal */}
            {tour.tabs.length > 0 ? (
              <TourTabs tour={tour} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                  <h4 className="text-base font-serif font-medium text-obsidian-900 flex items-center gap-2">
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
                  <h4 className="text-base font-serif font-medium text-obsidian-900 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-ocean-600" /> What to Bring
                  </h4>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {tour.whatToBring.length > 0 ? (
                      tour.whatToBring.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-ocean-600 mt-1">•</span>
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
            )}

            {/* Guest Reviews */}
            <div className="space-y-6 pt-4">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">Verified Travelers</span>
                <h3 className="text-2xl font-serif font-light text-obsidian-900">What Guests Are Saying</h3>
              </div>
              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-1 text-summit-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-summit-500" />
                  ))}
                </div>
                <blockquote className="text-base sm:text-lg italic text-slate-700 font-serif leading-relaxed">
                  &ldquo;Skipping the stress of Moraine Lake parking made our entire vacation. Our guide was warm,
                  knowledgeable, and got us the most incredible photos before the crowds arrived.&rdquo;
                </blockquote>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-obsidian-900">Emily &amp; Jason R.</span>
                  <span>TripAdvisor Verified Guest · Summer 2025</span>
                </div>
              </div>
            </div>

            {/* FAQ Accordion (from the live product page) */}
            {faqs.length > 0 && (
            <div className="space-y-6 pt-4">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">Answers</span>
                <h3 className="text-2xl font-serif font-light text-obsidian-900">Frequently Asked Questions</h3>
              </div>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-medium text-slate-900 text-sm hover:text-ocean-600 transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                          openFaq === idx ? "rotate-180 text-ocean-600" : "text-slate-400"
                        }`}
                      />
                    </button>
                    {openFaq === idx && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 whitespace-pre-line">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* RIGHT 5 COLUMNS: STICKY BÓKUN BOOKING PANEL */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold block">
                  {isEnquiry ? "Request a Tailored Quote" : "Reserve Departure"}
                </span>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-light font-serif text-obsidian-900">{money(price)}</span>
                    <span className="text-xs text-slate-500 ml-1.5">{unitLabel} CAD</span>
                  </div>
                  {!isEnquiry && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      Instant Bókun Sync
                    </span>
                  )}
                </div>
              </div>

              {/* Enquiry products / departure selector */}
              {isEnquiry ? (
                <EnquiryPanel tour={tour} />
              ) : tour.departures.length === 0 ? (
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
                    <label htmlFor="tour-departure" className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                      Choose Departure Date
                    </label>
                    <select
                      id="tour-departure"
                      value={selectedDepartureId}
                      onChange={(e) => setSelectedDepartureId(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    >
                      {tour.departures.map((d) => (
                        <option key={d.id} value={d.id} disabled={!departureFits(tour, d, 1)}>
                          {formatDeparture(d)} — {isVehicle ? `$${d.price} / vehicle` : `${d.seatsAvailable} seats left · $${d.price} CAD`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Guests / Party Size */}
                  <PartySizeStepper
                    value={partySize}
                    max={maxPartySize}
                    onChange={setPartySize}
                    hint={isVehicle ? `Vehicle seats up to ${maxPartySize}` : `Max ${maxPartySize} on this departure`}
                  />

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
                      <span className="text-base text-obsidian-900 font-serif">{money(calculatedTotal)} CAD</span>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-3 pt-2">
                    <Link
                      href={`/book?departureId=${encodeURIComponent(selectedDepartureId || tour.departures[0]?.id || "")}&guests=${partySize}`}
                      className="w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-obsidian-900 golden-summit-btn flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <span>Book Your Experience</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>

                    <Link
                      href="/concierge"
                      className="w-full py-3 rounded-xl font-medium text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-ocean-600" />
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
                  <span>Free cancellation up to 24 hours before your tour</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-ocean-600 shrink-0" />
                  <span>Bókun Booking of Record · WhatsApp Live Tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04. EXPLORE MORE (cross-sells from the live page) */}
      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pb-20 space-y-8">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">Keep Exploring</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-light text-obsidian-900">Explore More</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((t) => (
              <TourCard key={t.id} tour={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
