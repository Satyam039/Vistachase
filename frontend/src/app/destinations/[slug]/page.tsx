import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getDestinationBySlug } from "@/lib/api/catalog";
import { MapPin, ChevronRight, Clock, Users } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const dest = await getDestinationBySlug(params.slug);
  if (!dest) return { title: "Destination Not Found | Vista Chase" };
  return {
    title: dest.metaTitle || `${dest.name} Tours & Shuttles | Vista Chase`,
    description: dest.metaDescription || dest.description,
    alternates: {
      canonical: `/destinations/${dest.slug}`,
    },
  };
}

export default async function DestinationDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}) {
  const params = await paramsPromise;
  const dest = await getDestinationBySlug(params.slug);

  if (!dest) notFound();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="relative bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src={dest.heroImage}
            alt={dest.name}
            fill
            priority
            className="object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <Link href="/destinations" className="hover:text-white">Destinations</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-gold-300 font-semibold">{dest.name}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            {dest.name}
          </h1>
          <p className="text-slate-200 max-w-3xl text-base sm:text-lg leading-relaxed">
            {dest.description}
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-bold font-display text-forest-950">
            Experiences in {dest.name}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Choose from guaranteed commercial shuttles, small groups, or private luxury SUVs.
          </p>
        </div>

        {dest.tours.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-600">
            <p>Our upcoming seasonal tours for {dest.name} will be announced shortly. Contact our concierge for private charter arrangements.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {dest.tours.map((tour) => (
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
                    {tour.category}
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
                        <span>Max {tour.maxGroupSize}</span>
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
                        ${tour.basePrice} <span className="text-xs font-normal">{tour.currency}</span>
                      </p>
                    </div>
                    <Link
                      href={`/${tour.slug}`}
                      className="px-4 py-2 rounded-xl font-bold text-xs text-forest-950 gold-gradient hover:opacity-95 transition-opacity"
                    >
                      Book Tour
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
