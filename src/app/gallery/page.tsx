import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rockies Photo Gallery | Vista Chase Banff",
  description:
    "Explore photos of Moraine Lake canoes, Lake Louise, Ten Peaks sunrise, Bow Lake, and luxury Vista Chase tours in the Canadian Rockies.",
  alternates: {
    canonical: "/gallery",
  },
};

const GALLERY_PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1000&auto=format&fit=crop",
    caption: "Canoes on Moraine Lake at Valley of the Ten Peaks",
    category: "Moraine Lake",
  },
  {
    url: "https://images.unsplash.com/photo-1536152470836-b943b246224c?q=80&w=1000&auto=format&fit=crop",
    caption: "Sunrise alpine glow reflecting off Moraine Lake Rockpile",
    category: "Sunrise",
  },
  {
    url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1000&auto=format&fit=crop",
    caption: "Emerald waters and Victoria Glacier at Lake Louise",
    category: "Lake Louise",
  },
  {
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop",
    caption: "Emerald Lake tranquil shoreline in Yoho National Park",
    category: "Yoho",
  },
  {
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop",
    caption: "Peyto Lake wolf-shaped panoramic viewpoint along Icefields Parkway",
    category: "Icefields",
  },
  {
    url: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1000&auto=format&fit=crop",
    caption: "Alpine twilight in Banff National Park mountain corridor",
    category: "Banff",
  },
];

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="bg-forest-950 text-white py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto space-y-4">
          <span className="text-xs uppercase tracking-widest font-bold text-gold-400">Canadian Rockies Wonders</span>
          <h1 className="text-3xl sm:text-5xl font-bold font-display text-white">
            Guest Photo Gallery
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-base">
            Every morning brings fresh alpine magic. See why travelers rate our sunrise tours and private Rockies excursions 5 stars.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {GALLERY_PHOTOS.map((photo, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl overflow-hidden shadow-card aspect-[4/3] bg-slate-900"
            >
              <Image
                src={photo.url}
                alt={photo.caption}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <div>
                  <span className="text-[11px] font-bold text-gold-300 uppercase tracking-wider">{photo.category}</span>
                  <p className="text-xs text-white mt-0.5">{photo.caption}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
