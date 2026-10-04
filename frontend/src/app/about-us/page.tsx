import Image from "next/image";
import Link from "next/link";
import { Award, ShieldCheck, Heart, Users, CheckCircle2, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Vista Chase | Banff's Top-Rated Tour & Shuttle Operator",
  description:
    "Founded in 2018 in Banff/Canmore. Winner of TripAdvisor Best of the Best 2025 (#6 Experience in Canada). Discover our story, expert local guides, and passion for the Canadian Rockies.",
  alternates: {
    canonical: "/about-us",
  },
};

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-obsidian-50 text-obsidian-900">
      {/* 01. EDITORIAL HERO BANNER */}
      <section className="bg-ocean-900 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-12 relative overflow-hidden border-b border-white/10">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-summit-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <Award className="w-4 h-4 text-summit-500" />
            <span>TripAdvisor Best of the Best 2025 · #6 in Canada</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-light font-serif tracking-tight text-white leading-[1.1]">
            Crafting Canada&apos;s Most Unforgettable Alpine Journeys
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-sans max-w-2xl mx-auto">
            Founded in the heart of the Bow Valley, Vista Chase was born out of a simple conviction: the world&apos;s
            most majestic mountains deserve to be experienced with calm, comfort, and deep local insight.
          </p>
        </div>
      </section>

      {/* 02. OUR STORY & MORAINE LAKE GUARANTEED ACCESS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-20 space-y-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-xs uppercase tracking-widest text-ocean-500 font-bold">Our Heritage</span>
            <h2 className="text-3xl sm:text-4xl font-light font-serif text-obsidian-900 leading-tight">
              Why We Built Vista Chase: Elevating the Rockies Experience
            </h2>
            <div className="space-y-4 text-slate-700 leading-relaxed text-sm sm:text-base">
              <p>
                When vehicular restrictions were placed on Moraine Lake Road to protect the fragile alpine ecology,
                visiting Canada&apos;s crown jewel became a stressful ordeal. Travelers were forced to fight 3:00 AM alarm
                clocks, endure crowded public park-and-rides, or face closed roads.
              </p>
              <p>
                We established <strong>Vista Chase</strong> to offer an elevated, civilized alternative: guaranteed
                commercial corridor permits, door-to-door hotel pickups in Banff and Canmore, small groups capped at 12
                guests, and private luxury SUVs where families set their own mountain pace.
              </p>
              <p>
                Today, with over 10,000 satisfied guests and recognition as <strong>#6 Best Experience in Canada</strong>,
                our commitment remains steadfast: more time connecting with nature, zero parking stress.
              </p>
            </div>
          </div>

          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-200">
            <Image
              src="/media/photos/guide-with-guests.webp"
              alt="Certified Vista Chase mountain guide overlooking Bow Valley"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 600px"
            />
            <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs">
              <span className="font-bold text-summit-300 block">Local Guides · Lifelong Bow Valley Residents</span>
              <span className="text-slate-300">Certified interpretive guides with wilderness first responder training</span>
            </div>
          </div>
        </div>

        {/* 03. CORE BRAND PILLARS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          <div className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-ocean-900 text-summit-300 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-obsidian-900">Licensed Commercial Access</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Official Parks Canada commercial operating permits guarantee direct vehicle corridor access to Moraine
              Lake and Lake Louise. Fully insured and provincially certified.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-ocean-900 text-summit-300 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-obsidian-900">Intimate Small Groups (Max 12)</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We never operate 50-passenger mass tour coaches. Small group sizes mean personal attention from your guide,
              unhurried photo opportunities, and light environmental impact.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-ocean-900 text-summit-300 flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-medium text-obsidian-900">Alpine Hospitality</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Hot French roast coffee, cocoa, clean mountain shuttles, and live WhatsApp shuttle corridor tracking
              designed around guest comfort at every mile.
            </p>
          </div>
        </div>

        {/* 04. CALL TO ACTION */}
        <div className="p-10 rounded-3xl bg-ocean-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/10">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs uppercase tracking-widest text-ocean-500 font-bold">Ready to Explore?</span>
            <h3 className="text-2xl sm:text-3xl font-serif font-light text-white">
              Discover the Canadian Rockies Your Way
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm">
              Instant Bókun confirmation, guaranteed seat holds, and 48-hour free cancellation.
            </p>
          </div>
          <Link
            href="/#featured-experiences"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest text-obsidian-900 golden-summit-btn shrink-0 shadow-lg"
          >
            <span>View All Tours</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
