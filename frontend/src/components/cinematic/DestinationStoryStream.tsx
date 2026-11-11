// Destinations as sticky scroll storytelling: the photo / clip stays pinned while each place's
// chapter scrolls past (StickyStory). Copy from the live site's destination and tour pages.

import { SectionHeading } from "@/components/home/SectionHeading";
import { StickyStory, type StoryChapter } from "@/components/motion/StickyStory";

// Sister company for tailored multi-day trips; falls back to banffelite.com.
const BANFF_ELITE_URL = process.env.NEXT_PUBLIC_BANFF_ELITE_URL || "https://banffelite.com";

// blurDataURL: a 16px preview of each photo (from sharp), shown while the photo loads, so a phone
// never shows an empty dark card (migration doc, 9 Nov 2026: Jasper card blank on mobile).
const CHAPTERS: StoryChapter[] = [
  {
    id: "banff",
    eyebrow: "01 — Banff National Park",
    title: "Discover Banff Beyond the Postcard",
    body: "Mountain views, peaceful lakes and stories that bring the scenery to life. Explore Banff's highlights with a guide who makes the journey personal.",
    facts: ["Bow Falls", "Surprise Corner", "Lake Minnewanka"],
    cta: { label: "Explore Banff Tours", href: "/destinations/banff-national-park" },
    image: "/media/videos/vermilion-lakes-poster.webp",
    blurDataURL: "data:image/webp;base64,UklGRlYAAABXRUJQVlA4IEoAAADwAQCdASoQAAwAA4BaJQBOgB7Axgsd0gAA/rWpckc6EIKx7yMq9iy2I/cPyv1QcMlaNsWFBOANGwETjkZEWEUYohiTBPwmkgAAAA==",
    imageAlt: "Mount Rundle reflected in Vermilion Lakes near Banff",
    video: { src: "/media/videos/vermilion-lakes.mp4", poster: "/media/videos/vermilion-lakes-poster.webp" },
  },
  {
    id: "lake-louise-moraine",
    eyebrow: "02 — Lake Louise & Moraine Lake · Banff National Park",
    title: "Two Extraordinary Lakes. One Memorable Day.",
    body: "Discover the mountain-framed shores of Lake Louise and Moraine Lake. Choose a guided tour or a convenient shuttle, with Moraine Lake transportation arranged for you.",
    facts: ["Lake Louise", "Moraine Lake", "Valley of the Ten Peaks"],
    cta: { label: "Explore Lake Tours & Shuttles", href: "/shuttles" },
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    blurDataURL: "data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAADwAQCdASoQAAwAA4BaJbACdAEe3dC0AQAA/k6JF8flBx1uCUg8CfxCsUImqyRk+4Uqw3wC/kKuZHUpUPsN6C4lG2zutwCIrjA/Mv057shA3jGMTmxI/XYiZc9B/NAXAAA=",
    imageAlt: "Moraine Lake reflecting the Valley of the Ten Peaks",
  },
  {
    id: "icefields",
    eyebrow: "03 — Icefields Parkway · Banff & Jasper National Parks",
    title: "The Journey Is Part of the Wonder",
    body: "Travel through a landscape of mountain peaks, glacier-fed lakes and sweeping valleys. Discover remarkable stops along the Icefields Parkway with a guide who brings the landscape into focus.",
    facts: ["Bow Lake", "Peyto Lake", "Columbia Icefield"],
    cta: { label: "Explore Icefields Parkway Tours", href: "/search?q=Icefields" },
    image: "/media/photos/peyto-lake.webp",
    blurDataURL: "data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAADwAQCdASoQAAwAA4BaJbACdADp4gErKgAA/uIbODyZWdbVmvYdJDLZ2Oazqo15azBqGtWefnxyK/vTQwc8Jpjtxjmc+U0PZrSLKoxyuJ1GlpPixCqypPuAAAA=",
    imageAlt: "Turquoise Peyto Lake below the Icefields Parkway",
  },
  {
    id: "yoho",
    eyebrow: "04 — Yoho National Park",
    title: "Follow the Water. Find the Wonder.",
    body: "Explore Emerald Lake, dramatic waterfalls and the mountain scenery of Yoho. Enjoy a day of memorable viewpoints and time to take it all in.",
    facts: ["Emerald Lake", "Natural Bridge", "Takakkaw Falls"],
    cta: { label: "Explore Yoho Tours", href: "/destinations/yoho-national-park" },
    image: "/media/videos/emerald-lake-canoes-poster.webp",
    blurDataURL: "data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAABwAgCdASoQAAwAA4BaJbACdAYuv28Irbu9qrmAAP6Fzr+mNAdp76ewZ1qKNXrGucHkGLlZlEtx/bO5OxpEYAYs9EGga+7jHKhSn+Uo+6t/1pQNzq4H0AAA",
    imageAlt: "Red canoes at the Emerald Lake dock in Yoho National Park",
    video: { src: "/media/videos/emerald-lake-canoes.mp4", poster: "/media/videos/emerald-lake-canoes-poster.webp" },
  },
  {
    id: "jasper",
    eyebrow: "05 — Jasper National Park",
    title: "Make Room for More Adventure",
    body: "Discover Jasper's expansive mountain landscapes, striking lakes and deep sense of wilderness. Explore on a private tour or include Jasper in a custom multi-day journey.",
    facts: ["Mountain Scenery", "Lakeside Views", "Private Experiences"],
    cta: { label: "Explore Jasper Tours", href: "/private-tours" },
    secondaryLink: { label: "Plan a Custom Journey with Banff Elite ↗", href: BANFF_ELITE_URL },
    image: "/media/photos/spirit-island.webp",
    blurDataURL: "data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAAAQAgCdASoQAAwAA4BaJaACdADwgA/05+zAAP5bzt+ZW1fnAZHztszDl2MzELJT91NgUCcFWhk+jGZFUl7WgkCCMY0OevEBFvOxRvMcsFAnVvCHGo2dLSXR0AA=",
    imageAlt: "Spirit Island on Maligne Lake in Jasper National Park",
  },
];

export function DestinationStoryStream() {
  return (
    <section id="destinations" aria-labelledby="destinations-heading" className="relative bg-obsidian-950 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-page">
        <SectionHeading
          id="destinations-heading"
          tone="dark"
          eyebrow="The Canadian Rockies"
          title="Iconic places, without the rush"
          intro="Five places at the heart of every Vista Chase day. Scroll through them."
          link={{ label: "All destinations", href: "/destinations" }}
        />
        <StickyStory chapters={CHAPTERS} />
        <p className="mt-8 text-center text-sm text-slate-400 lg:text-right">Destinations and stops vary by tour and season.</p>
      </div>
    </section>
  );
}
