import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  Users,
  MapPin,
  Star,
  CheckCircle2,
  XCircle,
  Calendar,
  ShieldCheck,
  Award,
  ChevronRight,
  Info,
} from "lucide-react";
import { TourWithAvailability } from "@/modules/tours/tour.repository";

export function TourDetailView({ tour }: { tour: TourWithAvailability }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": tour.title,
    "description": tour.summary,
    "touristType": tour.category === "PRIVATE" ? "Private Group" : "Small Group",
    "offers": {
      "@type": "Offer",
      "price": tour.basePrice,
      "priceCurrency": tour.currency,
      "availability": "https://schema.org/InStock",
      "validFrom": new Date().toISOString(),
    },
    "provider": {
      "@type": "TouristInformationCenter",
      "name": "Vista Chase",
      "url": "https://www.vistachase.com",
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": tour.rating.toString(),
      "reviewCount": tour.reviewCount.toString(),
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Header */}
      <section className="relative bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src={tour.featuredImage}
            alt={tour.title}
            fill
            priority
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link href="/" className="text-slate-400 hover:text-white">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <Link
              href={tour.category === "PRIVATE" ? "/private-tours" : "/shared-tours"}
              className="text-slate-400 hover:text-white"
            >
              {tour.category === "PRIVATE" ? "Private Tours" : "Shared Tours"}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-gold-300 font-semibold">{tour.title}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-forest-900 border border-gold-400/40 text-gold-300 text-xs font-semibold">
            <Award className="w-4 h-4 text-gold-400" />
            <span>TripAdvisor Award-Winning Experience</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-white leading-tight">
            {tour.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{tour.rating.toFixed(1)}</span>
              <span className="text-slate-400 font-normal">({tour.reviewCount} reviews)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gold-400" />
              <span>{tour.durationHours} Hours Duration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gold-400" />
              <span>Max {tour.maxGroupSize} Guests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gold-400" />
              <span>{tour.destination.name}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content & Booking Sidebar */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-10">
          {/* Summary Box */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
            <h2 className="text-xl font-bold text-forest-950 font-display">Experience Overview</h2>
            <p className="text-slate-700 leading-relaxed text-base">{tour.description}</p>
          </div>

          {/* Highlights */}
          {tour.highlights.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
              <h2 className="text-xl font-bold text-forest-950 font-display">Tour Highlights</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tour.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inclusions & Exclusions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
              <h3 className="text-lg font-bold text-emerald-800 font-display flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>What&apos;s Included</span>
              </h3>
              <ul className="space-y-2 text-sm text-slate-700">
                {tour.inclusions.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
              <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                <XCircle className="w-5 h-5 text-slate-400" />
                <span>What&apos;s Not Included</span>
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {tour.exclusions.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-slate-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* What to Bring */}
          {tour.whatToBring.length > 0 && (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
              <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-600" />
                <span>What to Bring &amp; Recommendations</span>
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-800">
                {tour.whatToBring.map((wb, i) => (
                  <li key={i}>• {wb}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Live Departures & Reservation Engine */}
        <div className="space-y-6">
          <div className="sticky top-28 rounded-2xl bg-white border-2 border-forest-900/10 shadow-xl p-6 space-y-6">
            <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs text-slate-500">Price per group / person</span>
                <p className="text-3xl font-bold text-forest-950">
                  ${tour.basePrice.toFixed(0)}{" "}
                  <span className="text-xs font-normal text-slate-500">{tour.currency}</span>
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                Guaranteed Access
              </span>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-forest-950 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-forest-800" />
                <span>Upcoming Departures &amp; Real Capacity</span>
              </h3>

              {tour.departures.length === 0 ? (
                <p className="text-xs text-slate-500">No active departures scheduled for this tour right now.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {tour.departures.map((dep) => (
                    <div
                      key={dep.id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-gold-400 transition-colors flex flex-col justify-between gap-3 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {dep.date} at {dep.departureTime}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-semibold ${
                            dep.seatsAvailable > 3
                              ? "bg-emerald-100 text-emerald-800"
                              : dep.seatsAvailable > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {dep.seatsAvailable > 0 ? `${dep.seatsAvailable} seats left` : "Sold Out"}
                        </span>
                      </div>

                      {dep.seatsAvailable > 0 ? (
                        <Link
                          href={`/book?departureId=${dep.id}`}
                          className="w-full py-2.5 rounded-lg font-bold text-xs text-forest-950 gold-gradient text-center shadow hover:opacity-95 transition-opacity"
                        >
                          Select &amp; Checkout (${dep.price} {dep.currency})
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2 rounded-lg text-xs font-semibold text-slate-400 bg-slate-200 cursor-not-allowed"
                        >
                          Fully Booked
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% Free cancellation up to 48 hours prior</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Complimentary hotel pickup included</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
