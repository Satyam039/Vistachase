"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  MapPin,
  Search,
  Building,
  Clock,
  Compass,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Navigation,
  Info,
} from "lucide-react";
import type { PickupLocation } from "@/lib/api/types";

export default function PickupFinderPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTown, setSelectedTown] = useState<string>("ALL");
  const [pickups, setPickups] = useState<PickupLocation[]>([]);

  useEffect(() => {
    fetch("/api/pickups")
      .then((res) => res.json())
      .then((data) => setPickups(data.pickups || []))
      .catch((err) => console.error("Failed to load pickup locations:", err));
  }, []);

  const filteredPickups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return pickups.filter((loc) => {
      const matchTown = selectedTown === "ALL" || loc.town.toUpperCase() === selectedTown;
      const matchQuery =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.address.toLowerCase().includes(q) ||
        loc.town.toLowerCase().includes(q);
      return matchTown && matchQuery;
    });
  }, [pickups, searchQuery, selectedTown]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Banner */}
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-forest-900 border border-gold-400/40 text-gold-300 text-xs font-semibold">
            <MapPin className="w-4 h-4 text-gold-400" />
            <span>Complimentary Door-to-Door Transportation</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Banff &amp; Canmore Hotel Pickup Finder
          </h1>

          <p className="text-slate-300 max-w-2xl mx-auto text-base leading-relaxed">
            Avoid driving in the dark or parking lots at 4:30 AM. Enter your hotel name below to find your designated pickup stop, exact departure timing, and walking directions.
          </p>
        </div>
      </section>

      {/* Main Search Controls */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-7 relative z-20 w-full">
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your hotel (e.g. Fairmont Banff Springs, Caribou Lodge, Moose, Rimrock, Coast Canmore)..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-forest-800 transition-colors"
            />
          </div>

          {/* Town Selector Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 mr-2">Filter Town:</span>
            {["ALL", "BANFF", "CANMORE", "LAKE LOUISE"].map((town) => (
              <button
                key={town}
                onClick={() => setSelectedTown(town)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedTown === town
                    ? "bg-forest-900 text-gold-300 shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {town === "ALL" ? "All Locations" : town}
              </button>
            ))}
            <span className="text-xs text-slate-500 ml-auto">
              Found {filteredPickups.length} verified pickup {filteredPickups.length === 1 ? "point" : "points"}
            </span>
          </div>
        </div>
      </section>

      {/* Results List */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-6">
        {filteredPickups.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <Building className="w-12 h-12 text-slate-300 mx-auto" />
            <h2 className="text-lg font-bold text-forest-950">No exact hotel match found</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Staying at an Airbnb, private chalet, or unlisted accommodation? We offer central pickups at the <strong>Banff Train Station Public Parking Lot</strong> or nearby hub hotels.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedTown("ALL");
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-forest-900 text-white hover:bg-forest-800"
            >
              Reset Search Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPickups.map((loc) => (
              <div
                key={loc.id}
                className="p-6 rounded-3xl bg-white border border-slate-200 shadow-card hover:shadow-lg transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-forest-50 text-forest-800 text-xs font-bold border border-forest-100">
                      {loc.town}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {loc.latitude.toFixed(4)}°N, {Math.abs(loc.longitude).toFixed(4)}°W
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-forest-950 group-hover:text-forest-700 transition-colors">
                    {loc.name}
                  </h2>

                  <p className="text-xs text-slate-600 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{loc.address}</span>
                  </p>

                  {/* Meeting instructions */}
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span><strong>Pickup Location:</strong> {loc.instructions}</span>
                  </div>

                  {/* Available Shuttles from this point */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Routes Serving This Location:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {loc.shuttleLines.map((line, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Route</span>
                  </span>
                  <Link
                    href={`/shuttles`}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-forest-950 gold-gradient hover:opacity-95 transition-opacity flex items-center gap-1.5"
                  >
                    <span>Reserve Route</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Advice Section */}
      <section className="bg-forest-900/40 border-t border-slate-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-forest-950 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>Punctuality Guidelines for Moraine Lake Commercial Shuttles</span>
          </h3>
          <ul className="text-xs sm:text-sm text-slate-700 space-y-2 leading-relaxed">
            <li>• Please be at your designated pickup spot <strong>10 minutes before</strong> your departure window.</li>
            <li>• To protect strict Parks Canada commercial entry timed windows, vehicles cannot hold for late arrivals.</li>
            <li>• Look for the dark green or silver Vista Chase luxury vans or SUVs with the golden mountain logo.</li>
            <li>• If staying outside town limits, free parking is available at the <strong>Banff Train Station</strong>.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
