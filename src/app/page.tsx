import Link from "next/link";
import Image from "next/image";
import {
  Compass,
  ShieldCheck,
  MapPin,
  Sparkles,
  Calendar,
  Users,
  Award,
  Clock,
  CheckCircle2,
  ChevronRight,
  Star,
  Coffee,
  Car,
  AlertTriangle,
} from "lucide-react";
import { getTours } from "@/modules/tours/tour.repository";
import { getShuttleRoutes } from "@/modules/shuttles/shuttle.repository";

export default async function HomePage() {
  const tours = await getTours({ isFeatured: true });
  const shuttles = await getShuttleRoutes();

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[85vh] flex items-center justify-center bg-forest-950 text-white overflow-hidden py-24 px-4 sm:px-6 lg:px-8">
        {/* Background Image with Dark Vignette */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=2000&auto=format&fit=crop"
            alt="Moraine Lake Valley of the Ten Peaks Canadian Rockies"
            fill
            priority
            className="object-cover object-center opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/60 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
          {/* Award Pill */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-forest-900/90 border border-gold-400/40 text-gold-300 text-sm font-semibold shadow-glow animate-in fade-in slide-in-from-top-4 duration-500">
            <Award className="w-5 h-5 text-gold-400" />
            <span>TripAdvisor Best of the Best 2025 • #6 Experience in Canada</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight font-display text-white leading-tight">
            Banff, Lake Louise &amp; Moraine Lake{" "}
            <span className="gold-text-gradient block mt-2">Tours &amp; Shuttles</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-2xl text-slate-200 max-w-3xl mx-auto font-light leading-relaxed">
            Guaranteed commercial access to restricted Moraine Lake. Whether you want the freedom of a luxury{" "}
            <strong className="text-white font-semibold">private SUV tour</strong>, the fun of an{" "}
            <strong className="text-white font-semibold">award-winning shared group</strong>, or a stress-free{" "}
            <strong className="text-gold-300 font-semibold">sunrise shuttle</strong>, Vista Chase makes it unforgettable.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/shuttles"
              className="px-8 py-4 rounded-xl font-bold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-base flex items-center gap-2"
            >
              <Compass className="w-5 h-5" />
              <span>Book Guaranteed Shuttles</span>
            </Link>
            <Link
              href="/shared-tours"
              className="px-8 py-4 rounded-xl font-bold text-white bg-forest-800/90 border border-white/20 hover:bg-forest-700/80 transition-all text-base flex items-center gap-2"
            >
              <Award className="w-5 h-5 text-gold-400" />
              <span>Canada #6 Highlights Tour</span>
            </Link>
            <Link
              href="/pickup-finder"
              className="px-8 py-4 rounded-xl font-bold text-slate-200 bg-white/10 border border-white/20 hover:bg-white/20 transition-all text-base flex items-center gap-2"
            >
              <MapPin className="w-5 h-5 text-emerald-400" />
              <span>Find Hotel Pickup</span>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-300 border-t border-white/10 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Guaranteed Lake Permits</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Free Hotel Pickups</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>800+ 5★ Reviews</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Complimentary Hot Drinks</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CRITICAL ADVISORY & STATS (PLAN AHEAD) */}
      <section className="bg-amber-500/10 border-y border-amber-500/20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 shrink-0 mt-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-forest-950">Important Parks Canada Notice for Moraine Lake</h2>
              <p className="text-sm text-slate-700 max-w-3xl mt-1 leading-relaxed">
                Personal vehicles are <strong>strictly prohibited</strong> from driving on Moraine Lake Road. Parking at Lake Louise fills up before 5:30 AM daily. Vista Chase holds authorized commercial licenses, providing <strong>guaranteed door-to-door access</strong> for all our guests.
              </p>
            </div>
          </div>
          <Link
            href="/shuttles"
            className="shrink-0 px-6 py-3 rounded-xl bg-forest-900 text-white font-semibold text-sm hover:bg-forest-800 transition-colors flex items-center gap-2"
          >
            <span>Reserve Shuttle Seats</span>
            <ChevronRight className="w-4 h-4 text-gold-400" />
          </Link>
        </div>
      </section>

      {/* 3. FOUR CORE TRAVEL STYLES */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs uppercase tracking-widest font-bold text-gold-600">Tailored To Your Style</span>
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-forest-950">
            How Would You Like to Experience the Rockies?
          </h2>
          <p className="text-slate-600 text-base">
            From sunrise photographer shuttles to all-inclusive private multi-day itineraries, explore our signature travel options.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Shuttles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-xl transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Compass className="w-6 h-6 text-forest-700" />
              </div>
              <h3 className="text-xl font-bold text-forest-950 font-display">Shuttle Services</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Guaranteed morning, Sunrise (5:00 AM), and Golden Hour shuttles to Moraine Lake and Lake Louise with hotel pickups.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Door-to-door hotel service</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Complimentary coffee &amp; cocoa</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">From</span>
                <p className="text-lg font-bold text-forest-900">$75 <span className="text-xs font-normal">CAD</span></p>
              </div>
              <Link
                href="/shuttles"
                className="px-4 py-2 rounded-lg bg-forest-900 text-white text-xs font-semibold hover:bg-forest-800 transition-colors"
              >
                View Shuttles
              </Link>
            </div>
          </div>

          {/* Card 2: Shared Group Tours */}
          <div className="rounded-2xl border-2 border-gold-400 bg-forest-950 text-white p-6 shadow-glow relative flex flex-col justify-between group">
            <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-gold-400 text-forest-950 text-[11px] font-bold uppercase tracking-wider">
              Canada #6 Award
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-forest-800 text-gold-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-gold-400" />
              </div>
              <h3 className="text-xl font-bold text-white font-display">Shared Small-Group</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Max 12 passengers. TripAdvisor Travelers&apos; Choice Best of the Best 2025. Lake Louise, Moraine Lake, and Banff highlights.
              </p>
              <ul className="text-xs text-slate-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gold-400" />
                  <span>Max 12 guests per group</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gold-400" />
                  <span>Certified local interpretive guide</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 border-t border-forest-800 mt-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">From</span>
                <p className="text-lg font-bold text-gold-300">$189 <span className="text-xs font-normal">CAD</span></p>
              </div>
              <Link
                href="/banff-highlights-tour"
                className="px-4 py-2 rounded-lg gold-gradient text-forest-950 text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Book Tour
              </Link>
            </div>
          </div>

          {/* Card 3: Private SUV Tours */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-xl transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Car className="w-6 h-6 text-forest-700" />
              </div>
              <h3 className="text-xl font-bold text-forest-950 font-display">Private SUV Tours</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Total luxury and flexibility. Full-size GMC Yukon XL SUV for your party of up to 6-7. Design your dream Rockies day.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Custom timing &amp; stops</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Exclusive private guide &amp; vehicle</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">Group Price</span>
                <p className="text-lg font-bold text-forest-900">$1,250 <span className="text-xs font-normal">CAD</span></p>
              </div>
              <Link
                href="/private-tours"
                className="px-4 py-2 rounded-lg bg-forest-900 text-white text-xs font-semibold hover:bg-forest-800 transition-colors"
              >
                Explore Private
              </Link>
            </div>
          </div>

          {/* Card 4: Multi-Day Packages */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-xl transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6 text-forest-700" />
              </div>
              <h3 className="text-xl font-bold text-forest-950 font-display">Multi-Day Packages</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Save more, stress less. Calgary Airport (YYC) pickup, daily guided excursions, and hotel transfers bundled with zero hassle.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Airport round-trip included</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>3-5 day full Rockies itineraries</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">Package From</span>
                <p className="text-lg font-bold text-forest-900">$2,890 <span className="text-xs font-normal">CAD</span></p>
              </div>
              <Link
                href="/multi-day-tour-package-for-banff"
                className="px-4 py-2 rounded-lg bg-forest-900 text-white text-xs font-semibold hover:bg-forest-800 transition-colors"
              >
                View Packages
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURED TOURS CATALOG */}
      <section className="py-20 bg-slate-100/70 border-y border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-gold-600">Signature Experiences</span>
              <h2 className="text-3xl font-bold font-display text-forest-950 mt-1">
                Featured Tours with Guaranteed Access
              </h2>
            </div>
            <Link
              href="/shared-tours"
              className="text-sm font-semibold text-forest-800 hover:text-forest-600 flex items-center gap-1"
            >
              <span>View all tours</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tours.map((tour) => {
              const nextDep = tour.departures[0];
              return (
                <div
                  key={tour.id}
                  className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-card hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div className="relative h-60 w-full overflow-hidden">
                    <Image
                      src={tour.featuredImage}
                      alt={tour.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-forest-950/80 backdrop-blur-md text-gold-300 text-xs font-semibold">
                      {tour.destination.name}
                    </div>
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-forest-950 text-xs font-bold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{tour.rating.toFixed(1)}</span>
                      <span className="text-slate-500">({tour.reviewCount})</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
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
                          ${tour.basePrice.toFixed(0)} <span className="text-xs font-normal text-slate-500">CAD</span>
                        </p>
                        {nextDep && (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            {nextDep.seatsAvailable} seats left on {nextDep.date}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/${tour.slug}`}
                        className="px-4 py-2.5 rounded-xl font-semibold text-xs text-forest-950 gold-gradient hover:opacity-95 transition-opacity"
                      >
                        Reserve Now
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. HOTEL PICKUP FINDER TEASER */}
      <section className="py-20 bg-forest-950 text-white relative overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-800 text-gold-400 text-xs font-semibold">
              <MapPin className="w-4 h-4" />
              <span>Door-to-Door Convenience</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-white">
              Complimentary Hotel Pickups Across Banff &amp; Canmore
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Don&apos;t worry about driving in the dark or finding crowded parking lots. We pick up directly at premier resorts and lodges in Banff, Canmore, and Lake Louise.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
                <span>Fairmont Banff Springs</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
                <span>Banff Caribou Lodge &amp; Spa</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
                <span>Moose Hotel &amp; Suites</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
                <span>The Rimrock Resort Hotel</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
                <span>Coast Canmore Hotel</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />
                <span>Malcolm Hotel Canmore</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/pickup-finder"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-forest-950 gold-gradient shadow-glow hover:opacity-95 transition-all text-sm"
              >
                <MapPin className="w-4 h-4" />
                <span>Check Your Hotel Schedule &amp; Pickup Point</span>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-forest-900/60 backdrop-blur-md p-8 space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white font-display">Need Help Choosing?</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Ask our Canadian Rockies AI Travel Concierge. Get instant answers about road regulations, sunrise times, weather forecasts, or place a <strong>guaranteed 10-minute seat reservation hold</strong> without taking payment over the call.
            </p>

            <div className="p-4 rounded-xl bg-forest-950/70 border border-white/10 text-xs text-slate-300 space-y-2">
              <p className="text-gold-300 font-semibold">Popular questions travelers ask:</p>
              <p>• &quot;What time does the sunrise shuttle leave from Banff Caribou Lodge?&quot;</p>
              <p>• &quot;Can I visit both Lake Louise and Moraine Lake in one day?&quot;</p>
              <p>• &quot;What should I wear for sunrise at Moraine Lake?&quot;</p>
            </div>

            <Link
              href="/concierge"
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-forest-800 hover:bg-forest-700 border border-white/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Sparkles className="w-4 h-4 text-gold-400" />
              <span>Open AI Travel Concierge</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. VERIFIED REVIEWS */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="flex items-center justify-center gap-1 text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-amber-500" />
            ))}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-forest-950">
            Loved by Over 10,000 Travelers
          </h2>
          <p className="text-slate-600 text-sm">
            700+ 5-star reviews on TripAdvisor and 300+ on Google. Here is what real guests say about Vista Chase.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-500" />
              ))}
            </div>
            <p className="text-sm text-slate-700 italic leading-relaxed">
              &quot;Getting guaranteed access to Moraine Lake without waking up at 3am to fight for parking made the entire vacation stress-free. Our guide was professional and the vehicle was spotless.&quot;
            </p>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-forest-950">Emily &amp; Jason</span>
              <span className="text-slate-500">TripAdvisor Review</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-500" />
              ))}
            </div>
            <p className="text-sm text-slate-700 italic leading-relaxed">
              &quot;I booked a shared tour and it was easily the best day of my trip. Our guide was incredibly patient, took stunning photos of our group at the Rockpile, and provided warm tea on a chilly morning.&quot;
            </p>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-forest-950">Jessica M.</span>
              <span className="text-slate-500">Google Verified</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-500" />
              ))}
            </div>
            <p className="text-sm text-slate-700 italic leading-relaxed">
              &quot;We did a private day tour for my family of five, and it exceeded our expectations. Great value, punctual pickup at Rimrock, and total flexibility to stop whenever our kids wanted photos.&quot;
            </p>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-forest-950">Rohit S.</span>
              <span className="text-slate-500">TripAdvisor Review</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
