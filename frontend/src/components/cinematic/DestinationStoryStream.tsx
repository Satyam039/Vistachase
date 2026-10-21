// Destinations as sticky scroll storytelling: the photo / clip stays pinned while each place's
// chapter scrolls past (StickyStory). Copy from the live site's destination and tour pages.

import { SectionHeading } from "@/components/home/SectionHeading";
import { StickyStory, type StoryChapter } from "@/components/motion/StickyStory";

const CHAPTERS: StoryChapter[] = [
  {
    id: "banff",
    eyebrow: "01 — Banff National Park",
    title: "Discover Banff Beyond the Postcard",
    body: "Mountain views, peaceful lakes and stories that bring the scenery to life. Explore Banff's highlights with a guide who makes the journey personal.",
    facts: ["Bow Falls", "Surprise Corner", "Lake Minnewanka"],
    cta: { label: "Explore Banff Tours", href: "/destinations/banff-national-park" },
    image: "/media/videos/vermilion-lakes-poster.webp",
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
    imageAlt: "Red canoes at the Emerald Lake dock in Yoho National Park",
    video: { src: "/media/videos/emerald-lake-canoes.mp4", poster: "/media/videos/emerald-lake-canoes-poster.webp" },
  },
  {
    id: "jasper",
    eyebrow: "05 — Jasper National Park",
    title: "Make Room for More Adventure",
    body: "Discover Jasper's expansive mountain landscapes, striking lakes and deep sense of wilderness. Explore on a private tour or include Jasper in a custom multi-day journey.",
    facts: ["Mountain Scenery", "Lakeside Views", "Private Experiences"],
    cta: { label: "Explore Jasper Tours", href: "/destinations/jasper-national-park" },
    image: "/media/photos/spirit-island.webp",
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
      </div>
    </section>
  );
}
