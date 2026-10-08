// About Vista Chase, structured like the "About" pages of the booking sites studied (photo hero,
// numbers, story, values, fleet, recognition) in the brand system. Figures are the ones used across
// the live site: since 2018, 10,000+ guests, 5.0 from 1,000+ reviews, #6 in Canada (2026).

import Image from "next/image";
import { AwardSeal } from "@/components/brand/AwardSeal";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, ChevronRight, HeartHandshake, MountainSnow, ShieldCheck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About Vista Chase | Banff's Top-Rated Tour & Shuttle Operator",
  description:
    "Founded in 2018 in Canmore. TripAdvisor Best of the Best 2026 (#6 experience in Canada). Our story, local guides and fleet for the Canadian Rockies.",
  alternates: { canonical: "/about-us" },
};

const STATS = [
  { to: 2018, label: "guiding the Rockies since", plain: true },
  { to: 10000, suffix: "+", label: "guests guided" },
  { to: 5, decimals: 1, label: "average rating, 1,000+ reviews" },
  { to: 6, prefix: "#", label: "experience in Canada, TripAdvisor 2026" },
];

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Licensed access",
    body: "Parks Canada commercial permits get our vehicles to Moraine Lake and Lake Louise, where private cars can't go.",
  },
  {
    icon: Users,
    title: "Small groups, never coaches",
    body: "Shared tours stop at 12 guests, so there's time with your guide, unhurried photo stops and a lighter footprint.",
  },
  {
    icon: HeartHandshake,
    title: "Hosted by locals",
    body: "Our guides live in the Bow Valley. Hotel pickup, hot drinks and live vehicle tracking come as standard.",
  },
];

const TRIPADVISOR_URL =
  "https://www.tripadvisor.ca/Attraction_Review-g154911-d26518659-Reviews-Vista_Chase-Banff_Banff_National_Park_Alberta.html";

export default function AboutUsPage() {
  return (
    <div className="bg-obsidian-50 text-obsidian-900">
      {/* Hero */}
      <section className="relative isolate flex min-h-[70vh] items-end overflow-hidden bg-obsidian-950 text-white">
        <Image src="/media/photos/three-sisters-canmore.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover" data-parallax="10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ocean-950 via-ocean-950/40 to-ocean-950/10" />
        <div className="mx-auto flex w-full flex-col items-center text-center max-w-7xl px-page pb-14 pt-24" data-scroll-fade>
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
                About us
              </li>
            </ol>
          </nav>
          <p className="text-sm uppercase tracking-[0.22em] text-summit-300 motion-safe:animate-[fadeUp_700ms_ease-out]">Our story</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-light leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl motion-safe:animate-[fadeUp_900ms_ease-out]">
            Local guides, from the heart of the Bow Valley
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/85 motion-safe:animate-[fadeUp_1100ms_ease-out]">
            Vista Chase began in Canmore with a simple idea: the Rockies deserve to be seen calmly, comfortably and with
            someone who knows them.
          </p>
        </div>
      </section>

      {/* Numbers */}
      <section aria-label="Vista Chase in numbers" className="border-b border-obsidian-900/[0.06] bg-white">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-page py-8 sm:py-10 lg:grid-cols-4" data-stagger>
          {STATS.map((s) => {
            const final = s.plain ? String(s.to) : `${s.prefix ?? ""}${s.to.toLocaleString("en-CA", { minimumFractionDigits: s.decimals ?? 0 })}${s.suffix ?? ""}`;
            return (
              <div key={s.label} className="flex flex-col-reverse items-center justify-end px-4 text-center lg:border-l lg:border-obsidian-900/[0.08] lg:px-8 lg:first:border-0">
                <dt className="mt-1 text-sm text-slate-600">{s.label}</dt>
                <dd
                  className="text-4xl font-light tabular-nums text-obsidian-900"
                  {...(s.plain
                    ? {}
                    : { "data-count-to": s.to, "data-count-prefix": s.prefix, "data-count-suffix": s.suffix, "data-count-decimals": s.decimals })}
                >
                  {final}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* Story */}
      <section aria-labelledby="story-heading" className="mx-auto grid max-w-7xl items-center gap-12 px-page py-20 sm:py-28 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600" data-reveal>
            Why we started
          </p>
          <h2 id="story-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl" data-reveal>
            More time at the lakes. No parking stress.
          </h2>
          <div className="mt-6 space-y-4 text-lg font-light leading-relaxed text-slate-700" data-reveal>
            <p>
              When Moraine Lake Road closed to private vehicles, seeing Canada&rsquo;s most famous lake turned into 3 a.m.
              alarms, packed park-and-rides and closed roads.
            </p>
            <p>
              We built Vista Chase as the calmer alternative: licensed access, doorstep pickup in Banff, Canmore and Lake
              Louise, small groups of up to 12, and private vehicles for travellers who want to set their own pace.
            </p>
            <p>
              More than 10,000 guests later, and named the <strong>#6 experience in Canada</strong>, the idea hasn&rsquo;t
              changed.
            </p>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem]" data-reveal="clip">
          <Image
            src="/media/photos/guide-with-guests.webp"
            alt="A Vista Chase guide with guests above the Bow Valley"
            fill
            sizes="(max-width: 1024px) 100vw, 600px"
            className="object-cover"
            data-parallax="6"
          />
          <p className="absolute inset-x-5 bottom-5 rounded-2xl bg-obsidian-950/60 px-5 py-4 text-sm text-white backdrop-blur-md">
            <span className="block text-base">Guides who live here</span>
            <span className="text-white/80">Bow Valley residents with wilderness first-aid training</span>
          </p>
        </div>
      </section>

      {/* Values */}
      <section aria-labelledby="values-heading" className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto mb-12 max-w-3xl text-center" data-reveal>
            <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">What we stand for</p>
            <h2 id="values-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
              The Vista Chase way
            </h2>
          </div>
          <ul className="grid gap-5 md:grid-cols-3" data-stagger>
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-[1.75rem] bg-obsidian-50 p-7 ring-1 ring-obsidian-900/[0.06] sm:p-8">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-obsidian-950 text-summit-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-2xl font-light text-obsidian-900">{title}</h3>
                <p className="mt-3 text-base font-light leading-relaxed text-slate-700">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Fleet */}
      <section aria-labelledby="fleet-heading" className="mx-auto max-w-7xl px-page py-20 sm:py-28">
        <div className="mx-auto mb-12 max-w-3xl text-center" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-ocean-600">Our fleet</p>
          <h2 id="fleet-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-obsidian-900 sm:text-4xl lg:text-5xl">
            Comfortable vehicles, sized for the day
          </h2>
        </div>
        <ul className="grid gap-5 md:grid-cols-2" data-stagger>
          {[
            { src: "/media/photos/cadillac-escalade-mountains.webp", title: "Luxury SUV", body: "Up to 6 guests. Private tours with your own guide and pace.", alt: "Black Cadillac Escalade in the mountains" },
            { src: "/media/photos/vista-chase-sprinter-canmore.webp", title: "Executive van", body: "Up to 13 guests. Shared tours, shuttles and larger private groups.", alt: "Vista Chase Mercedes Sprinter van in Canmore" },
          ].map((v) => (
            <li key={v.title} className="group overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-obsidian-900/[0.07]">
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image src={v.src} alt={v.alt} fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="text-2xl font-light text-obsidian-900">{v.title}</h3>
                <p className="mt-2 text-base font-light text-slate-700">{v.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Recognition */}
      <section aria-labelledby="award-heading" className="bg-obsidian-950 py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-page md:grid-cols-[auto_minmax(0,1fr)] md:gap-14">
          <span className="flex h-44 w-44 items-center justify-center rounded-[1.75rem] bg-white p-5" data-reveal="scale">
            <AwardSeal size="md" />
          </span>
          <div data-reveal>
            <p className="text-sm uppercase tracking-[0.22em] text-summit-300">Recognition</p>
            <h2 id="award-heading" className="mt-3 text-balance text-3xl font-light leading-tight tracking-tight text-white sm:text-4xl">
              Named the #6 experience in all of Canada
            </h2>
            <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-white/80">
              Our shared Banff tour was chosen in TripAdvisor&rsquo;s 2026 Best of the Best awards, based on traveller
              reviews.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/banff-highlights-tour" className="golden-summit-btn inline-flex h-12 items-center gap-2 rounded-full px-6 text-base">
                See the award-winning tour
              </Link>
              <a
                href={TRIPADVISOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 text-base text-white hover:bg-white/10"
              >
                Read our reviews
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">(opens TripAdvisor in a new tab)</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Ways to explore */}
      <section aria-labelledby="explore-heading" className="mx-auto max-w-7xl px-page py-20 sm:py-24">
        <h2 id="explore-heading" className="mb-8 text-center text-3xl font-light tracking-tight text-obsidian-900 sm:text-4xl" data-reveal>
          Explore with us
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3" data-stagger>
          {[
            { label: "Shared tours", href: "/shared-tours", icon: Users },
            { label: "Private tours", href: "/private-tours", icon: MountainSnow },
            { label: "Lake shuttles", href: "/shuttles", icon: ShieldCheck },
          ].map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex items-center justify-between rounded-2xl bg-white px-6 py-5 ring-1 ring-obsidian-900/[0.07] transition-colors hover:ring-ocean-600/40"
              >
                <span className="flex items-center gap-3 text-lg text-obsidian-900">
                  <Icon className="h-5 w-5 text-ocean-600" aria-hidden="true" />
                  {label}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
