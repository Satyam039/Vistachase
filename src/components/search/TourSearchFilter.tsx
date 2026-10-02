"use client";

import { useState } from "react";
import { Search, Calendar, Users, Filter, MapPin, Compass } from "lucide-react";
import { useRouter } from "next/navigation";

export function TourSearchFilter({
  initialCategory,
  initialDestination,
}: {
  initialCategory?: string;
  initialDestination?: string;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState(initialCategory || "ALL");
  const [destination, setDestination] = useState(initialDestination || "ALL");
  const [partySize, setPartySize] = useState("2");
  const [selectedDate, setSelectedDate] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (category !== "ALL") params.set("category", category);
    if (destination !== "ALL") params.set("destination", destination);
    if (partySize) params.set("seats", partySize);
    if (selectedDate) params.set("date", selectedDate);

    router.push(`/search?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
    >
      {/* 1. Keyword */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-forest-800" />
          <span>Keyword</span>
        </label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="e.g. Moraine Lake, Sunrise..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-forest-800"
        />
      </div>

      {/* 2. Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-forest-800" />
          <span>Experience Type</span>
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-forest-800"
        >
          <option value="ALL">All Experiences</option>
          <option value="SHARED">Shared Tours (Max 12)</option>
          <option value="PRIVATE">Luxury Private SUV</option>
          <option value="SHUTTLE">Direct Lake Shuttles</option>
          <option value="MULTIDAY">Multi-Day Packages</option>
        </select>
      </div>

      {/* 3. Destination */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-forest-800" />
          <span>Destination</span>
        </label>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-forest-800"
        >
          <option value="ALL">All Rockies Regions</option>
          <option value="banff-national-park">Banff National Park</option>
          <option value="moraine-lake">Moraine Lake</option>
          <option value="lake-louise">Lake Louise</option>
          <option value="jasper-national-park">Jasper &amp; Icefields</option>
          <option value="yoho-national-park">Yoho National Park</option>
        </select>
      </div>

      {/* 4. Guests */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-forest-800" />
          <span>Guests</span>
        </label>
        <select
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-forest-800"
        >
          <option value="1">1 Guest</option>
          <option value="2">2 Guests</option>
          <option value="3">3 Guests</option>
          <option value="4">4 Guests</option>
          <option value="5">5 Guests</option>
          <option value="6">6 Guests</option>
          <option value="7">7+ Guests</option>
        </select>
      </div>

      {/* 5. Submit CTA */}
      <div>
        <button
          type="submit"
          className="w-full py-2.5 rounded-xl font-bold text-xs text-forest-950 gold-gradient hover:opacity-95 shadow transition-all flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          <span>Find Available Seats</span>
        </button>
      </div>
    </form>
  );
}
