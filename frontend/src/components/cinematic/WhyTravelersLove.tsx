// "Why travellers choose us" (Viator / GetYourGuide reassurance grid on a dark band): a photo
// with one plain fact, six reasons beside it. Every reason is a catalog fact, an FAQ answer or the
// legal cancellation policy; nothing here is marketing that isn't backed elsewhere on the site.

import Image from "next/image";
import { BadgeCheck, CalendarCheck, CarFront, MapPin, MountainSnow, Users } from "lucide-react";

const REASONS = [
  { icon: MountainSnow, title: "Guaranteed lake access", body: "Private cars can't drive to Moraine Lake. As a commercial operator, we still can." },
  { icon: Users, title: "Small groups", body: "Never more than 12 guests on a shared tour, so there's time for every photo stop." },
  { icon: CarFront, title: "Your own vehicle", body: "Private tours in a luxury SUV for up to 6 or an executive van for up to 13." },
  { icon: MapPin, title: "Hotel pickup", body: "Doorstep pickup from more than 25 hotels and lodges in Banff, Canmore and Lake Louise." },
  { icon: BadgeCheck, title: "Rated 5.0", body: "Ranked the #6 experience in Canada on Tripadvisor, from more than 1,000 reviews." },
  { icon: CalendarCheck, title: "Free cancellation", body: "A full refund when you cancel at least 72 hours before your tour." },
];

export function WhyTravelersLove() {
  return (
    <section aria-labelledby="why-heading" className="relative overflow-hidden bg-obsidian-950 py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute -right-20 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 opacity-[0.04]" aria-hidden="true">
        <Image src="/media/brand/horse-emblem-gold.png" alt="" fill sizes="34rem" className="object-contain" />
      </div>

      <div className="relative mx-auto max-w-7xl px-page">
        <div className="mx-auto mb-14 max-w-3xl text-center" data-reveal>
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-summit-400">Why Vista Chase</p>
          <h2 id="why-heading" className="text-balance text-3xl font-light leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Why travellers choose us
          </h2>
          <p className="mt-4 text-lg font-light leading-relaxed text-slate-300">Local guides, small groups and the lakes you can no longer drive to yourself.</p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-[2rem]" data-reveal="clip">
              <div className="relative h-[28rem] sm:h-[34rem]">
                <Image src="/media/site/feature-image-1.webp" alt="A Vista Chase guide with guests in the Rockies" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" data-parallax="10" />
                <div className="vc-scrim" aria-hidden="true" />
              </div>
              <p className="absolute inset-x-6 bottom-6 text-lg font-light text-white">Small-group, private and shuttle tours, run from Canmore.</p>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-7" data-stagger>
            {REASONS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="h-full rounded-[1.5rem] bg-white/[0.04] p-6 ring-1 ring-white/10 transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-white/[0.07]">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-summit-500/15 text-summit-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg text-white">{title}</h3>
                <p className="mt-1.5 text-base font-light leading-relaxed text-slate-300">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
