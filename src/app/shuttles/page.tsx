import Link from "next/link";
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
} from "lucide-react";
import { getShuttleRoutes } from "@/modules/shuttles/shuttle.repository";
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
  const routes = await getShuttleRoutes();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero */}
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-900 border border-gold-400/40 text-gold-300 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-gold-400" />
            <span>Guaranteed Parks Canada Commercial Access</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Moraine Lake &amp; Lake Louise Shuttles
          </h1>
          <p className="text-slate-300 max-w-2xl text-base leading-relaxed">
            Private vehicle access to Moraine Lake is completely closed. Our commercial shuttles guarantee your entrance with door-to-door hotel pickups in Banff, Canmore, and Lake Louise.
          </p>
        </div>
      </section>

      {/* Advisory Banner */}
      <section className="bg-amber-500/10 border-b border-amber-500/20 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center gap-3 text-xs sm:text-sm text-slate-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Reminder:</strong> Parks Canada closed Moraine Lake Road to private vehicles in 2023. You cannot drive your personal or rental car to Moraine Lake.
          </span>
        </div>
      </section>

      {/* Shuttle Products List */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-12">
        <div className="space-y-8">
          {routes.map((route) => (
            <div
              key={route.id}
              className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-card p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
                    <Compass className="w-4 h-4" />
                    <span>Route: {route.origin} ➔ {route.destination}</span>
                  </div>
                  <h2 className="text-2xl font-bold font-display text-forest-950">{route.name}</h2>
                  <p className="text-slate-600 text-sm max-w-2xl mt-1 leading-relaxed">
                    {route.description}
                  </p>
                </div>
                <div className="shrink-0 flex md:flex-col items-end justify-between md:justify-center">
                  <span className="text-xs text-slate-500">Round-Trip From</span>
                  <p className="text-2xl font-bold text-forest-950">
                    ${route.departures[0]?.price || 89}{" "}
                    <span className="text-xs font-normal text-slate-500">CAD</span>
                  </p>
                </div>
              </div>

              {/* Inclusions Per Shuttle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-700 bg-forest-50/50 p-4 rounded-2xl border border-forest-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Complimentary Banff / Canmore Hotel Pickup</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Hot French Roast Coffee &amp; Cocoa Included</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Guaranteed 2 Hours at Moraine Lake</span>
                </div>
              </div>

              {/* Upcoming Scheduled Departures with Live Seats Countdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-forest-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-forest-800" />
                  <span>Upcoming Scheduled Departures (Live Seat Inventory)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {route.departures.map((dep) => (
                    <div
                      key={dep.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3 hover:border-gold-400 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {dep.date} • {dep.departureTime}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            dep.seatsAvailable > 3
                              ? "bg-emerald-100 text-emerald-800"
                              : dep.seatsAvailable > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {dep.seatsAvailable > 0 ? `${dep.seatsAvailable} seats` : "Full"}
                        </span>
                      </div>

                      {dep.seatsAvailable > 0 ? (
                        <Link
                          href={`/book?departureId=${dep.id}`}
                          className="w-full py-2 rounded-lg font-bold text-xs text-forest-950 gold-gradient text-center shadow-sm hover:opacity-90 transition-opacity"
                        >
                          Reserve Seats (${dep.price} CAD)
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2 rounded-lg text-xs font-semibold text-slate-400 bg-slate-200 cursor-not-allowed"
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
