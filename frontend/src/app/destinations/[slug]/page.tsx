// Destination page: full-bleed video hero, the place's highlights, every tour that visits it (its own
// tours plus tours from other areas that stop there, e.g. Lake Louise on the Banff tours) using the
// shared TourCard, and the other destinations.

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, Sparkles } from "lucide-react";
import { AmbientVideo } from "@/components/cinematic/AmbientVideo";
import { TourCard } from "@/components/tours/TourCard";
import { TrustRow } from "@/components/home/TrustRow";
import { Rail } from "@/components/motion/Rail";
import { getDestinationBySlug, getDestinations, getTours } from "@/lib/api/catalog";

type Highlight = { name: string; body: string; image: string };

// Highlights per destination slug, and the words that mark a tour as visiting it.
const STORIES: Record<string, { tagline: string; match: string[]; highlights: Highlight[] }> = {
  "banff-national-park": {
    tagline: "Where the Rockies begin",
    match: ["banff"],
    highlights: [
      { name: "Bow Falls & Surprise Corner", body: "Glacier-fed falls below the Fairmont Banff Springs, and the lookout that frames them.", image: "/media/photos/bow-falls.webp" },
      { name: "Johnston Canyon", body: "Catwalks along limestone canyon walls to the Lower and Upper Falls.", image: "/media/photos/johnston-canyon.webp" },
      { name: "Vermilion Lakes", body: "Mount Rundle reflected in quiet wetland waters just outside town.", image: "/media/photos/vermilion-lakes-mount-rundle.webp" },
    ],
  },
  "lake-louise": {
    tagline: "The jewel of the Rockies",
    match: ["lake louise"],
    highlights: [
      { name: "Lake Louise & Victoria Glacier", body: "Turquoise water, red canoes and the glacier above the Fairmont Chateau.", image: "/media/photos/lake-louise-red-canoes.webp" },
      { name: "The view from the Big Beehive", body: "The whole lake from above, a classic hike from the shoreline.", image: "/media/photos/lake-louise-from-big-beehive.webp" },
      { name: "Morant's Curve", body: "The famous bend in the Bow River where trains wind below the peaks.", image: "/media/photos/morants-curve-summer.webp" },
    ],
  },
  "moraine-lake": {
    tagline: "The Valley of the Ten Peaks",
    match: ["moraine"],
    highlights: [
      { name: "The Rockpile viewpoint", body: "The short climb to the view of the Ten Peaks over turquoise water.", image: "/media/photos/moraine-lake-rockpile-view.webp" },
      { name: "Canoes on Moraine Lake", body: "Red canoes on the glacier-fed lake in the early morning.", image: "/media/photos/moraine-lake-red-canoes.webp" },
      { name: "Larch Valley", body: "Golden larches in late September above the lake.", image: "/media/photos/larch-valley-hike.webp" },
    ],
  },
  "yoho-national-park": {
    tagline: "Waterfalls and emerald water",
    match: ["yoho", "emerald lake"],
    highlights: [
      { name: "Emerald Lake", body: "Green water ringed by the President Range, with a lakeside walking path.", image: "/media/photos/emerald-lake-island.webp" },
      { name: "Natural Bridge", body: "A rock arch carved by the Kicking Horse River.", image: "/media/photos/natural-bridge.webp" },
      { name: "Wapta Falls", body: "A broad curtain of water on the Kicking Horse River.", image: "/media/photos/wapta-falls.webp" },
    ],
  },
  "jasper-national-park": {
    tagline: "Glaciers and wild country",
    match: ["jasper", "icefield"],
    highlights: [
      { name: "Peyto Lake", body: "The wolf-shaped glacial lake seen from Bow Summit on the Icefields Parkway.", image: "/media/photos/peyto-lake.webp" },
      { name: "Columbia Icefield", body: "The Athabasca Glacier, a tongue of the largest icefield in the Rockies.", image: "/media/photos/athabasca-glacier.webp" },
      { name: "Athabasca Falls", body: "The Athabasca River forced through a narrow limestone gorge.", image: "/media/photos/athabasca-falls.webp" },
      { name: "Spirit Island", body: "The tiny island on Maligne Lake, reached by boat.", image: "/media/photos/spirit-island.webp" },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const dest = await getDestinationBySlug(slug);
  if (!dest) return { title: "Destination not found | Vista Chase" };
  return {
    title: dest.metaTitle || `${dest.name} Tours & Shuttles | Vista Chase`,
    description: dest.metaDescription || dest.description,
    alternates: { canonical: `/destinations/${dest.slug}` },
  };
}

export default async function DestinationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [dest, allTours, destinations] = await Promise.all([getDestinationBySlug(slug), getTours(), getDestinations()]);
  if (!dest) notFound();

  const story = STORIES[dest.slug] ?? { tagline: dest.name, match: [dest.name.toLowerCase()], highlights: [] };
  const visits = (text: string) => story.match.some((m) => text.toLowerCase().includes(m));
  const tours = allTours
    .filter((t) => t.destination.slug === dest.slug || visits(`${t.title} ${t.summary} ${t.description}`))
    .sort((a, b) => Number(b.destination.slug === dest.slug) - Number(a.destination.slug === dest.slug) || b.reviewCount - a.reviewCount);
  const others = destinations.filter((d) => d.slug !== dest.slug);

  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section className="relative isolate flex min-h-[72vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <div className="absolute inset-0 -z-10">
          <Image src={dest.heroImage} alt="" fill priority sizes="100vw" className="object-cover" data-parallax="10" />
        </div>
        {/* Outside the -z-10 layer so its pause button stacks above the hero text; the video and
            the scrim stay behind it. */}
        {dest.heroVideo && (
          <AmbientVideo src={dest.heroVideo.src} srcHd={dest.heroVideo.srcHd} poster={dest.heroVideo.poster} className="absolute inset-0 -z-10 h-full w-full object-cover" once />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/10" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-14 pt-24" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link href="/destinations" className="hover:text-white hover:underline">
                  Destinations
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                {dest.name}
              </li>
            </ol>
          </nav>
          <p className="text-sm uppercase tracking-[0.22em] text-summit-300 motion-safe:animate-[fadeUp_700ms_ease-out]">
            {story.tagline} · {dest.province}
          </p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            {dest.name}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">{dest.description}</p>
          <a href="#tours" className="golden-summit-btn mt-7 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base motion-safe:animate-[fadeUp_1300ms_ease-out]">
            See {tours.length} {tours.length === 1 ? "tour" : "tours"} that go here
          </a>
        </div>
      </section>

      {/* Highlights */}
      {story.highlights.length > 0 && (
        <section aria-labelledby="highlights-heading" className="mx-auto max-w-7xl px-page py-20 sm:py-24">
          <div className="mx-auto mb-10 max-w-3xl text-center" data-reveal>
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Highlights</p>
            <h2 id="highlights-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
              What to see in {dest.name.split(" & ")[0]}
            </h2>
          </div>
          <ul className={`grid gap-5 sm:grid-cols-2 ${story.highlights.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`} data-stagger>
            {story.highlights.map((h) => (
              <li key={h.name} className="group overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={h.image} alt={h.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-light text-obsidian-900">{h.name}</h3>
                  <p className="mt-2 text-base font-light leading-relaxed text-slate-700">{h.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tours */}
      <section id="tours" aria-labelledby="tours-heading" className="scroll-mt-32 border-t border-obsidian-900/[0.06] bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto mb-10 max-w-3xl text-center" data-reveal>
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Tours &amp; shuttles</p>
            <h2 id="tours-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
              Tours that visit {dest.name.split(" & ")[0]}
            </h2>
          </div>
          {tours.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-[1.75rem] bg-obsidian-50 p-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-summit-600" aria-hidden="true" />
              <p className="mt-4 text-xl font-light text-obsidian-900">We can plan a private day here</p>
              <p className="mt-2 text-base text-slate-600">Tell us your dates and we&rsquo;ll build a route around this destination.</p>
              <Link href="/contact-us" className="golden-summit-btn mt-6 inline-flex h-11 items-center rounded-full px-6 text-sm">
                Request a private tour
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5" data-stagger>
              {tours.map((t) => (
                <li key={t.id}>
                  <TourCard tour={t} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <TrustRow />

      {/* Other destinations */}
      <section aria-labelledby="others-heading" className="overflow-hidden py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-page">
          <h2 id="others-heading" className="mb-8 text-center text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl" data-reveal>
            More of the Rockies
          </h2>
          <Rail label="Other destinations" itemClassName="w-[78vw] max-w-[22rem] sm:w-[20rem]">
            {others.map((d) => (
              <Link
                key={d.slug}
                href={`/destinations/${d.slug}`}
                className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.75rem] p-6 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ocean-600"
              >
                <Image src={d.heroImage} alt="" fill sizes="20rem" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]" />
                <span className="vc-scrim" aria-hidden="true" />
                <span className="relative text-2xl font-light">{d.name}</span>
                <span className="relative mt-2 inline-flex items-center gap-1.5 text-sm text-slate-200">
                  Explore
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </Rail>
        </div>
      </section>
    </div>
  );
}
