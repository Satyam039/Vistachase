import Image from "next/image";
import Link from "next/link";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { TourCard } from "@/components/tours/TourCard";
import { serviceById } from "@/lib/services";
import {
  Compass,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Coffee,
  ShieldCheck,
  MapPin,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { getShuttleRoutes, getTours } from "@/lib/api/catalog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moraine Lake & Lake Louise Shuttles | Vista Chase (Guaranteed Access)",
  description:
    "Skip the 3 AM parking lottery. Guaranteed sunrise, mid-day, and golden hour shuttles to Moraine Lake and Lake Louise with complimentary Banff/Canmore hotel pickup.",
  alternates: {
    canonical: "/shuttles",
  },
};

export default async function ShuttlesPage() {
  const [routes, shuttles] = await Promise.all([getShuttleRoutes(), getTours({ category: "SHUTTLE" })]);
  const service = serviceById("shuttles");

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 01. EDITORIAL HERO BANNER */}
      <section className="bg-ocean-900 text-white pt-24 pb-16 px-4 sm:px-6 lg:px-12 relative overflow-hidden border-b border-white/10 lg:min-h-[70vh] lg:flex lg:items-end">
        {/* Moraine Lake still, with the Lake Louise clip playing over it */}
        <Image src={service.image} alt="" fill priority sizes="100vw" className="object-cover opacity-45" />
        <AmbientVideo
          src="/media/videos/lake-louise-summer.mp4"
          srcHd="/media/videos/lake-louise-summer-1080.mp4"
          poster="/media/videos/lake-louise-summer-poster.webp"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          buttonClassName="top-24 right-6"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950 via-ocean-950/70 to-ocean-950/30" />
        <div className="relative z-10 max-w-7xl mx-auto w-full space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <ShieldCheck className="w-4 h-4 text-summit-500" />
            <span>Official Parks Canada Commercial Access Partner</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
              Moraine Lake &amp; Lake Louise Commercial Shuttles
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans">
              Private vehicle access to Moraine Lake is completely closed to the general public. Our commercial
              shuttles guarantee your entrance with door-to-door hotel pickups in Banff, Canmore, and Lake Louise.
            </p>
            <ul className="grid gap-2.5 pt-2 sm:grid-cols-2" aria-label="Why take our shuttle">
              {service.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-base text-slate-100">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-summit-500" aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 02. BOOKABLE SHUTTLES (the live site's two shuttle products) */}
      {shuttles.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-16" aria-labelledby="shuttle-products">
          <h2 id="shuttle-products" className="text-3xl font-light text-obsidian-900 mb-8">
            Choose your shuttle
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {shuttles.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </section>
      )}

      {/* 02. MORAINE LAKE ACCESS ADVISORY */}
      <section className="bg-summit-300/20 border-b border-summit-500/30 py-4 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex items-center gap-3 text-xs sm:text-sm text-obsidian-900">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <span>
            <strong>Parks Canada Regulation:</strong> Personal and rental cars are prohibited on Moraine Lake Road
            year-round. Authorized commercial operators like Vista Chase are the only guaranteed direct vehicle route.
          </span>
        </div>
      </section>

      {/* 03. SHUTTLE ROUTES LISTING */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16 space-y-12">
        <div className="space-y-10">
          {routes.map((route) => (
            <div
              key={route.id}
              className="rounded-3xl bg-white border border-slate-200/90 shadow-md p-6 sm:p-10 space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ocean-600">
                    <Compass className="w-4 h-4" />
                    <span>Corridor: {route.origin} ➔ {route.destination}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-serif font-light text-obsidian-900">{route.name}</h2>
                  <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
                    {route.description}
                  </p>
                </div>

                <div className="shrink-0 flex md:flex-col items-end justify-between md:justify-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs uppercase tracking-wider text-slate-500">Round-Trip From</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-serif font-light text-obsidian-900">
                      ${route.departures[0]?.price || 89}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">CAD</span>
                  </div>
                </div>
              </div>

              {/* Shuttle Inclusions Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-700 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Door-to-door Banff/Canmore hotel pickup</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Hot French roast coffee &amp; cocoa</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">Guaranteed 2 hours at Moraine Lake</span>
                </div>
              </div>

              {/* Live Scheduled Departures */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-obsidian-900 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-ocean-600" />
                    <span>Scheduled Departures (Live Seat Inventory)</span>
                  </h3>
                  <span className="text-xs text-slate-500">Instant Bókun Reservation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {route.departures.map((dep) => (
                    <div
                      key={dep.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between gap-4 hover:border-ocean-500 transition-all duration-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-obsidian-900">
                          {dep.date} • {dep.departureTime}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-semibold text-xs ${
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
                          className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-obsidian-900 golden-summit-btn text-center shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>Reserve (${dep.price} CAD)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                        >
                          Sold Out
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
