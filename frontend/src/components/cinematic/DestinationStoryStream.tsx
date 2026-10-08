// Destinations as sticky scroll storytelling: the photo / clip stays pinned while each place's
// chapter scrolls past (StickyStory). Copy from the live site's destination and tour pages.

import { SectionHeading } from "@/components/home/SectionHeading";
import { StickyStory, type StoryChapter } from "@/components/motion/StickyStory";

const CHAPTERS: StoryChapter[] = [
  {
    id: "banff",
    eyebrow: "01 · Banff National Park",
    title: "Where the mountains become the journey.",
    body: "Limestone peaks, winding valleys and lookouts most visitors drive straight past. See the Bow Valley with a local guide who knows every turn.",
    facts: ["Bow Falls", "Surprise Corner", "Vermilion Lakes"],
    cta: { label: "Explore Banff tours", href: "/destinations/banff-national-park" },
    image: "/media/videos/vermilion-lakes-poster.webp",
    imageAlt: "Mount Rundle reflected in Vermilion Lakes near Banff",
    video: { src: "/media/videos/vermilion-lakes.mp4", poster: "/media/videos/vermilion-lakes-poster.webp" },
  },
  {
    id: "lake-louise",
    eyebrow: "02 · Lake Louise",
    title: "The colour of the Rockies, in its purest form.",
    body: "Turquoise glacier water beneath Victoria Glacier. Walk the shoreline while we handle the drive and the parking.",
    facts: ["Victoria Glacier", "Lakeshore trail", "Canoe dock"],
    cta: { label: "Discover Lake Louise", href: "/destinations/lake-louise" },
    image: "/media/photos/lake-louise-from-chateau.webp",
    imageAlt: "Lake Louise and Victoria Glacier seen from the Chateau",
    video: { src: "/media/videos/lake-louise-summer.mp4", poster: "/media/videos/lake-louise-summer-poster.webp" },
  },
  {
    id: "moraine-lake",
    eyebrow: "03 · Moraine Lake",
    title: "Arrive before the crowds. Stay for the moment.",
    body: "Private vehicles can't drive to Moraine Lake, but our shuttles can. Watch the sunrise light up the Valley of the Ten Peaks.",
    facts: ["Sunrise departures", "Rockpile viewpoint", "Guaranteed access"],
    cta: { label: "Book the sunrise shuttle", href: "/sunrise-shuttle-to-moraine-lake-and-lake-louise" },
    image: "/media/photos/moraine-lake-perfect-reflection.webp",
    imageAlt: "Moraine Lake reflecting the Valley of the Ten Peaks",
  },
  {
    id: "yoho",
    eyebrow: "04 · Yoho National Park",
    title: "Emerald water, a natural bridge, red canoes.",
    body: "Just over the Great Divide: Emerald Lake, the Kicking Horse River's Natural Bridge and the spiral tunnels.",
    facts: ["Emerald Lake", "Natural Bridge", "Spiral Tunnels"],
    cta: { label: "See the Banff & Yoho tour", href: "/shared-tours-banff-yoho" },
    image: "/media/videos/emerald-lake-canoes-poster.webp",
    imageAlt: "Red canoes at the Emerald Lake dock in Yoho National Park",
    video: { src: "/media/videos/emerald-lake-canoes.mp4", poster: "/media/videos/emerald-lake-canoes-poster.webp" },
  },
  {
    id: "icefields",
    eyebrow: "05 · Icefields Parkway & Jasper",
    title: "A road through another world.",
    body: "Over 230 kilometres of glaciers, waterfalls and turquoise lakes on one of the world's great mountain drives.",
    facts: ["Peyto Lake", "Athabasca Glacier", "Athabasca Falls"],
    cta: { label: "Explore the Icefields Parkway", href: "/icefields-jasper-private-tour" },
    image: "/media/videos/athabasca-falls-poster.webp",
    imageAlt: "Athabasca Falls pouring through its gorge in Jasper National Park",
    video: { src: "/media/videos/athabasca-falls.mp4", poster: "/media/videos/athabasca-falls-poster.webp" },
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
