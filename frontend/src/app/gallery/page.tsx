import Image from "next/image";
import Link from "next/link";
import { Camera, Compass, Sparkles } from "lucide-react";
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
    url: "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/661a357eb4520970ef37baae_Lake%20Moraine-min.jpg",
    caption: "Moraine Lake Valley of the Ten Peaks iconic mirror reflection",
    category: "Moraine Lake",
    featured: true,
  },
  {
    url: "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/661f77d337ee36fafe108e42_vsc-2023-oct-22.jpg",
    caption: "Canadian Pacific Railway curving through Morant's Curve, Bow Valley",
    category: "Scenic Routes",
    featured: false,
  },
  {
    url: "https://cdn.prod.website-files.com/66045d65f543fe7fe5bf3b3b/66187747e7a83d3e698eaef9_vsc-2023-oct-123.jpg",
    caption: "Certified Vista Chase mountain guide overlooking the Canadian Rockies",
    category: "Guides & Lifestyle",
    featured: true,
  },
  {
    url: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1000&auto=format&fit=crop",
    caption: "Red wooden canoes along the turquoise shoreline of Moraine Lake",
    category: "Moraine Lake",
    featured: false,
  },
  {
    url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?q=80&w=1000&auto=format&fit=crop",
    caption: "Lake Louise morning serenity facing Mount Victoria & Victoria Glacier",
    category: "Lake Louise",
    featured: false,
  },
  {
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop",
    caption: "Emerald Lake tranquil waters enclosed by Yoho National Park peaks",
    category: "Yoho",
    featured: false,
  },
  {
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop",
    caption: "Peyto Lake wolf-shaped panoramic view along the Icefields Parkway",
    category: "Icefields",
    featured: false,
  },
  {
    url: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1000&auto=format&fit=crop",
    caption: "Bow Valley alpine twilight and mountain corridor near Banff",
    category: "Banff",
    featured: false,
  },
  {
    url: "https://images.unsplash.com/photo-1536152470836-b943b246224c?q=80&w=1000&auto=format&fit=crop",
    caption: "Sunrise alpenglow illuminating the Ten Peaks rockpile",
    category: "Sunrise",
    featured: false,
  },
];

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#1C1F23]">
      {/* Editorial Hero */}
      <section className="bg-[#0C1F21] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-12 text-center relative overflow-hidden border-b border-white/10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[#FFE085] text-xs font-semibold uppercase tracking-wider border border-white/15">
            <Camera className="w-3.5 h-3.5 text-[#F5BF03]" />
            <span>Official Vista Chase Visual Journal</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
            The Canadian Rockies in Living Color
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl mx-auto">
            From the crisp stillness of sunrise at Moraine Lake to the sweeping vistas of the Icefields Parkway.
            Real moments captured on Vista Chase journeys.
          </p>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GALLERY_PHOTOS.map((photo, idx) => (
            <div
              key={idx}
              className={`group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-xl bg-slate-900 border border-slate-200 transition-all duration-300 ${
                photo.featured ? "sm:col-span-2 lg:col-span-2 aspect-[16/10]" : "aspect-[4/3]"
              }`}
            >
              <Image
                src={photo.url}
                alt={photo.caption}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-[#FFE085] uppercase tracking-wider bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/20">
                    {photo.category}
                  </span>
                  <p className="text-sm font-medium text-white pt-1">{photo.caption}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gallery CTA */}
        <div className="mt-16 p-10 rounded-3xl bg-[#0C1F21] text-white text-center space-y-4 border border-white/10">
          <Sparkles className="w-8 h-8 text-[#F5BF03] mx-auto" />
          <h2 className="text-3xl font-serif font-light text-white">Capture Your Own Mountain Memories</h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Our expert guides know the prime lighting angles, seasonal reflections, and secret viewing spots across the
            Bow Valley and Jasper.
          </p>
          <div className="pt-2">
            <Link
              href="/#featured-experiences"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-[#1C1F23] golden-summit-btn shadow-lg"
            >
              Explore Bookable Tours
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
