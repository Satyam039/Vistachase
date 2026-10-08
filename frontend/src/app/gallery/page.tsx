// Photo gallery: places our tours visit, by area, with a full-screen viewer. Captions name the
// place shown in each photo.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { GalleryBrowser, type GalleryPhoto } from "@/components/gallery/GalleryBrowser";

export const metadata: Metadata = {
  title: "Rockies Photo Gallery | Vista Chase Banff",
  description: "Photos of Moraine Lake, Lake Louise, Yoho, the Icefields Parkway, Jasper and Rockies wildlife from Vista Chase tours.",
  alternates: { canonical: "/gallery" },
};

const AREAS = ["Moraine Lake", "Lake Louise", "Banff & Canmore", "Yoho & Icefields", "Jasper", "Wildlife"];

const P = (file: string, w: number, h: number, area: string, caption: string): GalleryPhoto => ({ src: `/media/photos/${file}.webp`, w, h, area, caption });

const PHOTOS: GalleryPhoto[] = [
  P("moraine-lake-perfect-reflection", 1920, 1375, "Moraine Lake", "The Valley of the Ten Peaks mirrored in Moraine Lake"),
  P("lake-louise-sunrise", 2048, 1365, "Lake Louise", "Sunrise at Lake Louise below Victoria Glacier"),
  P("spirit-island", 1365, 2048, "Jasper", "Spirit Island on Maligne Lake"),
  P("three-sisters-canmore", 1920, 1279, "Banff & Canmore", "The Three Sisters above Canmore"),
  P("peyto-lake", 2048, 1365, "Yoho & Icefields", "Peyto Lake from the Icefields Parkway lookout"),
  P("bull-elk-bugling", 2048, 1268, "Wildlife", "A bull elk bugling in the fall rut"),
  P("moraine-lake-rockpile-couple", 1280, 853, "Moraine Lake", "Taking in the view from the Rockpile"),
  P("emerald-lake-island", 1920, 1440, "Yoho & Icefields", "Emerald Lake in Yoho National Park"),
  P("vermilion-lakes-mount-rundle", 1365, 2048, "Banff & Canmore", "Mount Rundle over Vermilion Lakes"),
  P("lake-louise-boathouse", 1920, 1440, "Lake Louise", "The Lake Louise boathouse and canoes"),
  P("athabasca-glacier", 1524, 1012, "Yoho & Icefields", "The Athabasca Glacier at the Columbia Icefield"),
  P("mountain-goat", 1639, 2048, "Wildlife", "A mountain goat on the cliffs"),
  P("moraine-lake-red-canoes", 1920, 1280, "Moraine Lake", "Red canoes on Moraine Lake"),
  P("athabasca-falls", 2048, 1460, "Jasper", "Athabasca Falls in Jasper National Park"),
  P("fairmont-banff-springs", 2048, 1123, "Banff & Canmore", "The Fairmont Banff Springs in winter"),
  P("lake-louise-from-big-beehive", 2048, 815, "Lake Louise", "Lake Louise from the Big Beehive"),
  P("natural-bridge", 1528, 1018, "Yoho & Icefields", "The Natural Bridge on the Kicking Horse River"),
  P("canada-lynx", 1200, 800, "Wildlife", "A Canada lynx in the forest"),
  P("larch-valley-hike", 2048, 1152, "Moraine Lake", "Golden larches in Larch Valley"),
  P("johnston-canyon", 2048, 1351, "Banff & Canmore", "A waterfall in Johnston Canyon"),
  P("jasper-milky-way", 1920, 1280, "Jasper", "The Milky Way over Jasper, a dark-sky preserve"),
  P("bow-lake-dock-sunrise", 2048, 1365, "Yoho & Icefields", "Sunrise at Bow Lake"),
  P("morants-curve-winter", 2048, 989, "Banff & Canmore", "A train at Morant's Curve in winter"),
  P("lake-louise-first-snow", 735, 642, "Lake Louise", "First snow at Lake Louise"),
];

export default function GalleryPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      <section className="relative isolate flex min-h-[52vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/lake-louise-from-big-beehive.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/10" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-12 pt-24" data-scroll-fade>
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center justify-center gap-1.5 text-sm text-slate-200">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-white">
                Gallery
              </li>
            </ol>
          </nav>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            The Rockies, as our guests see them
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Lakes, glaciers, wildlife and quiet mornings from the places our tours visit.
          </p>
        </div>
      </section>

      <section aria-label="Photos" className="mx-auto max-w-7xl px-page py-14 sm:py-20">
        <GalleryBrowser photos={PHOTOS} areas={AREAS} />
      </section>
    </div>
  );
}
