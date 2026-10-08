"use client";

// Tour detail page (cinematic design). Content comes from the catalog imported from the live
// vistachase.com product pages: facts strip, the live tab structure (Overview / Inclusions or
// Selection / Itinerary or Process / Seasonal), FAQs and "Explore more" cross-sells. The booking
// panel follows tour.bookingMode: BOKUN tours book scheduled departures through /book; ENQUIRY
// tours (custom private tours, multi-day) collect a vehicle + party size for a tailored quote.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
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
  ChevronRight,
  ChevronDown,
  Coffee,
  CheckCircle2,
  Send,
} from "lucide-react";
import { Dropdown } from "@/components/forms/Dropdown";
import { PriceTag } from "@/components/pricing/PriceTag";
import { cancellationShort } from "@/lib/policy";
import { Rail } from "@/components/motion/Rail";
import { ProductGallery, type GallerySlide } from "@/components/tours/ProductGallery";
import { TourSectionNav, TourSections } from "@/components/tours/TourSections";
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
import type { DepartureAvailability, TourSection, TourWithAvailability } from "@/lib/api/types";

const CATEGORY = {
  SHARED: { label: "Shared tours", href: "/shared-tours", sub: "Small group · max 12 guests" },
  PRIVATE: { label: "Private tours", href: "/private-tours", sub: "Private vehicle · up to 6 or 13 guests" },
  MULTIDAY: { label: "Multi-day trips", href: "/search?category=MULTIDAY", sub: "2 to 7 days" },
  SHUTTLE: { label: "Lake shuttles", href: "/shuttles", sub: "Guaranteed lake access · hotel pickup" },
  TICKET: { label: "Activity tickets", href: "/banff-activity-tickets", sub: "Timed around your tour" },
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

/**
 * Fixed bottom bar on phones. It publishes its height as --vc-bottom-bar-h so floating buttons
 * (the AI voice assistant) sit above it instead of covering the booking button.
 */
function MobileBookingBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    // globals.css adds it to the page's bottom scroll padding (focused elements stay clear of it).
    const update = () => root.style.setProperty("--vc-bottom-bar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--vc-bottom-bar-h");
    };
  }, []);
  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
      {children}
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
  // Gallery slides (GetYourGuide / Viator): the product's own lead photo first, then the clips of
  // places it visits (matched by place, so not always the product itself), then the other photos.
  const [lead, ...rest] = images;
  const slides: GallerySlide[] = [
    ...(lead ? [{ kind: "image" as const, src: lead }] : []),
    ...tour.videos.map((video) => ({ kind: "video" as const, video })),
    ...rest.map((src) => ({ kind: "image" as const, src })),
  ];

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

  // "More below" hint for the booking panel when it scrolls inside itself (short screens).
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelMore, setPanelMore] = useState(false);
  const updatePanelHint = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    setPanelMore(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
  }, []);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    updatePanelHint();
    const ro = new ResizeObserver(updatePanelHint);
    ro.observe(el);
    window.addEventListener("resize", updatePanelHint);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updatePanelHint);
    };
  }, [updatePanelHint]);

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

      {/* 01. HEADER: breadcrumb, title, rating and badges, then the mosaic gallery
          (GetYourGuide / Viator product page order). */}
      <section className="mx-auto max-w-7xl px-page pb-8 pt-8 sm:pt-10">
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
            <li>
              <Link href="/" className="hover:text-obsidian-900 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li>
              <Link href={categoryInfo.href} className="hover:text-obsidian-900 hover:underline">
                {categoryInfo.label}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="max-w-[16rem] truncate text-obsidian-900 sm:max-w-none">
              {tour.title}
            </li>
          </ol>
        </nav>

        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl motion-safe:animate-[fadeUp_800ms_ease-out]">
              {tour.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-slate-600">
              {tour.reviewCount > 0 ? (
                <a href="#reviews" className="inline-flex items-center gap-1.5 text-obsidian-900 hover:underline">
                  <Star className="h-4 w-4 fill-summit-500 text-summit-500" aria-hidden="true" />
                  {tour.rating.toFixed(1)}
                  <span className="sr-only">out of 5,</span>
                  <span className="text-slate-600">({reviewsLabel(tour)})</span>
                </a>
              ) : (
                <span>New on Vista Chase</span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                {tour.destination.name}
              </span>
              <span>{categoryInfo.sub}</span>
            </div>
          </div>
          <a
            href="#cancellation-policy"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-emerald-50 px-4 py-2 text-base text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100 lg:self-auto"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            {cancellationShort(tour.category)}
          </a>
        </div>

        <ProductGallery slides={slides} title={tour.title} />
      </section>

      {/* 02. MAIN CONTENT + STICKY BOOKING PANEL */}
      <section className="mx-auto max-w-7xl px-page pb-16 pt-4">
        <TourSectionNav />
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
          <div className="space-y-12 lg:col-span-7">
            {/* Key facts as icon rows (Civitatis / Expedia "Features") */}
            <ul aria-label="Key facts" className="grid grid-cols-1 gap-x-8 gap-y-5 rounded-[1.75rem] bg-white p-6 ring-1 ring-obsidian-900/[0.07] sm:grid-cols-2 sm:p-8" data-stagger>
              {facts.map((fact) => (
                <li key={fact.label} className="flex items-start gap-3.5">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                    <fact.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm text-slate-600">
                      {fact.label}
                      <span className="sr-only">:</span>
                    </span>
                    <span className="block text-base text-obsidian-900">{fact.value}</span>
                  </span>
                </li>
              ))}
              {[
                "Mobile voucher",
                tour.bookingMode === "BOKUN" && tour.departures.length > 0 ? "Instant confirmation" : null,
                tour.category !== "TICKET" ? "Hotel pickup in Banff & Canmore" : null,
              ]
                .filter((x): x is string => Boolean(x))
                .map((chip) => (
                  <li key={chip} className="flex items-start gap-3.5">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <Check className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="pt-2.5 text-base text-obsidian-900">{chip}</span>
                  </li>
                ))}
            </ul>

            {/* Viator-style sections with a sticky "On this page" bar */}
            <TourSections tour={tour} />
          </div>

          {/* RIGHT 5 COLUMNS: STICKY BÓKUN BOOKING PANEL */}
          <div id="booking" className="relative lg:col-span-5 lg:sticky lg:top-[calc(var(--vc-header-h,96px)+6.25rem)] scroll-mt-40">
            {/* On short screens the sticky panel can be taller than the viewport: it is capped at
                the space left below the header and scrolls inside, with a "more below" hint. */}
            <div
              ref={panelRef}
              onScroll={updatePanelHint}
              className="rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07] shadow-[0_30px_60px_-35px_rgba(12,31,33,0.4)] p-6 sm:p-8 space-y-6 lg:max-h-[calc(100vh-var(--vc-header-h,96px)-11.75rem)] lg:overflow-y-auto lg:overscroll-contain lg:scroll-pb-24 [scrollbar-width:thin]"
            >
              <div className="space-y-3 border-b border-slate-100 pb-5">
                <PriceTag
                  price={price}
                  currency={`${tour.currency} + GST`}
                  unit={tour.category === "TICKET" ? "per ticket" : unitLabel}
                  lead={isEnquiry ? "Tailored quote from" : "From"}
                />
              </div>

              {/* Enquiry products / departure selector */}
              {isEnquiry ? (
                <EnquiryPanel tour={tour} />
              ) : tour.departures.length === 0 ? (
                // No scheduled dates yet: still a clear primary action (request a date).
                <div className="space-y-4">
                  <PartySizeStepper
                    value={partySize}
                    max={tour.maxGroupSize}
                    onChange={setPartySize}
                    hint={isVehicle ? `Vehicle seats up to ${tour.maxGroupSize}` : `Up to ${tour.maxGroupSize} guests`}
                  />
                  <Link
                    href={`/contact-us?${new URLSearchParams({ tour: tour.slug, guests: String(partySize) }).toString()}`}
                    className="golden-summit-btn flex h-14 w-full items-center justify-center gap-2 rounded-full text-base text-obsidian-900"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Request your date
                  </Link>
                  <Link
                    href="/concierge"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-base text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Sparkles className="h-4 w-4 text-ocean-600" aria-hidden="true" />
                    Ask the AI concierge
                  </Link>
                  <p className="flex items-start gap-2.5 rounded-2xl bg-ocean-50 p-4 text-sm leading-relaxed text-obsidian-800">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />
                    <span>
                      <span className="block text-base text-obsidian-900">Dates on request</span>
                      This season&rsquo;s dates are being scheduled. Tell us your day and party size and we&rsquo;ll
                      confirm availability, usually within a day.
                    </span>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Dropdown
                    id="tour-departure"
                    label="Departure date"
                    labelClassName="mb-2 block text-sm text-slate-700"
                    value={selectedDepartureId}
                    onChange={setSelectedDepartureId}
                    options={tour.departures.map((d) => ({
                      value: d.id,
                      label: formatDeparture(d),
                      description: departureFits(tour, d, 1)
                        ? isVehicle
                          ? `$${d.price} per vehicle`
                          : `${d.seatsAvailable} seats left · $${d.price} CAD`
                        : "Sold out",
                      disabled: !departureFits(tour, d, 1),
                    }))}
                  />

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
                      className="w-full h-13 py-4 rounded-full text-base text-obsidian-900 golden-summit-btn flex items-center justify-center gap-2 transition-all"
                    >
                      <span>Book now</span>
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
              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span>{cancellationShort(tour.category)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-ocean-600 shrink-0" aria-hidden="true" />
                  <span>Secure checkout · mobile voucher by email</span>
                </div>
              </div>
            </div>
            {panelMore && (
              <button
                type="button"
                onClick={() => panelRef.current?.scrollBy({ top: 240, behavior: "smooth" })}
                className="absolute inset-x-px bottom-px hidden h-20 items-end justify-center rounded-b-[1.75rem] bg-gradient-to-t from-white via-white/90 to-transparent pb-3 text-sm text-obsidian-900 lg:flex"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian-900 px-4 py-1.5 text-white shadow-lg">
                  More below
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 03. YOU MIGHT ALSO LIKE (cross-sells from the live page) */}
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="overflow-hidden bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-page">
            <h2 id="related-heading" className="mb-8 text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl" data-reveal>
              You might also like
            </h2>
            <Rail label="You might also like">
              {related.map((t) => (
                <TourCard key={t.id} tour={t} />
              ))}
            </Rail>
          </div>
        </section>
      )}
      {/* Phones: price and booking always one tap away (GetYourGuide / Viator pattern) */}
      <MobileBookingBar>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <PriceTag price={price} currency={tour.currency} unit={tour.category === "TICKET" ? "per ticket" : unitLabel} layout="inline" />
          <a href="#booking" className="golden-summit-btn inline-flex h-12 shrink-0 items-center rounded-full px-6 text-base">
            {isEnquiry || tour.departures.length === 0 ? "Request a date" : "Check availability"}
          </a>
        </div>
      </MobileBookingBar>
    </div>
  );
}
