import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getDestinationBySlug } from "@/lib/api/catalog";
import { MapPin, ChevronRight, Clock, Users, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";

const DESTINATION_STORIES: Record<
  string,
  {
    tagline: string;
    landmarks: { name: string; description: string; image: string }[];
  }
> = {
  banff: {
    tagline: "Where the Rockies Begin",
    landmarks: [
      {
        name: "Bow Falls & Surprise Corner",
        description: "The thundering glacier-fed cascades beneath the historic Fairmont Banff Springs Hotel.",
        image: "/media/photos/bow-falls.webp",
      },
      {
        name: "Johnston Canyon Lower & Upper Falls",
        description: "Suspended catwalks hugging deep limestone canyon walls and dramatic turquoise pools.",
        image: "/media/photos/johnston-canyon.webp",
      },
      {
        name: "Mount Norquay & Vermilion Lakes",
        description: "Panoramic alpine lookouts reflecting Mount Rundle in tranquil wetland waters.",
        image: "/media/photos/bow-falls.webp",
      },
    ],
  },
  "lake-louise": {
    tagline: "The Crown Jewels of the Canadian Rockies",
    landmarks: [
      {
        name: "Moraine Lake & Valley of the Ten Peaks",
        description: "The world's most recognizable glacier-fed turquoise waters. Guaranteed commercial access with Vista Chase.",
        image: "/media/photos/moraine-lake-perfect-reflection.webp",
      },
      {
        name: "Lake Louise & Victoria Glacier",
        description: "Iconic alpine shoreline, red canoes, and dramatic peaks flanking the Fairmont Chateau.",
        image: "/media/photos/lake-louise-red-canoes.webp",
      },
      {
        name: "Morant's Curve Scenic Lookout",
        description: "The historic Bow River railway bend where Canadian Pacific trains wind through mountain majesty.",
        image: "/media/photos/morants-curve-summer.webp",
      },
    ],
  },
  yoho: {
    tagline: "A World of Cascades & Emerald Waters",
    landmarks: [
      {
        name: "Emerald Lake",
        description: "Vivid jade waters enclosed by the President Range, offering quiet morning walking paths.",
        image: "/media/photos/emerald-lake-island.webp",
      },
      {
        name: "Natural Bridge",
        description: "An ancient rock formation carved by the relentless force of the Kicking Horse River.",
        image: "/media/photos/natural-bridge.webp",
      },
    ],
  },
  "icefields-parkway": {
    tagline: "A Road Through Another World",
    landmarks: [
      {
        name: "Peyto Lake & Bow Summit",
        description: "The iconic wolf-shaped glacial lake viewed from the highest highway elevation in the Canadian national parks.",
        image: "/media/photos/peyto-lake.webp",
      },
      {
        name: "Columbia Icefield & Athabasca Glacier",
        description: "The largest sub-polar icefield in North America, feeding water to three distinct oceans.",
        image: "/media/photos/athabasca-glacier.webp",
      },
    ],
  },
};

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

  const story = DESTINATION_STORIES[dest.slug] || {
    tagline: `Discover ${dest.name}`,
    landmarks: [],
  };

  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 01. CINEMATIC DESTINATION HERO */}
      <section className="relative bg-ocean-900 text-white pt-28 pb-20 px-4 sm:px-6 lg:px-12 overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 z-0">
          <Image
            src={dest.heroImage}
            alt={dest.name}
            fill
            priority
            className="object-cover opacity-35"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ocean-900 via-ocean-900/70 to-transparent" />
        </div>
        {dest.heroVideo && (
          // Same 35% opacity as the photo over the dark hero, so text contrast is unchanged.
          <AmbientVideo
            src={dest.heroVideo.src}
            srcHd={dest.heroVideo.srcHd}
            poster={dest.heroVideo.poster}
            className="absolute inset-0 z-0 h-full w-full object-cover opacity-35"
            buttonClassName="bottom-4 right-4"
          />
        )}

        <div className="relative z-10 max-w-7xl mx-auto space-y-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 text-xs uppercase tracking-widest text-slate-300">
            <Link href="/" className="inline-flex min-h-6 items-center hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <Link href="/destinations" className="inline-flex min-h-6 items-center hover:text-white transition-colors">
              Destinations
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-500" aria-hidden="true" />
            <span aria-current="page" className="text-summit-300">{dest.name}</span>
          </nav>

          <div className="max-w-3xl space-y-4">
            <span className="text-xs uppercase tracking-widest text-ocean-300 font-bold block">
              {story.tagline}
            </span>
            <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
              {dest.name}
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl">
              {dest.description}
            </p>
          </div>
        </div>
      </section>

      {/* 02. LANDMARKS & HIGHLIGHTS STORY */}
      {story.landmarks.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16 space-y-8">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">Iconic Sights</span>
            <h2 className="text-3xl sm:text-4xl font-light font-serif text-obsidian-900">
              What Makes {dest.name} Unforgettable
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {story.landmarks.map((landmark, idx) => (
              <div
                key={idx}
                className="rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                  <Image
                    src={landmark.image}
                    alt={landmark.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 400px"
                  />
                </div>
                <div className="p-6 space-y-2">
                  <h3 className="text-lg font-serif font-medium text-obsidian-900">{landmark.name}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{landmark.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 03. BOOKABLE EXPERIENCES IN THIS DESTINATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16 space-y-8 border-t border-slate-200/70">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-ocean-600 font-bold">Curated Tours &amp; Shuttles</span>
            <h2 className="text-3xl font-light font-serif text-obsidian-900">Experiences in {dest.name}</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Bókun System of Record Integration</span>
        </div>

        {dest.tours.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-4">
            <Sparkles className="w-8 h-8 text-summit-500 mx-auto" />
            <h3 className="text-xl font-serif text-obsidian-900">Upcoming Seasonal Departures</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Our upcoming seasonal tours for {dest.name} are being scheduled. Connect with our AI concierge or team
              for private charter arrangements.
            </p>
            <Link
              href="/concierge"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-obsidian-900 golden-summit-btn"
            >
              Ask AI Concierge
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {dest.tours.map((tour) => (
              <article
                key={tour.id}
                className="group relative rounded-3xl overflow-hidden bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-ocean-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                    <Image
                      src={tour.featuredImage}
                      alt={tour.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-summit-300 bg-obsidian-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                        {tour.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-ocean-600" />
                        <span>{tour.durationHours} Hours</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-ocean-600" />
                        <span>Max {tour.maxGroupSize}</span>
                      </span>
                    </div>

                    <h3 className="text-xl font-serif font-medium text-obsidian-900 group-hover:text-ocean-600 transition-colors leading-snug">
                      <Link href={`/${tour.slug}`}>
                        <span className="absolute inset-0 z-10" />
                        {tour.title}
                      </Link>
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {tour.summary}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0 mt-auto">
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 block">From</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-serif font-light text-obsidian-900">${tour.basePrice}</span>
                        <span className="text-xs font-semibold text-slate-500">{tour.currency}</span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-obsidian-900 golden-summit-btn shadow-sm">
                      <span>Reserve</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
