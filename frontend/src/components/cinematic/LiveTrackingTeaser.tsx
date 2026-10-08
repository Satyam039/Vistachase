// Live pickup tracking teaser: what the feature does in plain words, and a small replica of the
// real /track page (status, ETA, progress) linking to the demo session. Uses the backend's
// pickup-day WhatsApp link (sent about an hour before pickup once WhatsApp is connected).

import Link from "next/link";
import { ArrowRight, MapPin, MessageSquare, Smartphone } from "lucide-react";

const STEPS = ["Preparing", "On the way", "Arriving", "Picked up"];
const POINTS = [
  { icon: MessageSquare, text: "A live link by WhatsApp about an hour before pickup" },
  { icon: MapPin, text: "Your shuttle on the map, your driver and the plate number" },
  { icon: Smartphone, text: "Opens in your browser: nothing to download" },
];

export function LiveTrackingTeaser() {
  return (
    <section aria-labelledby="tracking-heading" className="overflow-hidden border-t border-white/10 bg-obsidian-950 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-page lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-400">Live pickup tracking</p>
          <h2 id="tracking-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Know exactly when your shuttle arrives
          </h2>
          <ul className="mt-8 space-y-4" data-stagger>
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-lg font-light text-slate-200">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-summit-400" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          <Link
            href="/track/4c75291326d8a68f983439c4291bcdfe92c5deaaecaf03d1be8d721b248f3d2a"
            className="golden-summit-btn group mt-9 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base"
          >
            See a live demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Replica of the tracking page's status card (decorative). */}
        <div className="lg:col-span-6" data-reveal="right" aria-hidden="true">
          <div className="rounded-[2rem] bg-white p-3 shadow-2xl">
            <div className="rounded-[1.5rem] bg-ocean-950 p-6 sm:p-8">
              <p className="flex items-center gap-2 text-sm text-white/70">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inset-0 rounded-full bg-ocean-400 opacity-60 motion-safe:animate-ping" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-ocean-400" />
                </span>
                Live pickup tracking
              </p>
              <div className="mt-4 flex items-end justify-between gap-6">
                <div>
                  <p className="text-2xl font-light text-white sm:text-3xl">Your shuttle is on the way</p>
                  <p className="mt-1.5 text-base text-white/70">Heading to Fairmont Banff Springs</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-white/70">Arrives in</p>
                  <p className="text-4xl font-light tabular-nums text-white">8 min</p>
                </div>
              </div>
              <ol className="mt-8 grid grid-cols-4 gap-2">
                {STEPS.map((s, i) => (
                  <li key={s}>
                    <span className={`block h-1.5 rounded-full ${i <= 1 ? "bg-summit-400" : "bg-white/15"}`} />
                    <span className={`mt-2 block text-xs sm:text-sm ${i === 1 ? "text-white" : "text-white/60"}`}>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center gap-3 px-4 py-4 text-obsidian-900">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base">Pickup at 05:00</span>
                <span className="block truncate text-sm text-slate-600">Main Motor Court entrance</span>
              </span>
              <span className="rounded-md border border-obsidian-900/15 px-2 py-0.5 font-mono text-sm">7VC-894</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
