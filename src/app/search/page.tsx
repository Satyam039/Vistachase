import Image from "next/image";
import Link from "next/link";
import { getTours } from "@/modules/tours/tour.repository";
import { TourSearchFilter } from "@/components/search/TourSearchFilter";
import { Clock, Users, Star, Compass, AlertCircle, ChevronRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Canadian Rockies Tours & Shuttles | Vista Chase",
  description: "Find real-time departures, live seat availability, and guaranteed Moraine Lake tours across Banff and the Rockies.",
  alternates: {
    canonical: "/search",
  },
};

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    category?: string;
    destination?: string;
    seats?: string;
    date?: string;
  };
}) {
  const keyword = (searchParams.q || "").toLowerCase().trim();
  const category = searchParams.category && searchParams.category !== "ALL" ? searchParams.category : undefined;
  const destination = searchParams.destination && searchParams.destination !== "ALL" ? searchParams.destination : undefined;
  const requiredSeats = parseInt(searchParams.seats || "1", 10);

  let tours = await getTours({
    category,
    destinationSlug: destination,
  });

  if (keyword) {
    tours = tours.filter((t) => {
      const corpus = `${t.title} ${t.summary} ${t.description} ${t.destination.name}`.toLowerCase();
      return corpus.includes(keyword);
    });
  }

  // Filter for party size if departures exist
  tours = tours.map((t) => ({
    ...t,
    departures: t.departures.filter((d) => d.seatsAvailable >= requiredSeats),
  }));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Search Header */}
      <section className="bg-forest-950 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <h1 className="text-3xl font-bold font-display text-white">
            Available Experiences &amp; Shuttles
          </h1>
          <p className="text-sm text-slate-300">
            Real-time seat countdown across guaranteed Moraine Lake, Lake Louise, Banff, and Jasper departures.
          </p>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 w-full">
        <TourSearchFilter
          initialCategory={searchParams.category}
          initialDestination={searchParams.destination}
        />
      </section>

      {/* Results List */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-200 pb-3">
          <span>Found {tours.length} matching {tours.length === 1 ? "tour" : "tours"}</span>
          <span>Party of {requiredSeats} {requiredSeats === 1 ? "guest" : "guests"}</span>
        </div>

        {tours.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-forest-950">No matching tours found</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Try adjusting your category or destination filters, or contact our concierge for customized private charters.
            </p>
            <Link
              href="/search"
              className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-forest-900 text-white hover:bg-forest-800"
            >
              Reset Search
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tours.map((tour) => {
              const bestDeparture = tour.departures[0];
              return (
                <div
                  key={tour.id}
                  className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-card hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div className="relative h-56 w-full">
                    <Image
                      src={tour.featuredImage}
                      alt={tour.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-forest-950/80 backdrop-blur-md text-gold-300 text-xs font-semibold">
                      {tour.destination.name}
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-forest-950 text-xs font-bold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{tour.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{tour.durationHours} Hours</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Max {tour.maxGroupSize} Guests</span>
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-forest-950 group-hover:text-forest-700 transition-colors">
                        <Link href={`/${tour.slug}`}>{tour.title}</Link>
                      </h3>
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {tour.summary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500">From</span>
                        <p className="text-xl font-bold text-forest-950">
                          ${tour.basePrice} <span className="text-xs font-normal text-slate-500">{tour.currency}</span>
                        </p>
                        {bestDeparture && (
                          <span className="text-[11px] font-semibold text-emerald-700 block">
                            {bestDeparture.seatsAvailable} seats available on {bestDeparture.date}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/${tour.slug}`}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs text-forest-950 gold-gradient hover:opacity-95 transition-opacity"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
