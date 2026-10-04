"use client";

import React from "react";
import { MediaStory, MediaStoryProps } from "./MediaStory";

const DESTINATION_STORIES: MediaStoryProps[] = [
  {
    media: "/media/videos/vermilion-lakes.mp4",
    mediaType: "video",
    poster: "/media/videos/vermilion-lakes-poster.webp",
    eyebrow: "01 • BANFF NATIONAL PARK",
    title: "Where the mountains become the journey.",
    description: "Towering limestone peaks, winding alpine valleys, and hidden lookouts. Experience Banff with private guides who know every secret turn of the Bow Valley.",
    ctaLabel: "Explore Banff Tours",
    ctaHref: "/banff-highlights-tour",
    alignment: "left",
    badge: "Most Popular",
  },
  {
    media: "/media/photos/lake-louise-from-chateau.webp",
    mediaType: "image",
    eyebrow: "02 • LAKE LOUISE",
    title: "The colour of the Rockies, in its purest form.",
    description: "Gaze over the legendary turquoise glacier waters and the towering Victoria Glacier from the shoreline of Fairmont Chateau without parking stress.",
    ctaLabel: "Discover Lake Louise",
    ctaHref: "/shared-tours",
    alignment: "right",
  },
  {
    media: "/media/photos/moraine-lake-perfect-reflection.webp",
    mediaType: "image",
    eyebrow: "03 • MORAINE LAKE",
    title: "Arrive before the crowds. Stay for the moment.",
    description: "Private vehicles are restricted, but Vista Chase guarantees access. Watch the morning sun illuminate the Valley of the Ten Peaks with our dedicated sunrise shuttles.",
    ctaLabel: "Book Sunrise Shuttle",
    ctaHref: "/shuttles",
    alignment: "left",
    badge: "Guaranteed Access",
  },
  {
    media: "/media/videos/athabasca-falls.mp4",
    mediaType: "video",
    poster: "/media/videos/athabasca-falls-poster.webp",
    eyebrow: "04 • ICEFIELDS PARKWAY & JASPER",
    title: "A road through another world.",
    description: "Over 230 kilometers of glaciers, plunging waterfalls, and weeping walls. Traverse North America’s most spectacular mountain highway in comfort.",
    ctaLabel: "Explore Icefields Parkway",
    ctaHref: "/icefields-jasper-private-tour",
    alignment: "right",
  },
];

export function DestinationStoryStream() {
  return (
    <section id="destinations" className="relative w-full">
      {/* Editorial intro banner */}
      <div className="bg-ocean-950 py-16 px-6 sm:px-12 border-t border-b border-white/10 text-center">
        <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-summit-400">
          THE CANADIAN ROCKIES
        </span>
        <h2 className="mt-2 text-3xl sm:text-5xl font-bold text-white font-display">
          Iconic Destinations, Presented Without Rush
        </h2>
        <p className="mt-3 text-slate-300 max-w-2xl mx-auto text-base sm:text-lg font-light">
          Scroll through the crown jewels of Alberta. From glass-calm glacial lakes to sub-zero ice bubbles.
        </p>
      </div>

      {/* Stream of cinematic stories */}
      <div className="w-full flex flex-col">
        {DESTINATION_STORIES.map((story, index) => (
          <MediaStory key={index} {...story} />
        ))}
      </div>
    </section>
  );
}
