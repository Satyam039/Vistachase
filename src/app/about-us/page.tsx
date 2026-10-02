import Image from "next/image";
import Link from "next/link";
import { Award, ShieldCheck, Heart, Users, MapPin, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Vista Chase | Banff's Top-Rated Tour & Shuttle Operator",
  description:
    "Founded in 2018 in Banff/Canmore. Winner of TripAdvisor Best of the Best 2025. Discover our story, expert local guides, and passion for the Canadian Rockies.",
  alternates: {
    canonical: "/about-us",
  },
};

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <section className="bg-forest-950 text-white py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-900 border border-gold-400/40 text-gold-300 text-xs font-semibold">
            <Award className="w-4 h-4 text-gold-400" />
            <span>Founded in 2018 • Banff, Alberta</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold font-display text-white">
            Creating Canada’s Best Travel Memories
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto">
            From humble beginnings in Canmore to ranking <strong>#6 in all of Canada on TripAdvisor</strong>, our mission has never changed: sharing the majesty of the Rockies with warmth, care, and guaranteed access.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 w-full space-y-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4 text-slate-700 leading-relaxed text-base">
            <span className="text-xs uppercase tracking-widest font-bold text-gold-600">Our Story</span>
            <h2 className="text-3xl font-bold font-display text-forest-950">
              Why We Started Vista Chase
            </h2>
            <p>
              When vehicular restrictions were placed on Moraine Lake Road to protect the fragile alpine ecology, visiting Canada’s most famous lake became stressful. Travelers were forced into crowded park-and-rides or turned away at 4:00 AM.
            </p>
            <p>
              We founded <strong>Vista Chase</strong> to offer a civilized, luxurious, and personalized alternative: comfortable commercial shuttles, hot drinks in the crisp alpine air, door-to-door hotel pickups, and private SUVs where families set their own pace.
            </p>
          </div>
          <div className="relative h-80 rounded-3xl overflow-hidden shadow-xl border border-slate-200">
            <Image
              src="https://images.unsplash.com/photo-1503614472-8c93d56e92ce?q=80&w=1000&auto=format&fit=crop"
              alt="Moraine Lake Canoes Vista Chase"
              fill
              className="object-cover"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-forest-700" />
            </div>
            <h3 className="text-lg font-bold text-forest-950 font-display">Licensed &amp; Authorized</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Official Parks Canada commercial operating permits, commercial insurance, and experienced mountain drivers.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
              <Heart className="w-5 h-5 text-forest-700" />
            </div>
            <h3 className="text-lg font-bold text-forest-950 font-display">Small-Group Integrity</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We never pack large 50-passenger buses. Small groups (max 12) mean meaningful connections and less trail impact.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card space-y-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
              <Users className="w-5 h-5 text-forest-700" />
            </div>
            <h3 className="text-lg font-bold text-forest-950 font-display">Passionate Locals</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our guides live and play in the Bow Valley year-round, knowing every hidden wildlife trail, light angle, and story.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
